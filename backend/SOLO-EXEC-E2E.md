# Solo Exec — integração local real (01/11/2026)

Resultado: PASS para o fluxo testado no backend da branch `codex/solo-e2e`, base `6bb5f17`. A stack exclusiva `pcdnades-solo-e2e-20261101` usa Auth/REST/Storage em `127.0.0.1:56421` e Postgres em `127.0.0.1:56422`. Cinco containers próprios foram criados e permaneceram ativos; projetos, volumes e containers anteriores não foram removidos nem modificados. Nenhuma conexão com produção. As migrations locais foram aplicadas em ordem: 001, 002, 003, 004, `20261030124528_tiktok_import_sessions.sql` e `20261101152756_solo_exec_destinations.sql`. Nenhuma migration foi aplicada remotamente.

O ensaio criou dois usuários descartáveis no Auth local (admin e usuário comum), cadastrou o admin no banco local e rodou o servidor Fastify com `inject`; todas as chamadas de Auth, PostgREST, SQL e Storage utilizaram a stack Supabase real local:

- Upload MP4 de fixture pelo fluxo de URL assinada, validação inline real e estado `ready`.
- Criação, leitura anônima e filtro de Solo Exec com uma origem e dois destinos tipados.
- Edição parcial preservando destinos; PATCH inconsistente rejeitado com HTTP 400.
- Conversão Solo → smoke → Solo, preservando o vídeo e os destinos informados.
- Tentativa de gravação sem login 401 e usuário comum 403; tentativa de exclusão por usuário comum 403.
- Exclusão apenas da fixture Solo criada nesta execução; seu GET retornou 404.
- Cadastro tradicional de comparação permaneceu acessível, com destino e referência de vídeo preservados.
- Reprodução pela API existente gerou URL assinada local, HTTP 200, e os bytes retornados tiveram hash igual ao MP4 enviado. O vídeo e a fixture tradicional criados neste teste foram preservados.

Evidências privadas locais (não versionar ou imprimir): `backend/vendor/solo-e2e-20261101/`. Scripts `bootstrap.mjs` e `solo-e2e.mjs` verificam explicitamente host e portas locais antes das escritas. `status.private.json` contém configuração descartável e `users.private.json` contém usuários descartáveis; os arquivos são ignorados pelo Git. Não executar bootstrap novamente em um banco existente; não repetir o teste sem considerar que ele cria novas fixtures. Para continuar, ler os arquivos de configuração em memória, jamais imprimir segredos nem URLs assinadas. O ensaio validou bytes reproduzíveis, não abriu o player em navegador; os testes Playwright anteriores usam API simulada. Não prova Vercel ou produção.

Pendências: integração combinada com Reels/prévia após os agentes concluírem; execução de regressão completa na dev integrada; renovação de URL quando aplicável; aprovação e plano de publicação antes de qualquer migration remota. A stack local foi disponibilizada aos outros agentes sem interrompê-la.
