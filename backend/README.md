# Backend pcdNades

TypeScript/Fastify com Supabase Auth/PostgreSQL/Storage. Leitura pública e escrita administrativa são padrão PROVISÓRIO. Importadores YouTube/TikTok desabilitados; nunca há fallback para embed.

## Operação
Node >=22. `npm ci --ignore-scripts`, `npm run build`, `npm test`, `npm run typecheck`. Copie .env.example para .env (não versionado), configure credenciais somente no servidor. Inicie API com `node --env-file=.env dist/server.js`. Execute migrations/001_initial.sql em projeto Supabase dedicado, após revisão. Não foi aplicada remotamente nesta entrega. Insira o UUID de usuário criado no Auth em private.administrators manualmente; desabilite cadastro público no painel Auth. Nunca publique service role no frontend.

Worker exige FFmpeg/ffprobe instalados e DATABASE_URL. Execute `npm run worker` periodicamente por scheduler; termina quando a fila esvazia. Container deve ter limites de CPU/RAM/disco e sem egress para FFmpeg. Processamento ocorre fora do HTTP; lease de 15 minutos cobre timeout de 10 minutos da conversão. Falhas viram failed, sem retry automático de conteúdo inválido. Jobs interrompidos são retomados até 3 tentativas. Storage e metadados não formam transação distribuída: reconciliação e limpeza de órfãos devem ser configuradas antes de produção.

Limites técnicos iniciais: 50.000.000 bytes, 20 segundos, dimensões até 1920x1920. MP4 validado pelo ffprobe e convertido H264/AAC. A duração máxima de 20 segundos foi definida pelo usuário; tamanho e dimensões são defaults técnicos. Bucket privado videos-staging recebe fonte e saída; não criar políticas públicas. API usa service role apenas para operações internas de mídia após autorização. Banco exige vídeo ready para publicar granada.

## Contrato v1
Prefixo /api/v1. GET /maps retorna {data:[{id,name,radar:{imageUrl,width,height,coordinateVersion}}]}. Mapas precisam ser inseridos por migration/operador com arte canônica autorizada; nenhum radar inventado é incluído.
GET /grenades aceita mapId,type,side,limit(default 50,max 100),offset; retorna {data:[],pagination:{limit,offset,total}}. GET /grenades/:id retorna {data:grenade}. POST /grenades 201, PATCH /grenades/:id 200, DELETE /grenades/:id 204 exigem Authorization: Bearer token Supabase e is_admin().
Corpo POST: {title,mapId,type:"smoke"|"flashbang"|"molotov",side:"T"|"CT",instructions,target:{x:0..1,y:0..1},videoId:UUID}. PATCH parcial, sem corpo vazio. id/datas são gerados pelo banco. Origem do radar: superior esquerda da imagem efetiva, excluindo letterbox.

POST /media/uploads (admin,201) retorna {data:{mediaId,upload:{protocol:"supabase-signed",url,path,token},limits:{maxBytes:50000000,maxDurationSeconds:20}}}. Envie arquivo para URL assinada pelo SDK Supabase uploadToSignedUrl(path,token,file,{contentType:"video/mp4"}); URL/token são temporários, não devem ser persistidos como mídia. Depois POST /media/:id/complete (admin,202) enfileira. GET /media/:id (admin) retorna {data:{id,status,sourceType,sourceUrl,stage,error,metadata,createdAt,updatedAt}}. Polling sugerido 3s; status awaiting_upload|queued|processing|ready|failed. sourceUrl/metadata/stage/error podem ser null. Sem progresso percentual inventado.
GET /media/:id/playback retorna {data:{url,expiresAt,mimeType}}, somente para mídia pronta vinculada a granada publicada. Renove URL quando expirar. GET /media/capabilities é público; upload.enabled depende da configuração, importers.youtube.enabled=false e importers.tiktok.enabled=false. POST /media/imports (admin) sempre retorna 422 PLATFORM_UNSUPPORTED. Erros {error:{code,message}}. 400 validação,401 autenticação,403 autorização,404 inexistente,409 estado da mídia,503 dependência.

## Importadores e validação pendente
Adaptadores futuros precisam produzir arquivo local para o mesmo pipeline, sem alterar a reprodução. Não existe download operacional nesta entrega. YouTube API restringe armazenamento sem aprovação: https://developers.google.com/youtube/terms/developer-policies . TikTok Display/Embed não comprova API de download: https://developers.tiktok.com/docs/en/display-api-overview . Avaliar conteúdo autorizado, método permitido e comportamento no host antes de habilitar; não contornar login/DRM/bloqueios. Implementar bloqueio SSRF em DNS, redirects e egress dos binários antes de qualquer importador.

Verificações reais pendentes de ambiente: aplicar migration em Supabase descartável; testar RLS anônimo/usuário/admin; upload real e falhas, FFmpeg instalado, reprodução/seek Safari/Chrome, renovação, recuperação de worker, quotas e armazenamento compartilhado entre dispositivos. Build e testes locais não comprovam esses requisitos.

## Configuração dos limites
`MEDIA_MAX_BYTES` (default 50000000) e `MEDIA_MAX_DURATION_SECONDS` (default 20) aceitam somente inteiros positivos seguros, sem espaços, decimais ou notação exponencial. Duração acima de 20 segundos também é inválida. Valores inválidos impedem API e worker de iniciar. A mesma função de configuração alimenta capabilities, sessão de upload, validação do worker e argumentos FFmpeg. Configure os mesmos valores nos dois processos e reinicie ambos após mudanças.

A migration inicial mantém o bucket em 50.000.000 bytes. Alterar env não altera o Supabase: alinhe o limite do bucket e o limite global do plano antes de aumentar MEDIA_MAX_BYTES. Uma redução é validada pelo worker; upload direto pode chegar ao bucket até seu limite configurado. Nenhum ajuste remoto foi executado. O tempo máximo do processo FFmpeg permanece 10 minutos, independentemente da duração configurada do vídeo.
