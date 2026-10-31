# Integração TikTok: validação local e próxima autorização

Atualizado em31/10/2026. Branchdev; mudanças e commits desta entrega são **somente locais**. Nenhum push, merge, deploy, criação de infraestrutura ou escrita remota foi executado. A importação continua desabilitada por padrão.

## Resultado por camada

| Camada | Evidência desta retomada | Limite da conclusão |
| --- | --- | --- |
| Download TikTok e recorte | Teste real anterior documentado em IMPORT-AUDIT.md, código preservado | Nenhum novo download TikTok nesta retomada; não garante qualquer link |
| Download/recorte local | yt-dlp e FFmpeg reais; fonte HTTP200 sem Range; corte10..20 ->10s H264/yuv420p/AAC, decode integral | Fonte sintética local |
| Envio da saída | SDK Supabase real contra servidor HTTP loopback; um objeto, bytes iguais ao recorte e diferentes da fonte | Servidor substitui Storage; não é Supabase real |
| Reprodução sem fonte | Fonte local passa a responder403; objeto armazenado reobtido, probe10s/decode passam | Sem URL assinada real ou player conectado ao Supabase |
| Banco | PostgreSQL WASM PGlite0.5.13, **34 verificações**,5migrations | Auth/storage são estruturas locais mínimas; sem PostgREST/GoTrue/multiconexão |
| API/processador | **92 testes backend**; ready/falha, idempotência, concorrência, limite, erroStorage, limpeza e endpointplayback | Adaptadores de DB/Storage substituídos nos testes de rotas/processador |
| Frontend | **55 testes unitários,64 testes Playwright** desktop/mobile | API/Auth/Storage controlados; reprodução do MP4 da fixture é real no Chromium |
| Hospedagem | Build/typecheck Windows; NFT encontrou ffprobe/FFmpeg/yt-dlp, hashyt-dlpPASS, sem.env,186.385.981B,9avisos | Não demonstra execução Linux nem Function Vercel |

Os resultados históricos do relatório anterior continuam válidos apenas no seu escopo e data. Testes atuais não foram usados para afirmar Supabase E2E.

## Correções adicionais encontradas nesta revisão

1. `completeImport` convertia `STORAGE_UNAVAILABLE` em `IMPORT_FAILED`. Regressão reproduzida e corrigida; erro permanece sanitizado e nunca publica uma mídia pronta.
2. `storeClip` solicitava assinatura mesmo com sinal já abortado e podia aguardar assinatura indefinidamente após cancelamento. Regressões reproduzidas e corrigidas. Upload recebeAbortSignal, não segue redirects e não fazupsert. Erros de rede/SDK não expõem URL ou resposta bruta.
3. Upload seguido de falha de finalização podia deixar objeto órfão. A limpeza agora tenta remover **somente a chave desta tentativa** e somente após transiçãofailed confirmada por CAS. O upload/substituição anterior não é removido. Se a resposta deready for ambígua ou a tentativa perder o claim, não se apaga: isso evita excluir um objeto publicado. Testes incluem esse caso.

O SDK usado não ofereceAbortSignal emcreateSignedUploadUrl/remove. O código deixa de aguardar a resposta quando cancelado; a requisição de assinatura/remoção já iniciada pode terminar depois. Resposta tardia de assinatura não inicia upload. Isso não é cancelamento físico do socket do SDK.

Limpeza é best effort com espera limitada: falha deremove, processo encerrado abruptamente ou claim perdido ainda podem deixar órfãos. **Não** há coletor automático por prefixo nem autorização para apagar objetos remotos. Um coletor futuro precisaria de carência, comparação das referências e fencing próprios.

## Preservação e segurança revisadas

- Foram preservados os16arquivosmodificados e6novos da auditoria anterior, inclusive scripts e relatório. O downloader que passou no teste real não foi reescrito nesta retomada.
- `MEDIA_TIKTOK_DOWNLOAD_MODE=temporary` permanece opt-in; default `range`. `MEDIA_TIKTOK_IMPORT_ENABLED=false` permanece default. Não há fallback automático depois403.
- Fonte completa limitada fica apenas temporária; só `clip.mp4` validado chega astoreClip. Idêntico MP4 armazenado pode ser reproduzido sem consultar a origem.
- Rotas administrativas continuam autenticando usuário e verificandoRPCis_admin. Sessões de importação eRPCs ficam exclusivas deservice_role; granadas só aceitam mídiaready por trigger. O bucketvideos-staging é privado,50MB/MIMEMP4.
- SSRF/validaçãoDNS/allowlist/portas, TLS, orçamento, tempo, lease e CAS existentes preservados. Nenhum cookie de conta, chave real, URL assinada real ou saída bruta de extrator foi adicionada aoGit.
- Não foram alteradosYouTube/Instagram, migrations históricas ou credenciais/variáveis de produção. UploadMP4 e edição passaram nos testes existentes.

## Reproduzir o que já foi executado

Na raiz do worktree, PowerShell:

```powershell
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:browser -- --workers=1
& backend/node_modules/.bin/tsx.cmd backend/scripts/import-temporary-smoke.ts
& backend/node_modules/.bin/tsx.cmd backend/scripts/import-relay-smoke.ts
& backend/node_modules/.bin/tsx.cmd backend/scripts/import-transport-smoke.ts
node backend/scripts/import-sql-smoke.mjs
git diff --check
```

Smokes dependem do binário experimental previamente preparado/verificado e dependências instaladas. PGlite foi instalado isoladamente embackend/vendor/sql-test, ignorado peloGit, sem alteração das dependências de produção:

```powershell
npm install --prefix backend/vendor/sql-test --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.13
```

Verificador NFT usa uma instalação isolada já existente de@vercel/nft0.30.4. Executar debackend, apósbuild:

```powershell
node scripts/import-bundle-smoke.mjs "$env:TEMP/pcdnades-nft"
```

Não executar os smokes de plataforma como parte desses testes offline. O script comparativo inclui execução direta sem o isolamento da API e serve exclusivamente a diagnóstico local explicitamente autorizado.

## QA do frontend

Fluxo exercitado: biblioteca/admin → link TikTok → inspeção → horários → complete/acompanhamento → mídiaready → salvar → player compacto/ampliado → renovação de URL. Os testes também bloqueiam publicação pendente/falha e preservam o cadastro anterior na substituição falha.

Ambiente: Vite127.0.0.1:5174demo e127.0.0.1:5175APIcontrolada; Chromium1440x1000 e390x844, verificações adicionais320px. **Browser plugin not available**; usado o Playwright já configurado no repositório. Nenhuma dependência de browser foi instalada. Evidências de DOM/interações/reprodução/renovação/posição/foco/scroll e screenshots estão no fluxo existente;64/64passaram. Não se fez revisão visual manual adicional de todas as telas nem auditoria global de console nesta retomada.

## Próxima etapa: Supabase local real — não executada

DockerDesktop está instalado, porém`docker info` falhou:daemonLinux indisponível. WSL lista apenasdocker-desktop; CLI Supabase/psql não encontrados. Não havia stackSupabaseisolada disponível. Não foi iniciada infraestrutura.

**Aprovação proposta:** iniciar DockerDesktop, preparar uma pasta descartável exclusiva, instalar/usar CLI oficial fixada após consultarhelp, baixar imagens necessárias e iniciar uma stackSupabase local. Criar dados e fazer uploads somente nessa stack; sem tocar no projeto remoto, Vercel ou branches remotas. Isso cria containers/volumes e usa disco/rede locais; não contrata serviço pago. Ainda exige autorização do usuário para criar essa infraestrutura.

Após autorização, executar este procedimento em ordem, verificando antes que todas as URLs sejamloopback e que nenhum comando esteja vinculado a projeto remoto:

1. IniciarDockerDesktop e confirmardaemonLinux. Consultarversão/help daCLI e iniciar stack em pasta exclusiva via`supabase init`/`supabase start` conformehelp. Não usarsupabase link/dbpush/reset remoto nem apontar para projeto produtivo.
2. Usar somente as chaves/portas emitidas por essa stack, em configuração local não versionada. Nunca imprimir status com chaves em logs compartilhados. Aplicar localmente, porSQLdireto na conexão127.0.0.1, os arquivos backend/migrations/001_initial.sql,002_maps.sql,003_media_import_sources_and_40_seconds.sql,004_grenade_origin.sql e20261030124528_tiktok_import_sessions.sql, nesta ordem. A003 contém política90s apesar do nome histórico40. Não renomear/reexecutar histórico num banco existente.
3. Inspecionar grants efetivos/RLS/RPCs noPostgres real; verificarpublic.is_admin, acesso negadoanon/auth às sessões eRPCs, service_role com permissões necessárias, triggergranada_ready e bucketprivado50MB. Fazer consulta real dePostgREST após aplicação para confirmar schemaexposto/cache.
4. Criar usuário descartável somente noAuthlocal, confirmar email e cadastrar seuUUID emprivate.administrators localmente. Autenticar pelo frontend; não registrar senha/token. Nenhuma conta produtiva é necessária.
5. Backendlocal apontado apenas paraSupabaselocal; habilitarTiktok e modotemporary apenas no processo local; preparar binário verificado no buildlocal. Frontendlocal apontado paraAPIlocal eAuthlocal.
6. Com o vídeo autorizado do teste anterior, importar10..20. Registrar somente estágios/código/formato/duração. Confirmar ummediaId e umStoragekey para a mesma sessão/seleção, statesqueued/processing/ready e metadata10s/bytes<=limite. Inspecionar/listar objetos: apenasimport-N.mp4, nunca a fonte integral.
7. Salvar smoke; chamar `/api/v1/media/:id/playback`; validar URL curta assinada e MP4H264/AAC. BloquearTikTok no navegador/retirar acesso à origem, renovar endereço, reproduzir e buscar no vídeo nos modoscompacto/amplo. Não registrarURLsassinadas ou salvar traces de sessões reais.
8. Testar seleção inválida/limite, Storageindisponível, assinaturaexpirada, resposta decomplete perdida, duas solicitações concorrentes e falha na substituição; confirmar cadastro/vídeo anteriores intactos e ausência deready falso.
9. Inspecionar limpeza de temporários e objetos datentativa. Preservar objetos referenciados quando houver respostaambígua. Remover apenas recursos comprovadamente criados pelo teste; parar a stack peloCLI sem comandos de exclusão globais.

Se for escolhidoSupabaseremotoisolado em vez dessa stack, será necessária outra autorização específica para criar/configurar o ambiente, aplicar migrations, criar usuário e enviar o MP4. A autorização atual não permite isso.

## Linux/Vercel e checklist de produção

- [x] Código anterior preservado e revisão/testes locais concluídos.
- [x] Download/recorte TikTok real anterior registrado sem generalizar suporte.
- [x] Storage protocolarSDK/HTTP e playback com fixtures locais verificados.
- [ ] SupabaseAuth/PostgREST/RPC/Storage realisolado, com frontend conectado de verdade.
- [ ] Linuxx64: build das dependências opcionais,ffprobe/FFmpeg/yt-dlp fixados,hash/permissões,execução eNFTrastreados noLinux. Verificador preparado, execuçãoLinux ainda pendente.
- [ ] Medir picoRSS, disco temporário, CPU, encoding90s/alta resolução e prazo completo na hospedagem pretendida. Orçamento de bytes/deadlines não substitui quota rígida doSO.
- [ ] Confirmar110sprocessamento+5sfinalização contra configuração real daFunction. Lease120s não é worker permanente;GETstatus não processa e retomada depende decomplete. Avaliarworker apenas se os tempos/recursos reais exigirem; documentar e autorizar custos antes de provisionar.
- [ ] Validar abandono/kill, órfãos e recuperação real sem excluir vídeos publicados.
- [ ] Aprovação explícita para migrations/configuração/habilitação/publicação e plano de rollback.
- [ ] Integrar/push/deploy somente após conclusão/revisão e autorização; flags continuamoff até lá.

Fontes consultadas: [assinatura de upload](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl), [assinatura de reprodução](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl) e [changelog](https://supabase.com/changelog). A implementação doSDK fixado no lockfile também foi inspecionada para métodos/headers e ausência deAbortSignal nos métodos de assinatura/remoção.

**Conclusão:** máximo local desta etapa entregue; caminho completo TikTok→Supabase real→player ainda não demonstrado. Nenhuma aprovação de produção é inferida dos testes.

## Arquivos e commit local entregue

Implementação e auditoria anterior preservadas em`f7bdbba` (`fix(importacao): valida fluxo temporario e protege armazenamento`).31arquivos revisados; nenhum push. O checkpoint recebe um commit local de documentação posterior para registrar esseSHA. Para inspecionar o diff exato: `git show --stat f7bdbba` e `git show f7bdbba`.

- Pipeline: backend/src/application.ts,clip-storage.ts,import-api.ts,import-network.ts,import-processing.ts,import-runtime.ts,import-temporary.ts,tiktok.ts.
- Testes: backend/tests/clip-storage.test.ts,import-api.test.ts,import-processing.test.ts,import-relay.test.ts,import-temporary.test.ts,playback.test.ts.
- Smokes: backend/scripts/import-bundle-smoke.mjs,import-comparison-smoke.ts,import-native-session-smoke.ts,import-protected-smoke.ts,import-sql-smoke.mjs,import-temporary-smoke.ts.
- Frontend: frontend/src/features/admin/ImportLinkEditor.tsx,LineupForm.tsx e frontend/src/services/apiClient.ts.
- Configuração/documentação: README.md,backend/.env.example,backend/IMPORT-AUDIT.md,IMPORT-VALIDATION.md,IMPORTS.md,README.md,YTDLP-NOTICE.md e docs/continuity/orchestrator.md.

Estado da aprovação: autorização atual usada somente para revisão/edição/testes/commits locais. Preparação da stackDocker/Supabase continua aguardando autorização específica. Nenhuma variável, migration, usuário ou upload remoto foi alterado.
