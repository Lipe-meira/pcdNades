# Prévia privada da fonte — contrato implementado02/11/2026

Bearer admin autorizado para importação, exclusivamente proprietário do sourceId. Sem criação de granada ou mídia final. Reels/TikTok/MP4/Solo preservados.

- POST `/api/v1/media/imports/:sourceId/preview`, corpo `{}`: aguarda geração limitada e retorna200ready. NÃO retorna202 ou inicia background. Se slot ocupado,503PROCESSOR_BUSY; cliente pode repetir preservando formulário.
- GET mesma rota:200ready e URL renovada, sem download novo ou prorrogação da sessão.
- Resposta: `{data:{sourceId,status:"ready",url,expiresAt,sourceExpiresAt,mimeType:"video/mp4"}}`. URL somente Storage privado `import-previews`, nunca CDN. Cache-Control:no-store nas rotas.
- URL até60s, com margem11s antes da expiração da fonte para cobrir deadline10s do pedido de assinatura. Perto da expiração pode ficar indisponível. Sessão15min continua imutável.
- Erros padrão `{error:{code,message}}`:401UNAUTHORIZED,403FORBIDDEN,404SOURCE_NOT_FOUND (inclui outroowner),410SOURCE_EXPIRED,503PREVIEW_UNAVAILABLE (flag/heartbeat/provider/dependência/reserva ambígua),503PROCESSOR_BUSY;422PREVIEW_UNAVAILABLE para fonte sem compatibilidade dentro do orçamento. Campos extras no POST400VALIDATION_ERROR.
- `capabilities.data.importers.{tiktok,instagram}.sourcePreview`: boolean estrito. True somente provider ativo, flag de prévia e heartbeat válido; não revela identidade. GET/POST também verificam gates, não confiar só no frontend.

## Fonte e orçamento

Download pelos importadores existentes/proxy validado, fonte<=50MB/7200s, transferências e deadlines existentes preservados. Prévia exige MP4H264/yuv420p/AAC; fontes incompatíveis de até90s podem ser convertidas com FFmpeg até40s, saída<=50MB, probe e duração conferidos. Fonte longa incompatível fica indisponível, sem reduzir limites da importação final. Deadline da operação110s, slot global120s, diretório temporário removido em finally. Reserva persistida ANTES de upload. Falha ambígua mantém reserva, não sobrescreve objeto: reinspecionar fonte, ou aguardar coleta/TTL. Reconsulta após slot evita download duplicado de preview pronta por concorrência.

## Limpeza e gate de produção

`MEDIA_SOURCE_PREVIEW_ENABLED=false` por padrão. Sem heartbeat de sweep COMPLETO dos últimos8min (tolerância clockfuturo5s), negar geração e renovação. Recomenda-se coletor externo monitorado a cada5min ou menos;8min tolera atraso de3min. Não há scheduler Vercel configurado nem promessa de coleta após processo encerrar. CLI one-shot `backend/scripts/source-preview-maintenance.ts` exige configuração privada do operador; usa service-role e bucket dedicado. Não expõe endpoint público de manutenção.

Coleta expirados após graça2min, lease2min e CAS, remove objeto antes de liberar registro; órfãos UUID.mp4 sem registro só após30min. Sweep parcial/erro não renova heartbeat. StorageSDK do serviço usa fetch com abort10s real; upload assinado usa sinal global. Nenhuma política pública de Storage foi criada. Migration20261102000337 preparada, já existente na stack local segundo inspeção real; NÃO aplicada remotamente.

## Evidência local e execução

Suite129 passou antes da última margemTTL (revalidar no checkpoint). Ensaio Auth/PostgREST/Storage local real: Reel e TikTok autorizados passaram POST200,Range206/1024B,GETrenewTTLinalterado,expiry410 e remoção verificada de registro/objeto; zero granadas criadas. Isso NÃO comprova player tocando no navegador, integração frontend, hash de mídia antiga ou Vercel; revisão combinada pendente.

Na pasta backend, usando diretório privado já existente, sem copiar/mostrar segredos:

`npx tsx scripts/source-preview-local-api.ts C:/Users/felip/.codex/worktrees/pcdnades-solo-e2e/nadesCs2/backend/vendor/solo-e2e-20261101 maintenance`

`npx tsx scripts/source-preview-local-api.ts C:/Users/felip/.codex/worktrees/pcdnades-solo-e2e/nadesCs2/backend/vendor/solo-e2e-20261101 serve`

API bind apenas127.0.0.1:3002. Repetir manutenção externamente antes de8min se ensaio demorar. Não contar a execução manual como scheduler de produção. O modo maintenance coleta previews expiradas do bucket dedicado; coordenar antes para preservar evidências temporárias de outro ensaio. Script `source-preview-local-e2e.ts DIRETORIO_PRIVADO` faz teste real dos dois links autorizados, recusa início se houver previews antigas expiradas e limpa só suas fixtures. Evitar repetir downloads sem necessidade.
