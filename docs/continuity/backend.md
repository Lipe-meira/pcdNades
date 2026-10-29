# Checkpoint — backend

Atualizado em: 29/10/2026, America/Sao_Paulo.
Estado: em andamento; retomada autorizada para seed e correções upload/fila/worker.

## Objetivo e pedido atual

Manter backend pcdNades em TypeScript/Fastify/PostgreSQL/Supabase. Pedido atual: registrar continuidade obrigatória em disco, seguindo AGENTS.md e template lidos em origin/main (d8c643b). Atualizar este checkpoint ao iniciar, concluir marcos, aguardar ou encerrar tarefas futuras.

## Localização do trabalho

- Branch: feat/backend.
- Worktree: C:\Users\felip\.codex\worktrees\pcdnades-backend\nadesCs2.
- Base: e889e3b36604b57bfa6a7412df57eb9b2c93a494, origin/docs/visao-projeto.
- Último commit de implementação: c50a3f2 (teto de 20 segundos).
- Push: c50a3f2 confirmado em origin/feat/backend; checkpoint será enviado em commit docs próprio (obter SHA pelo Git para evitar autorreferência).
- Mudanças sem commit ao escrever: somente docs/continuity/backend.md, criado nesta tarefa; nenhum código pendente localmente.
- Propriedade autorizada: backend/ e este checkpoint. Não alterar frontend, raiz ou checkpoint de outro chat. AGENTS/template lidos via git show origin/main, sem merge ou troca de branch.

## Feito

- Estrutura API em backend/src/app.ts, modelos/validação em model.ts e servidor em server.ts.
- API de mapas e CRUD granadas com filtros e target x/y normalizados [0,1]. Auth via token Supabase e RPC is_admin; leitura pública provisória.
- Migration backend/migrations/001_initial.sql com tabelas mapas, granadas, mídia, administradores privados, constraints e RLS. Não aplicada em serviço real.
- Sessão de upload privado assinado, status administrativo, fila persistida e playback assinado para vídeo ready publicado.
- Worker batch em backend/src/worker.ts: claim SKIP LOCKED/lease, ffprobe/FFmpeg, armazenamento de saída e erro de processamento. Exige scheduler e ambiente próprio.
- Importadores em backend/src/importers.ts são interfaces/adaptadores indisponíveis; POST imports retorna PLATFORM_UNSUPPORTED. Não baixam arquivos e não substituem por embed.
- Configuração única em backend/src/config.ts; capabilities/upload/worker compartilham limites validados. Duração default e teto absoluto: 20s. Tamanho default: 50.000.000 bytes.
- backend/.env.example sem segredos e contrato/execução em backend/README.md.

## Em andamento

- Nenhuma alteração de produto em execução. Registrando checkpoint para retomar com estado real.
- Supabase/Storage e FFmpeg não provisionados/testados. Não declarar upload, processamento ou persistência entre dispositivos operacionais.

## Retomar daqui

1. Ler AGENTS.md, docs/continuity/README.md, checkpoint do orquestrador e este; quando ausentes nesta branch, usar git show origin/main:<caminho>. Executar git status --short --branch e git log -5 --oneline, confirmar remoto sem sobrescrever trabalho.
2. Confirmar próxima tarefa com orquestrador e atualizar este checkpoint antes de editar. Sem provisionamento autorizado atualmente.
3. Obter catálogo de mapas/radares canônicos do frontend (setposgg, CC BY 4.0) e alinhar seed/IDs/caminhos; não semear URLs arbitrárias.
4. Revisar backend antes de integração real: ampliar testes de autenticação/CRUD/worker, recuperação e idempotência; reconciliar órfãos e quotas. Testes atuais são locais, não cobertura integral.
5. Quando ambiente for autorizado/configurado, aplicar migration em Supabase descartável e testar RLS anônimo/usuário/admin, MP4 real, worker FFmpeg, playback/seek/renovação PC/mobile e persistência em dois clientes.

## Decisões e contrato

- Confirmado: stack TS/Fastify/Postgres/Supabase; MP4 armazenado; duração máxima 20 segundos definida pelo usuário; apenas branches próprias com commits convencionais PT-BR.
- Provisório: leitura pública e escrita administrativa; privacidade ainda depende de confirmação.
- Contrato v1 alinhado com orquestrador: /api/v1; {data}, listas com pagination; escrita videoId ready, leitura video aninhado; mapas com radar imageUrl,width,height,coordinateVersion.
- Playback {data:{url,expiresAt,mimeType}}; URLs assinadas não são referências permanentes. Arquivos nunca no Git.
- Importação Shorts/TikTok desejada, mas não validada nem funcional; depende de método permitido e evidência no host.
- MEDIA_MAX_BYTES e MEDIA_MAX_DURATION_SECONDS devem coincidir em API/worker; env não altera limite do bucket/plano Supabase. Duração acima de 20 impede startup.

## Validação

- No c50a3f2: npm --prefix backend run typecheck, npm --prefix backend test (8 testes), npm --prefix backend run build, git diff --check: passaram.
- Testes verificam configuração/defaults/env inválida/teto 20, capabilities, coordenadas/campos inválidos e falha fechada sem credenciais. Não demonstram CRUD/RLS reais.
- Nesta tarefa docs: Git/fetch/status e leitura de instruções; verificar diff antes do commit. Nenhum teste de código repetido pois só checkpoint mudou.
- Não executado: migrations/RLS e mídia reais, integração frontend/backend, FFmpeg, recuperação, quotas, seek/mobile.

## Bloqueios e dependências

- Sem credenciais/ambiente Supabase; não solicitar tokens em texto nem versionar .env.
- Worker requer FFmpeg/ffprobe e hospedagem/scheduler; frontend Vercel não hospeda esse processo.
- Bucket inicial 50MB precisa alinhamento operacional se limite de tamanho mudar.
- Falhas conhecidas/limites da primeira versão: limpeza/reconciliação de órfãos ainda pendente; testes de concorrência/lease e idempotência insuficientes; jobs com tentativas esgotadas precisam revisão; API ainda precisa testes de autorização/CRUD reais e catálogo seed.
- Nenhum deploy backend ou PR criado por este chat. Deploy demo frontend é responsabilidade do orquestrador; não comprova integração.

## Entrega e histórico curto

- 25b5741: estrutura e migration com autorização.
- 7500079: API e pipeline inicial de mídia.
- 8904118 e f5e26f6: adaptadores/CORS/testes e formatação.
- 68d01d4: limites únicos configuráveis/validados.
- c50a3f2: teto de vídeo 20s, 8 testes locais passaram; push confirmado.
- 28/10/2026: checkpoint criado seguindo regra de continuidade de origin/main; somente docs/continuity/backend.md alterado nesta tarefa.

## Marco de retomada 29/10
- Git limpo em 00c97cb no início; fetch e checkpoints lidos. Próximo: conferir tipos/catálogo frontend e enviar achados antes de alterar fluxo. Autorizado seed e correções locais/testes; sem provisionamento.


## Marco implementado 29/10 — revisão local
- Feito: seed 002_maps.sql (mirage/inferno/ancient); coordinateVersion string alinhada ao front; FRONTEND_URL resolve imagem para origem absoluta. complete verifica objeto/tamanho e é idempotente em queued/processing/ready.
- Worker: streaming limitado/timeout, reinspeção saída, chaves por tentativa e atualizações condicionadas a tentativa/lease; expired attempts>=3 vira failed. Fontes mantidas para recuperação; reconciliação/limpeza continuam pendentes.
- Verificações: 10 testes locais passaram, typecheck e build passaram. Testes novos cobrem mapas e transferência limitada com fetch substituído, não provam Storage/SQL/FFmpeg reais. diff check detectou linha vazia no checkpoint e será corrigida antes do commit.
- Estado: alterações prontas para revisão local, sem remoto aplicado. Próxima ação: revisar cobertura de complete/autorização e worker com dependências injetadas, depois testar ambiente real quando autorizado. Testes de concorrência PostgreSQL continuam pendentes.
- Arquivos desta etapa: backend/migrations/002_maps.sql, src/maps.ts, src/transfer.ts, src/app.ts, src/worker.ts, tests/maps.test.ts, tests/transfer.test.ts, .env.example, README.md e este checkpoint; serão commitados/push na feat/backend. Sem alterações em frontend/raiz.

## Revisão SQL antes da provisão — em andamento
- Projeto dedicado criado pelo orquestrador, que fará aplicação remota. Este chat não executará SQL remoto.
- Próxima ação: endurecer RPC admin/private RLS e transições de mídia em 001_initial.sql ainda não aplicada; 002 seed permanece. Orquestrador avisado para aguardar SHA final.

## Marco SQL pronto para revisão — 29/10
- 001_initial.sql revisada antes de aplicação: lookup admin privado DEFINER com uid guard/search_path vazio; RPC público INVOKER/grants authenticated; administrators RLS e grants privados mínimos. Trigger mídia valida transições/lease/metadata ready<=20. 002_maps.sql intacta.
- SQL ainda não executado; não alegar validação de permissões/triggers. Orquestrador deve aplicar 001 e 002 no dedicado e executar advisors e testes SQL por papel.
- Próxima ação: entregar SHA e aguardar resultados da revisão/aplicação do orquestrador. Atualizações código/SQL somente locais até commit desta etapa. Limites reais de Storage/FFmpeg ainda pendentes.

## Conferência final do SQL — 29/10
- SHA SQL final enviado: b8ce041. Orquestrador aceitou plano; main integrada até 258b4ae, sem incorporar main neste worktree.
- Revisão estática: processing->processing permitido para retomada/stage, processing->failed permitido para erro/expiração esgotada; ready exige metadata, awaiting_upload/queued/processing não exigem metadata da fonte. Lease deve existir somente processing. Fencing permanece no WHERE do worker (attempts/status/lease).
- Não há execução SQL local/remota nesta checagem; transições, permissões e trigger precisam de teste real pelo orquestrador no projeto dedicado antes de declarar validados.
- Estado: aguardando revisão/aplicação e resultados SQL do orquestrador. Próxima ação executável: conferir git status/log e resposta do orquestrador; se houver falha, reproduzir e corrigir em nova migration coordenada, nunca reescrever migration aplicada.

## Início preparação Vercel — 29/10
- Orquestrador reportou 001/002 aplicadas e smoke SQL transacional real (anon/viewer/admin/estados) com rollback; advisors somente INFO deny em administrators. Não representa teste de arquivos Storage.
- Não editar migrations aplicadas. Próximo: entrypoint nativo Fastify (documentação Vercel consultada), separar fábrica para evitar detecção ambígua; docs/env e testes complete/auth. Nenhum deploy autorizado neste chat.

## Marco Vercel preparado — 29/10
- src/app.ts renomeado para src/application.ts: fábrica sem detecção ambígua; src/server.ts único entrypoint nativo. vercel.json framework fastify; docs Root Directory/backend/env/worker separado.
- 13 testes locais, typecheck/build/diff check passaram. Novos testes HTTP com clientes substituídos verificam 401/403 e complete repetido queued/processing/ready. Primeira execução falhou por estado do stub compartilhado, corrigido; não é validação Storage real.
- Não executado vercel build/deploy. Próximo: orquestrador integrar SHA e validar preview com env. Host do worker ainda precisa decisão. API continua exigindo trio URL/publishable/service role para todos endpoints dependentes de fornecedor; separação leitura sem secret sugerida pelo orquestrador não incluída neste marco.
- Projeto API criado pelo orquestrador; credenciais server-only serão configuradas pelo usuário diretamente no host. Não há segredo neste checkpoint. 001/002 aplicadas pelo orquestrador e smoke SQL real reportado anteriormente; Storage/FFmpeg permanecem sem validação.

## Início container worker — 29/10
- Pedido: Dockerfile/.dockerignore, operação batch/scheduler e fixture sintética FFmpeg local sem Supabase.
- Git limpo em 8eccb63. Docker/ffmpeg/ffprobe encontrados no PATH; próxima ação executar fixture sintética em diretório temporário e preparar container sem segredos. Não instalar sistema nem publicar imagem.

## Marco worker local — em andamento
- Dockerfile multi-stage não-root e .dockerignore criados; WORKER.md documenta batch, scheduler sem sobreposição, env/segredos e host proposto para time pequeno.
- Smoke FFmpeg sintético local passou: 2s,17446 bytes,H264/AAC,faststart; sem rede/banco/Storage. Script scripts/media-smoke.mjs remove fixtures temporárias.
- 13 testes/typecheck/build passaram. Docker build em andamento na sessão69159; ainda não declarar imagem pronta. Nenhum pacote instalado no Windows, dependências FFmpeg somente dentro da imagem.
- Próxima ação: aguardar build e testar smoke no container sem rede, depois commit/push/checkpoint. Hospedagem/credenciais/Storage real continuam pendentes.

## Correção urgente entrypoint — 29/10
- Falha real de detecção Vercel reportada pelo orquestrador: server não importava Fastify diretamente.
- Corrigido: server importa/instancia Fastify e chama configureApp compartilhado; buildApp dos testes usa configureApp, sem import morto. 13 testes, typecheck e build passaram; deploy será repetido pelo orquestrador, não comprovado aqui.
- Container/Dockerfile/WORKER.md/script continuam alterações locais separadas, build Docker sessão69159 ainda precisa conferência. Próxima ação após enviar correção: aguardar resultado deploy e retomar container. Não incluir arquivos de worker neste commit urgente.
