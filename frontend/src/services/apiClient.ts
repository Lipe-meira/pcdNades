const messages: Record<string, string> = {
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
    const timeout = AbortSignal.timeout(30_000);
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
