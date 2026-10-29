# Checkpoint — frontend

Atualizado em: 29/10/2026 07:59, America/Sao_Paulo
Estado: em andamento — adaptador/API e telas implementados; QA controlado de API no navegador é próximo passo

## Objetivo e pedido atual

Integração opcional frontend/API autorizada: serviço HTTP por env, Supabase auth, capabilities, upload assinado/complete/polling, publicação somente ready e playback renovável. Não provisionar nem ativar produção. Respostas controladas não são E2E real.

## Localização do trabalho

- Branch feat/frontend, worktree C:/Users/felip/.codex/worktrees/pcdnades-frontend/nadesCs2.
- Base e889e3b. Último código enviado: 3c220c3. Checkpoint de retomada 8890331 enviado. Main do orquestrador já integrou a prévia; não alterei main.
- Agora: commit/push do primeiro incremento API e deste checkpoint. Obter SHA exato via git log após commit, sem autorreferência neste arquivo.
- Alterações atuais: frontend/package{,-lock}.json, frontend/README.md, frontend/.env.example, src/app/App.tsx, src/main.tsx, src/components/Radar.tsx, src/domain/{types,validation,playback}.ts, src/features/admin/{Admin,AuthGate,LineupForm,MediaInput}.tsx, src/features/library/{Library,VideoPlayer}.tsx, src/services/{lineupService,apiClient,apiContracts,apiService,auth,runtime,runtimeConfig,supabaseRuntime}.ts, src/styles.css, tests/{api,pipeline,playback}.test.ts e este checkpoint. Todas serão incluídas no marco. Nenhum .env real.

## Feito

- Prévia anterior enviada: 3c220c3 e checkpoint 8890331. Build/typecheck,10 testes unitários,12 Playwright e audit zero na primeira entrega.
- Cliente API com token só em operações autenticadas, cancelamento/timeouts, erros PT-BR e envelopes v1; sem fallback para fixtures. Runtime demo/API explicitamente separados.
- Configuração API exige VITE_DATA_MODE=api, VITE_API_URL (inclui /api/v1), VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (sb_publishable_). Demo é padrão sem modo explícito; api incompleta falha em vez de carregar demo. Nenhum segredo/serviço criado.
- Auth Supabase (SDK versão exata 2.118.0) com login/sair/sessão renovável; privilégios sempre no backend. SDK em chunk dinâmico apenas no modo API.
- Adapter de mapas/granadas paginadas/capabilities, MP4 assinado/complete/polling3s, publicação só ready, erro preserva registro anterior, reuso de tarefa na mesma janela após interrupção/falha de publicação.
- Formulário mostra status real sem porcentagem inventada; pode parar/retomar acompanhamento de queued/processing (não cancela job no servidor). Prévia local só antes de publicar; playback remoto somente vinculado a granada publicada.
- Player renova URL antes da expiração, tenta preservar posição/estado e exibe retry em erro. Nunca embed.
- 20 testes unitários/serviço controlados passaram; build/typecheck passaram. 12 testes demo Playwright passaram após ligar o novo runtime. Esses resultados não validam Storage/Auth/worker reais.

## Em andamento

- Preparar QA de navegador no modo API com rotas HTTP/Supabase/storage controladas: login, capacidades, upload/poll/publicação, playback/renovação, erro sem fallback e autorização negada.
- Atualizar documentação/verificação e revisar screenshots de modo API desktop/mobile. Não ativar produção.

## Retomar daqui

1. Conferir AGENTS/guia/checkpoints, git status/branch/log e remoto. Trabalhar apenas neste worktree em frontend/ e docs/continuity/frontend.md.
2. Conferir SHA/push do marco API. Rodar npm --prefix frontend test/build se necessário.
3. Adicionar testes browser de API em porta5175 separada da demo5174; env de teste deve ser fictícia e rotas interceptadas, nunca usar credenciais reais nem mutar produção.
4. Corrigir problemas, executar unitários/build/typecheck/browser/audit, atualizar checkpoint e commit/push por marco.
5. Pedir revisão ao orquestrador via mensagem autorizada antes de integrar/ativar API. Publicação é dele.

## Decisões e contrato

- 20s é teto do usuário; capabilities controla tamanho/duração, sem relaxar20s. Importadores inicialmente false/PLATFORM_UNSUPPORTED. Sem download no navegador nem embed.
- /api/v1; respostas data/pagination. Supabase Bearer em escrita. UploadSession mediaId/upload(protocol,url,path,token)/limits; bucket videos-staging. GET media admin; playback público só após publicação; URL com expiresAt.
- Catálogo enviado ao orquestrador/backend: mirage/inferno/ancient, /maps/{id}.svg na origem do FRONTEND,1024×1024, coordinateVersion setpos-{id}-ba5f793. CC BY4.0 artwork snapshot ba5f793883e1ce13076dd6919aa1601099c247cf; integral/sem giro. Fonte/versão/crédito em public/maps.
- API alvo anunciada pelo orquestrador: https://pcdnades-api.vercel.app/api/v1. Projeto Supabase criado por ele; URL oficial informada https://kdyzxxgzvgiffluyjjxu.supabase.co. Não há env real neste worktree.
- Orquestrador avisou que API ainda retorna503 para mapas enquanto configuração está pendente. Manter deploy em demo até autorização dele de API healthy.

## Validação

- Executado neste marco: npm test20/20; npm run build/typecheck; npm run test:browser12/12 (somente demo); git diff --check sem erros. Cliente/pipeline testados com fetch/SDK transportes controlados.
- Pendente: QA browser do modo API controlado, APIhealthy/CORS, auth/RLS real, Storage/worker, upload/playback/renovação reais e persistência entre dispositivos. Sem alegação E2E real.
- Prettier formatou src/tests; tentativa de formatar .env.example foi recusada por ausência de parser, arquivo preservado corretamente. Npm deve rodar em frontend/ ou --prefix frontend (não há package.json na raiz).

## Bloqueios e dependências

- Nenhum bloqueio para testes controlados. API remota/credenciais/worker são responsabilidade coordenada pelo orquestrador; não inventar nem provisionar.
- Não alterar backend, raiz, main ou worktree de outro chat.

## Histórico curto

- 28/10: 056eea8 biblioteca/radar; e3b66c0 plantas licenciadas;953a2ad CRUDdemo;f124ac6 checkpoint;3c220c3 testes/20s/SPA/docs.
- 29/10: 8890331 retomada e push da prévia; orquestrador confirmou integração e testes próprios. Primeiro incremento API agora em verificação/push, ainda sem ativação remota.
