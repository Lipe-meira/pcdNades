# Importação TikTok: plano e contrato

Objetivo: inspecionar um vídeo público autorizado, escolher um intervalo e armazenar um MP4 de até 90 segundos/50.000.000 bytes. Implementação opt-in, sem modificar upload, sem cookies/login, sem contornar bloqueios. YouTube e Instagram continuam desativados.

Arquitetura aprovada pelo orquestrador em 30/10/2026: yt-dlp fixado apenas para metadados, através de proxy CONNECT local com DNS pinado e orçamento agregado; formato progressivo HTTPS MP4 somente. FFmpeg lê exclusivamente um relay HTTP local com Range, demuxer MOV fixo e referências externas desativadas. Não usar `--download-sections` como suposta garantia de tráfego. HLS/DASH, fontes sem Range e formatos fora da política falham explicitamente.

Plano de execução (skill writing-plans; caminho adaptado à responsabilidade exclusiva backend):

- [x] Escrever testes de política, intervalos e metadados; observar falha por módulos ausentes; implementar módulos internos sem habilitar rotas.
- [x] Testar argumentos fixos, seleção de formato e configuração opt-in; implementar extrator e preparação binária com SHA256.
- [x] Preparar migration local: sessões privadas, expiração, rate limit, criação atômica e lease global. Execução SQL ainda pendente.
- [x] Testar API/admin e processamento com dependências simuladas; ligar inspeção/importação ao fluxo existente de mídia. Idempotência SQL exige validação real separada.
- [x] Testar relay/Range e recorte real não inicial em fonte sintética longa, cancelamento e limites. SQL local29assertions PASS; não é Supabase/multiconexão. ProtectedTikTok inspectPASS, download403: operação real bloqueada, sem E2E Storage/Vercel.
- [x] Suite71/typecheck/build/bootstrap PASS, SQL29 e proxyoffline PASS; limites/403 documentados e commits coesos enviados à feat/backend. Nenhuma alteração remota/deploy nesta entrega; feature de importação continua bloqueada para produção.

## Contrato fixo enviado ao frontend

Todos os POST abaixo exigem Bearer admin. Erros usam `{error:{code,message}}`.

`POST /api/v1/media/imports/inspect` body `{sourceUrl}`. 201 `{data:{sourceId,provider:"tiktok",sourceUrl,videoId,title,author,durationSeconds,expiresAt,preview:null,previewReasonCode:"PREVIEW_UNAVAILABLE",limits}}`.

`sourceUrl` é página canônica pública, jamais CDN. `author` pode ser null. Não há token/CDN/thumb. `sourceId` UUID aleatório vinculado ao admin, expira em 15min. Prévia visual indisponível; a seleção é numérica sobre a duração real.

`limits = {maxSourceDurationSeconds:7200,maxDurationSeconds:90,maxBytes:50000000,minDurationSeconds:0.1,timePrecisionSeconds:0.001}`. Upload mantém sua política independente de fonte de até 180s com seleção/90s sem seleção.

`POST /api/v1/media/imports` body `{sourceId,clip:{startSeconds,endSeconds}}`. 201 `{data:mediaView + {mediaId:id}}`, estado inicial `queued`. `mediaId` sempre igual `id`. `sourceId` também presente em mediaView; `sourceUrl` igual inspeção; seleção imutável. Repetição mesmo sourceId/clip devolve mesma mídia; outra seleção retorna 409. Expiração só bloqueia criação nova, nunca retomada de mídia já criada.

O cliente deve chamar `POST /api/v1/media/:id/complete {}` após criar, e novamente ao retomar `queued` ou lease expirada. GET de status não executa processamento. Complete retorna 200 terminal ou 202 processing; 503 PROCESSOR_BUSY permite retry sem trocar seleção. Máximo duas tentativas, lease120s, deadline110s + finish5s. Poll GET existente; playback existente só publica ready associado a granada.

Stages possíveis: `resolving`, `downloading`, `transcoding`, `validating`, `storing`. Download e encoding ocorrem no mesmo FFmpeg; stage não é porcentagem. Inspeção deadline25s, cliente30s; complete cliente150s.

Erros da API: IMPORT_UNAVAILABLE503, SOURCE_EXPIRED410, SOURCE_NOT_FOUND404, SOURCE_UNSUPPORTED422, SOURCE_TOO_LONG422, CLIP_OUT_OF_RANGE400, SOURCE_CHANGED409, IMPORT_SELECTION_CONFLICT409, PROCESSOR_BUSY503, IMPORT_RATE_LIMIT429, UNAUTHORIZED401/FORBIDDEN403. Falhas após claim aparecem em media.error: IMPORT_NETWORK_LIMIT, IMPORT_TIMEOUT, IMPORT_FAILED, IMPORT_DESTINATION_DENIED, IMPORT_RANGE_UNSUPPORTED, INVALID_MEDIA etc.; nova seleção após terminal failed.

Orçamentos por tentativa: metadados8MB/16 conexões, mídia100MB/32 requisições/3 redirects por requisição; nenhum retry automático. Duas tentativas até216MB de payload agregado por job, mais overhead TCP/TLS e buffering do sistema. Isso não garante que toda fonte longa é importável: fonte sem Range, índice distante, alta taxa de bits ou limite de tempo podem falhar. Saída final sempre reprobed e decodificada integralmente antes de Storage. Não baixar arquivo inteiro antes de decidir intervalo.
