const messages: Record<string, string> = {
  IMPORT_UNAVAILABLE: "A importação está indisponível no servidor. Tente mais tarde ou envie um MP4.",
  SOURCE_EXPIRED: "A consulta do vídeo expirou. Consulte o link novamente antes de iniciar outra importação.",
  SOURCE_NOT_FOUND: "A consulta não foi encontrada. Consulte o vídeo novamente.",
  SOURCE_UNSUPPORTED: "Não foi possível consultar este vídeo público. Use outro link compatível ou envie um MP4.",
  SOURCE_TOO_LONG: "A fonte excede o limite de duas horas para importação. Escolha outro vídeo ou envie um MP4 compatível.",
  SOURCE_CHANGED: "O vídeo de origem mudou. Consulte o link e selecione o trecho novamente.",
  IMPORT_SELECTION_CONFLICT: "Esta consulta já está vinculada a outro trecho. Consulte o link novamente para uma nova seleção.",
  PROCESSOR_BUSY: "Outra importação está em processamento. Aguarde e use Retomar importação para tentar o mesmo trecho novamente.",
  IMPORT_NETWORK_LIMIT: "A importação atingiu um limite de obtenção do vídeo. Consulte novamente ou envie um MP4.",
  IMPORT_PILOT_LIMIT: "Esta seleção antiga excede o piloto TikTok de 30 segundos. O vídeo anterior foi preservado. Consulte novamente para selecionar um trecho menor.",
  IMPORT_TIMEOUT: "O trecho não pôde ser importado no tempo disponível. Consulte novamente ou envie um MP4.",
  IMPORT_HTTP_ERROR: "A fonte respondeu com erro HTTP. Tente novamente mais tarde ou envie um MP4 autorizado.",
  IMPORT_FAILED: "Não foi possível importar este trecho. Consulte novamente ou envie um MP4. O cadastro anterior foi preservado.",
  IMPORT_RATE_LIMIT: "O limite de consultas ou importações foi atingido. Aguarde antes de tentar novamente.",
  ATTEMPTS_EXHAUSTED: "As tentativas deste trecho foram esgotadas. Consulte o link novamente ou envie um MP4.",
  IMPORT_RANGE_UNSUPPORTED: "A fonte não permite obter somente este trecho dentro dos limites. Escolha outro vídeo ou envie um MP4.",
  IMPORT_RANGE_REQUIRED: "Não foi possível obter apenas o trecho selecionado. Escolha outro vídeo ou envie um MP4.",
  IMPORT_REDIRECT_LIMIT: "A obtenção do trecho encontrou redirecionamentos demais. Consulte novamente ou envie um MP4.",
  IMPORT_DESTINATION_DENIED: "Não foi possível obter este trecho da fonte permitida. Escolha outro vídeo ou envie um MP4.",
  IMPORT_ACCESS_DENIED: "O servidor do vídeo recusou o acesso. Envie um MP4. O cadastro e o vídeo anteriores foram preservados.",
  UNAUTHORIZED:
    "Sua sessão expirou ou não foi iniciada. Entre novamente para continuar.",
  FORBIDDEN: "Sua conta não tem permissão de administrador para esta ação.",
  PLATFORM_UNSUPPORTED:
    "Importação não disponível para esta plataforma. Envie um MP4.",
  MEDIA_STATE_CONFLICT:
    "O vídeo ainda não está pronto para esta ação. Consulte o processamento.",
  SERVICE_UNAVAILABLE:
    "O serviço está indisponível. Tente novamente mais tarde.",
  STORAGE_UNAVAILABLE:
    "O armazenamento está indisponível. Seu cadastro anterior foi preservado.",
  DATABASE_ERROR: "Não foi possível acessar os cadastros. Tente novamente.",
  NOT_FOUND: "O conteúdo não foi encontrado. Atualize a biblioteca.",
  INVALID_REFERENCE:
    "O mapa ou vídeo não está disponível. Atualize e tente novamente.",
  VALIDATION_ERROR: "Revise os dados informados antes de continuar.",
  UNSUPPORTED_CODEC:
    "Formato incompatível. Exporte em MP4 com vídeo H.264 (yuv420p), áudio AAC ou sem áudio. Não há conversão automática neste modo.",
  INVALID_MEDIA:
    "O arquivo MP4 é inválido ou está danificado. Exporte novamente com vídeo H.264 (yuv420p), áudio AAC ou sem áudio.",
  DURATION_EXCEEDED:
    "O vídeo excede a duração permitida. Respeite o limite de origem e o trecho final informado no formulário, de até 90 segundos.",
  CLIP_UNSUPPORTED: 'O recorte está indisponível neste ambiente. Envie o MP4 inteiro dentro do limite ou aguarde a liberação do recurso.',
  CLIP_INVALID: 'Revise início e fim do trecho: pelo menos 0,1s, até 90s e até três casas decimais.',
  CLIP_OUT_OF_RANGE: 'O trecho ultrapassa a duração do vídeo de origem. Ajuste o início e o fim.',
  MEDIA_SELECTION_CHANGED: 'A seleção deste vídeo mudou. Salve novamente para iniciar uma nova sessão com o arquivo e trecho atuais.',
  FILE_TOO_LARGE:
    "O arquivo excede o tamanho permitido. Exporte um MP4 menor, respeitando o limite indicado no formulário.",
  PROCESSING_TIMEOUT:
    "A validação do vídeo ultrapassou o tempo disponível. O cadastro anterior foi preservado. Selecione o arquivo novamente e tente outra vez.",
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 0,
    public readonly fields?: Record<string, string>,
    message?: string,
  ) {
    super(
      messages[code] ||
        message ||
        "Não foi possível concluir a solicitação. Tente novamente.",
    );
    this.name = "ApiError";
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  authenticated?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => Promise<string | null>,
    private readonly fetcher: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}
  async request<T>(path: string, options: Options = {}): Promise<T> {
    options.signal?.throwIfAborted();
    const headers = new Headers({ Accept: "application/json" });
    if (options.authenticated) {
      const token = await this.getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", 401);
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    const query = new URLSearchParams();
    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}${query.size ? `?${query}` : ""}`;
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000);
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: options.method ?? "GET",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: "omit",
        cache: "no-store",
        signal: options.signal
          ? AbortSignal.any([options.signal, timeout])
          : timeout,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError(
        timeout.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
        0,
        undefined,
        timeout.aborted
          ? "A solicitação demorou demais. Tente novamente."
          : "Não foi possível conectar à API. Verifique a conexão e tente novamente.",
      );
    }
    if (response.status === 204 && response.ok) return undefined as T;
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        response.status,
        undefined,
        "A API retornou uma resposta inválida.",
      );
    }
    if (!response.ok) {
      const error = (
        payload as {
          error?: {
            code?: string;
            fields?: Record<string, string>;
            message?: string;
          };
        }
      )?.error;
      throw new ApiError(
        error?.code || "API_ERROR",
        response.status,
        error?.fields,
      );
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new ApiError(
        "INVALID_RESPONSE",
        response.status,
        undefined,
        "A API retornou uma resposta inválida.",
      );
    return payload as T;
  }
}
