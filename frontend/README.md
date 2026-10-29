# Frontend pcdNades

React + TypeScript + Vite, com modos separados de demonstração e API. A integração remota depende de ambiente configurado; testes com respostas controladas não comprovam Supabase/Storage/worker reais.

## Executar e verificar

Node 22.12+ (validado com Node 24), nesta pasta:

```powershell
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run test:browser
```

Dev: http://127.0.0.1:5173. Playwright: portas 5174 (demo) e 5175 (API controlada, quando configurada nos testes). Instale Chromium se necessário: `npx playwright install chromium`. tests/fixtures/test-pattern.mp4 é um padrão sintético de dois segundos, sem gameplay, exclusivamente para QA.

Vercel: root `frontend`, instalação `npm ci`, build `npm run build`, saída `dist`; fallback SPA em vercel.json. Integração/publicação da main são do orquestrador.

## Modos e configuração

Copie .env.example para .env.local, não versionado, e reinicie o Vite. Os nomes VITE_* vão para o bundle público: nunca incluir service_role, sb_secret_, senha administrativa, token JWT de sessão ou URL assinada.

- `VITE_DATA_MODE=demo`: padrão quando ausente. Serviço em memória, avisos permanentes, sem credenciais, sem banco. Alterações/MP4 local desaparecem ao recarregar. Não usa localStorage para cadastros.
- `VITE_DATA_MODE=api`: exige `VITE_API_URL` incluindo `/api/v1`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (sb_publishable_). URLs HTTPS, exceto localhost/loopback em desenvolvimento. Configuração incompleta exibe erro, sem criar serviço demo.
- Não há fallback de API para fixtures quando a consulta falha ou retorna vazia. Erros exibem tentativa de reconexão; nenhum cadastro demonstrativo é misturado ao banco.
- Auth Supabase guarda apenas a sessão pelo mecanismo do SDK (persistSession/autoRefreshToken). Nenhuma senha é salva pelo app e nenhum cadastro de granada fica no localStorage. O backend valida administrador em toda escrita; o frontend não usa claims editáveis como autorização.
- A origem do frontend precisa constar no CORS da API. A configuração do SDK/API não provisiona banco, bucket, worker, usuário ou permissão.

## Recursos

Seleção de mapa, filtros tipo/lado, radar proporcional, lista acessível e escolha de destinos sobrepostos. Detalhes com player nativo e instruções. Administração com login real no modo API, CRUD, confirmação de exclusão, validação e coordenadas por clique/toque ou teclado. No demo, acesso administrativo é identificado e não coleta senha.

MP4: teto confirmado de 90 segundos. No demo, 50.000.000 bytes; no modo API, GET capabilities determina tamanho e duração (nunca acima de 90s). Cliente verifica extensão/MIME/contêiner e prévia/duração; servidor/worker são autoridade sobre o conteúdo.

Fluxo API: criar sessão de upload assinada → uploadToSignedUrl no bucket videos-staging → complete → publicar com videoId somente ready. O contrato permite complete200 com ready/failed ou202 com operação em curso; queued/processing são consultados a cada3s. Só POST /media/:id/complete usa timeout150s (prazo do servidor120s); todos os demais endpoints mantêm30s.

`capabilities.upload.processingMode` é opcional: `inline-original` ou `worker-transcode`. Quando ausente, a interface não presume modo. Em inline-original, o servidor valida o MP4 original: vídeo H.264/yuv420p, áudio AAC ou sem áudio, respeitando90s e tamanho de capabilities. Não há conversão automática. A orientação aparece apenas quando o modo é informado. Erros UNSUPPORTED_CODEC,INVALID_MEDIA,DURATION_EXCEEDED,FILE_TOO_LARGE e PROCESSING_TIMEOUT recebem mensagens locais claras, sem exibir stack/caminhos do servidor.

Depois de enviar os bytes, o progresso LOCAL confirming exibe “Confirmando envio”, sem afirmar status de processamento do servidor. Timeout/perda de conexão preserva mediaId; novo Salvar consulta a mesma mídia: ready publica, queued/processing acompanha, awaiting_upload repete apenas complete idempotente, failed orienta nova escolha. Um409 em complete é reconciliado por GET antes de decidir. Nenhum desses casos reenvia bytes automaticamente. UPLOAD_FAILED/UPLOAD_INCOMPLETE reais e troca de arquivo iniciam nova sessão. Falha de validação preserva o cadastro anterior.

Sem porcentagens inventadas. Em queued/processing é possível pausar acompanhamento e retomar com Salvar; isso não cancela a operação no servidor. Uma mídia pronta é reaproveitada se a publicação falhar na mesma janela. Fechar a janela perde esse vínculo local; limpeza de mídias órfãs é responsabilidade do backend.

Playback é solicitado somente para mídia ligada a granada publicada, com renovação antes de expiresAt. Nova URL preserva posição/estado de reprodução quando possível. Erro oferece nova tentativa; nunca iframe/embed. A prévia do arquivo escolhido continua local até publicação e não solicita playback de mídia não publicada.

Shorts/TikTok: disponibilidade pelo GET capabilities. Importadores inicialmente desabilitados; UI informa indisponibilidade e oferece MP4 explicitamente. Não há download de vídeo no navegador nem fallback para embed.

## Mapas canônicos

Plantas vetoriais de mapas CS2 por setpos.gg, licença explícita de artwork CC BY 4.0. Não são texturas oficiais extraídas. Crédito visível e documentação em public/maps/ATTRIBUTION.md. Snapshot ba5f793883e1ce13076dd6919aa1601099c247cf (23/10/2026), possível defasagem frente ao jogo.

| id      | imagem na origem do frontend | tamanho   | coordinateVersion      |
| ------- | ---------------------------- | --------- | ---------------------- |
| mirage  | /maps/mirage.svg             | 1024×1024 | setpos-mirage-ba5f793  |
| inferno | /maps/inferno.svg            | 1024×1024 | setpos-inferno-ba5f793 |
| ancient | /maps/ancient.svg            | 1024×1024 | setpos-ancient-ba5f793 |

Sem corte/giro; target x/y [0,1] relativo a toda a imagem, origem superior esquerda e y para baixo. A versão é string. Coordenar o seed com backend; mudar enquadramento exige migrar ou rever destinos. No modo API os mapas vêm do servidor; ausência de seed não é substituída pelo catálogo demo. Pontos de demo são fictícios e reposicionados para essas artes, sem lineups de execução inventadas.

## Estrutura

- src/domain: modelo de tela, filtros/coordenadas/validação e agendamento de renovação.
- src/services: runtime/config, cliente HTTP, contrato/adaptador v1, porta auth e SDK Supabase isolado em chunk carregado somente no modo API. O serviço demo continua separado.
- src/features/library: consulta/seleção/player com renovação.
- src/features/admin: autenticação, CRUD, formulário/mídia/acompanhamento.
- src/components: radar/diálogo nativo/ícones.
- tests: domínio/serviços e fluxos de browser. Respostas controladas sempre identificadas como tais.

## Limites de validação

A primeira demo teve 10 testes unitários, 12 Playwright desktop/mobile, build/typecheck e audit zero. O incremento API adiciona testes de contrato/pipeline/configuração; a verificação é registrada no checkpoint e em docs/verification.md. Nenhum resultado controlado deve ser chamado de E2E real.

Dependências de validação real: API saudável e CORS, projeto/usuário administrador Supabase, permissões/RLS, bucket privado, worker FFmpeg, upload completo e reprodução/renovação em navegadores reais, persistência entre dispositivos. Não presumir que o deploy publicado usa esta versão ou modo API até confirmação do orquestrador.

## Seleção de trecho e prévia local (contrato90)

Envio sem recorte mantém o MP4 inteiro e exige fonte até90s. Quando capabilities.trimming.enabled=true, o arquivo de origem pode ter até180s/50MB e o trecho final deve ter0,1..90s, início>=0,fim>início,fim<=duração da origem, precisão0,001s (até3decimais). Os campos efetivos vêm de capabilities; limites menores são respeitados.

O seletor mostra início/fim em segundos, ajustes por sliders e reprodução delimitada do MP4 original local. Isso não cria arquivo recortado nem anuncia sucesso remoto: o servidor executa/valida o recorte. Desabilitado/ausente em capabilities bloqueia a seleção e explica o motivo. A demonstração não simula arquivo cortado.

POST /media/uploads envia {clip:{startSeconds,endSeconds}} somente se selecionado; sem seleção preserva corpo ausente. Complete usa apenas ID, nunca novo intervalo. A seleção é imutável: arquivo/trecho diferentes descartam retomada local; ao retomar, MediaRecord.clip deve corresponder ao solicitado para não publicar outro trecho.

Capacidades: trimming{enabled,reasonCode?,maxSourceDurationSeconds,maxSourceBytes,maxDurationSeconds,minDurationSeconds,timePrecisionSeconds}; upload mantém maxDurationSeconds/maxBytes. Importers YouTube/TikTok/Instagram são independentes e continuam indisponíveis até habilitação real. Links usam reconhecimento de host/path exatos e enviam clip apenas se plataforma e recorte estiverem habilitados. Não há iframe, download ou prévia inventada de link.

Os7radaresPNG adicionados pelo usuário na main são preservados. Este incremento não altera assets/catálogo demo; no modoAPI a lista/radares continuam vindos do servidor. A tabela setpos acima registra o catálogo demonstrativo original e não sobrescreve o catálogo real.