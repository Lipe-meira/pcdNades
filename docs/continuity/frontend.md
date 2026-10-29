# Checkpoint — frontend

Atualizado em: 29/10/2026 08:10, America/Sao_Paulo
Estado: aguardando confirmação READY/HTTP do deploy API para checagem visual somente leitura

## Objetivo e pedido atual

Integração opcional React/TypeScript com API real autorizada: HTTP por env, Supabase auth de admin, capabilities, upload assinado/complete/polling, publicação somente ready e playback renovável. Entrega de código e QA concluída nesta etapa; não provisionar serviços nem alterar main/deploy. Conta admin/worker/validação remota completa permanecem pendentes.

## Localização do trabalho

- Worktree gerenciado: C:/Users/felip/.codex/worktrees/pcdnades-frontend/nadesCs2.
- Branch feat/frontend. Base histórica e889e3b. Código API fa80ccf; correção e QA final 28085f8.
- Push do código confirmado em origin/feat/frontend até 28085f8. Git limpo antes de atualizar este checkpoint; somente este arquivo fica pendente para o commit/push de fechamento. O SHA do commit que contém este checkpoint deve ser obtido no Git, sem autorreferência.
- AGENTS/guia/template/checkpoint do orquestrador foram lidos da main remota (d8c643b e evolução); sem merge/troca de branch neste worktree. Somente frontend/ e este arquivo foram alterados.

## Feito

- Primeira prévia concluída/enviada: 056eea8 biblioteca, e3b66c0 plantas reais licenciadas,953a2ad CRUDdemo,3c220c3 QA/20s/SPA/docs; checkpoints f124ac6 e8890331. Orquestrador integrou/publicou a prévia; não presumir modo atual do deploy sem conferir.
- fa80ccf: runtime explícito demo/API, cliente HTTP com token/timeouts/abort/erros PT-BR, adapter paginado e capabilities, Supabase auth/sessão/logout, mídia assinada/complete/poll3s/publicação ready e player com renovação.
- 28085f8: corrigida invocação do fetch nativo no browser (this indevido); teste de consulta API vazio/503/retry passou após fix. Limpeza explícita de ID de retomada em UPLOAD_FAILED,UPLOAD_INCOMPLETE,awaiting_upload; troca de mídia também limpa.
- QA comprovou upload falha→segunda sessão no próximo Salvar; queued/processing pausado→retomado sem terceiro upload; publicação apenas após ready;403 preserva registro e não anuncia sucesso. Player faz renovação agendada e preserva posição.
- 20 testes unitários/contrato/serviço e22 browser passaram (12 demo+10API controlada, desktop/mobile). Build/typecheck e npm audit zero; diff check sem erros.
- Screenshots API/controlados revisados com view_image (desktop formulário/mobile login). Cópias persistidas fora do Git em C:/Users/felip/.codex/visualizations/2026/10/29/01a1853b-6e1e-79b3-8505-70e2d76056fe/api-login-controlado.png e api-form-controlado.png.
- Leitura REAL HTTP somente leitura em https://pcdnades-api.vercel.app: /health200 configured:true; /api/v1/maps200 com três mapas absolutos/versionados; /api/v1/grenades?limit=100&offset=0 200 vazio; capabilities200 uploadtrue,50000000bytes,20s,importersfalse. CORS conferido para Origin https://pcdnades.vercel.app. Não houve login ou mutação remota por este chat.
- Relatório enviado ao orquestrador com 28085f8 e pendências; ele possui autorização para revisão/merge/deploy. Frontend não publicou nem alterou main.

## Atualização do orquestrador — aguardando deploy

- Orquestrador confirmou integração de28085f8+018af5a na main1b2416c e repetiu build,20unitários e22browser com sucesso. DATA_MODE=api configurado; deploy frontend iniciado, ainda sem confirmação READY/HTTP neste chat.
- Redeploy API e6731f5 anunciado, com MEDIA_UPLOAD_ENABLED defaultfalse enquanto não há worker ativo. Não anunciar upload disponível nem fazer mutação real.
- Próxima ação autorizada: aguardar confirmação READY/HTTP e pedido do orquestrador, então checar visualmente consulta pública real. Admin/hostworker permanecem pendentes.

## Em andamento

- Commit/push deste checkpoint e conferência final de Git/remoto.
- Depois: aguardar coordenação do orquestrador sobre ativação do modo API e validação com conta/worker reais. Nenhuma implementação parcial restante neste worktree.

## Retomar daqui

1. Ler AGENTS/guia/checkpoints, conferir git status/branch/log/remotos; não sobrescrever alterações ou trocar branch. Npm nesta pasta frontend/ ou --prefix frontend.
2. Conferir se este checkpoint foi enviado além de 28085f8; comunicar SHA real do checkpoint na entrega.
3. Consultar status atual com orquestrador: se integrou28085f8, ativou VITE_DATA_MODE=api e publicou. Não presumir que publicação/configuração aconteceu durante a pausa.
4. Com autorização/ambiente pronto, validar frontend publicado e consulta real no browser, depois login administrador/403. Não solicitar senha em chat nem criar credenciais.
5. Quando worker/Storage estiverem prontos, validar upload MP4 real de até20s,complete/processamento/publicação/playback/seek/renovação e consulta em outro dispositivo. Registrar resultado separado dos testes controlados. Importadores continuam desabilitados.

## Decisões e contrato

- VITE_DATA_MODE=demo|api. Demo é padrão sem modo explícito; API incompleta mostra erro, sem fallback. API vazia/503 nunca usa fixtures.
- Env confirmadas ao orquestrador: VITE_API_URL=https://pcdnades-api.vercel.app/api/v1, VITE_SUPABASE_URL=https://kdyzxxgzvgiffluyjjxu.supabase.co e VITE_SUPABASE_PUBLISHABLE_KEY sb_publishable_. Nenhuma chave real ou .env existe neste worktree. Nunca inserir service role/secret/senha/URL assinada no Git ou checkpoint.
- SDK Supabase2.118.0 exato em chunk dinâmico; localStorage apenas para sessão gerida pelo SDK, jamais fonte de granadas. Backend valida admin em toda escrita. Não confiar em user_metadata para autorização.
- API /api/v1,data/pagination; POST/PATCH videoId ready. UploadSession mediaId/upload(protocol,url,path,token)/limits; bucket videos-staging. Assinatura de upload validada contra origin Supabase configurada. GET media admin; playback público só vinculado a granada publicada; expiresAt renovado.
- Capabilities é autoridade dos limites, teto do usuário20s nunca relaxado. Importadores inicialmente false/PLATFORM_UNSUPPORTED. Sem download no navegador ou embed substituto.
- Retomada de job existe na mesma janela do formulário; parar acompanhamento não cancela job. Fechar janela perde vínculo local; limpeza de mídia órfã é do backend. Não publicar se processamento falhar nem substituir vídeo anterior antes do sucesso.
- Mapas: mirage/inferno/ancient; /maps/{id}.svg na origem FRONTEND,1024×1024, coordinateVersion setpos-{id}-ba5f793. Artwork CC BY4.0 snapshot ba5f793883e1ce13076dd6919aa1601099c247cf de23/10, integral/sem giro. Crédito/limitações em public/maps/ATTRIBUTION.md. Fixtures fictícias somente demo.

## Validação

- Executado final: npm test20/20; npm run build (typecheck incluso); npm run test:browser22/22; npm audit zero; git diff --check sem erros. QA de API controla Auth/HTTP/Storage e usa vídeo sintético via HTTP local com Range. Não chamar de E2E real.
- O primeiro mock de vídeo não suportava Range e impedia seek: fixture passou ao HTTP local do Vite. Teste de renovação usa contador de base para não confundir dupla montagem StrictMode com renovação real; aguarda timer/novaURL e confere posição.
- Verificação real executada: GET públicos/cors descritos acima. Pendente: auth/admin/RLS real pelo frontend, upload/storage/worker, playback assinado e persistência entre dispositivos/Safari/iOS. Capabilities anunciar upload não comprova worker hospedado.
- Relatório detalhado: frontend/docs/verification.md; configuração/arquitetura: frontend/README.md; testes API: frontend/tests/browser/api.spec.ts.

## Bloqueios e dependências

- Nenhum bloqueio de código para revisão/integração. Não publicar por este chat.
- Conta admin será criada pelo usuário e autorizada pelo orquestrador. Worker ainda sem host, conforme última mensagem. Sem validação ponta a ponta de mídia.
- Orquestrador gerencia Supabase/schema/env/deploy, backend gerencia serviço/worker. Não editar worktree ou checkpoint alheio.

## Histórico curto

- 28/10: primeira prévia e plantas licenciadas, até3c220c3.
- 29/10:8890331 checkpoint/push da prévia;fa80ccf adapter+auth+pipeline e checkpoint.
- 29/10:28085f8 correçãofetch+retomada e22testesbrowser enviados; leituraHTTPreal200 confirmada; fechamento deste checkpoint para revisão do orquestrador.
