# Checkpoint — backend

Atualizado em: 29/10/2026, America/Sao_Paulo.
Estado: API pública validada por HTTP; aguardando admin e host/configuração worker para QA de mídia.

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

## Marco worker concluído localmente — 29/10
- Build Docker sessão69159 terminou exit0, imagem local pcdnades-worker:local. Smoke sintético no container --network none/read-only/tmpfs256m/memory1g/cpus1 passou:2.021s,23179bytes,H264/AAC,faststart. Windows smoke anterior:2s,17446bytes. Nenhuma fixture/segredo versionada.
- Arquivos entregues: backend/Dockerfile,.dockerignore,WORKER.md,scripts/media-smoke.mjs. Não-root,multi-stage,comando batch node dist/worker.js. Nenhuma instância persistente/registry/remoto.
- Proposta para host pequeno: job Docker em host existente/servidor pequeno, scheduler1min sem sobreposição, segredos pelo host; não provisionado. Custo/host e DATABASE_URL aguardam decisão/configuração.
- Verificações código já passaram neste marco (13 testes/typecheck/build); Docker build e smoke adicionais reais locais, sem SQL/Storage/E2E. Próxima ação: revisar integração API pelo orquestrador e definir host/credenciais worker; depois teste real completo autorizado. Reconciliação/quotas continuam pendentes.
- Checkpoint e arquivos worker serão enviados juntos na feat/backend; nenhum arquivo local restante esperado após commit. SHA desta entrega deve ser obtido no Git, sem autorreferência.

## Investigação bootstrap Vercel — em andamento 29/10
- Orquestrador reportou build READY mas /health e capabilities500/timeout (~60s), sem logs úteis. API NÃO saudável.
- Hipótese a investigar: top-level await no listen em server.ts e interceptação nativa Vercel. Próximo: comparar fonte/exemplo oficial e testar entrada local, sem assumir causalidade ou alterações aleatórias. Não mexer env/migrations.

## Bootstrap investigado e corrigido — 29/10
- Evidência fonte Vercel serverless-handler.mts: intercepta Server.listen retornando this sem listening durante await import. Repro local com stub real http.Server.listen: antes moduleEvaluated=false/listenCaptured=true após1.5s.
- Mudança mínima server.ts remove top-level await (void listen com catch). Repro após: módulo avaliado e listen capturado; 13 testes/typecheck/build passam. Script backend/scripts/bootstrap-smoke.mjs sem rede reproduz contrato loader.
- Próximo: enviar SHA para redeploy/HTTP real pelo orquestrador. API ainda não declarada saudável; nenhum ajuste env/SQL. Registro em README e checkpoint; sem arquivos de mídia/segredos.

## Redeploy informado pelo usuário — HTTP real 29/10
- Verificado https://pcdnades-api.vercel.app: /health200 {status:ok,configured:false}; capabilities200 upload.enabled=false, limite20s, importadores false; /api/v1/maps503 SERVICE_UNAVAILABLE.
- Bootstrap agora responde; configuração do fornecedor permanece incompleta neste deployment. Não inferir chave faltante específica: configured exige URL+publishable+service role. Nenhum segredo lido.
- Próxima ação: orquestrador confirmar SHA/ambiente e presença das três variáveis no deployment, sem enviar valores no chat. Persistência/upload ainda não operacionais. Sem mudança de código nesta etapa.

## API configurada e leitura real confirmada — 29/10
- Orquestrador reportou deploy dpl_AQtb95WHtEYpcmgTbWLCHbPVZNqb, commit7793aeb, trio de env no destino correto e remoção da key do frontend (somente metadados, nenhum valor lido).
- Este chat verificou HTTP independente: health200 configured:true; maps200 com3 radares canônicos/URLs absolutas frontend; grenades200 biblioteca vazia/pagination total0; capabilities200 upload.enabled:true,maxDurationSeconds20,importersfalse.
- Isso comprova bootstrap/configuração e leitura pública, NÃO upload/processamento/E2E. Capabilities habilitado não comprova worker operacional.
- Nenhuma mutação/usuário criado. Admin será criado pelo usuário no painel e concedido pelo orquestrador; não registrar senhas. Host Docker/scheduler, DATABASE_URL e secrets do worker continuam pendentes.
- Próxima ação: aguardar QA integração/review ou definição host pelo orquestrador, reler checkpoint/conferir Git antes de executar. Nenhuma mudança de código necessária agora. Checkpoint enviado em commit docs próprio; sem alterações locais restantes após push.

## Início guard operacional upload — 29/10
- Pedido orquestrador: MEDIA_UPLOAD_ENABLED defaultfalse/bool estrito; capabilities e novas sessões devem depender da flag e clients. Auth antes guard preserva401. Leitura/status/playback inalterados.
- Git limpo em c4a6f80; próximo editar config/API, testar admin sem Storage quando false e disponibilidade true apenas com clients. Sem mudança remota/env.

## Guard operacional upload entregue — 29/10
- MEDIA_UPLOAD_ENABLED estrita true/false defaultfalse, API capabilities exige flag+clients; criação sessão autentica antes de retornar503 UPLOAD_UNAVAILABLE, sem gravar DB/Storage. Leituras/status/complete/playback preservados.
- 16 testes locais/typecheck/build/diff check passaram. Testes com admin substituído garantem zero acesso Storage/DB quando flagfalse e401 sem token; flagtrue exige clients. Não comprova integração Storage.
- Env/example e README documentam habilitar apenas após worker testado; nenhuma env remota alterada. Próximo: orquestrador integrar/deploy e confirmar capabilitiesfalse; aguardar host/config do worker antes de habilitar. Código/checkpoint enviados em commit próprio; sem mudanças locais esperadas após push.

## Início proposta host automático — 29/10
- Orquestrador confirmou admin concedido pelo root após usuário criar Auth, sem senha lida. Usuário escolheu execução fora do PC; nenhum provedor pago contratado.
- Próxima ação: recomendar scheduler compatível com batch, documentar Render cron vs Actions e parâmetros concretos, sem criar CI raiz. Uploads continuam false até validação real.

## Proposta host pronta — 29/10
- WORKER.md atualizado: Render cron Docker recomendado para batch (1 execução ativa, env managed, schedule5min); custo mínimo oficial US$1/mês, sem contratação/provisão. Parâmetros concretos root backend/CMD/env/checklist documentados.
- Alternativa Actions documentada com5min mínimo, atraso/descarte, default branch/inatividade60dias e CI exclusivo do orquestrador após decisão. Nenhum arquivo .github criado.
- Verificações desta tarefa: documentação oficial Render/GitHub consultada, diff check passou. Só docs; não repetidos testes código ou container, já verificados nos marcos anteriores.
- Próxima ação: aguardar decisão de provedor/custo via orquestrador; depois configurar segredos no host e validar job/fila/Storage real antes de habilitar MEDIA_UPLOAD_ENABLED. Sem valores secretos/usuários/remoto alterados.

## Investigação Render gratuito sob demanda — início29/10
- Orquestrador descartou Actions produtivo após termos oficiais; NÃO criar workflow ou hospedar processamento de usuários em runners Actions.
- Nova tarefa somente proposta: Render Free HTTP autenticado acordado após complete, lifecycle/fila/512MB. Próxima ação: verificar docs oficiais e reportar limites antes de arquitetura/código. Raiz/.github intactas.

## Proposta gratuita revisada — 29/10
- Actions produtivo retirado por termos conforme orquestrador. Render Free sob demanda avaliado somente documentalmente; não implementado.
- Achado: webhook202 não garante sobrevivência FFmpeg nem recuperação sem novo tráfego; precisa wake durável/retry e controles single-run/fencing/shutdown.512MB não validado pelo smoke1GB anterior. Secret/HMAC proposto sem valores.
- Próxima ação: enviar tradeoffs e aguardar alinhamento antes de arquitetura/CI/provisão. Upload continua desabilitado. Diff check de docs, sem testes código novos pois não alterado.

## Investigação validação sem transcode na Vercel — início29/10
- Orquestrador solicitou comparar MP4 compatível validado por ffprobe na Function, sem novo host, com Renderfree webhook. Somente proposta; não implementar nem habilitar upload.
- Próxima ação: conferir limites oficiais Vercel duração/memória/tmp/bundle e documentar tradeoff/ciclo confiável de validação.

## Comparação MVP sem novo host —29/10
- Recomendação enviada: piloto validação síncrona de original MP4 compatível por ffprobe na Function, sem transcode, em vez de webhook Renderfree; depende de spike binário/empacotamento/tempo e confirmação do usuário sobre formatos.
- Fonte oficial FluidHobby300s/2GB/payload4.5MB e bundle250MB consultada; /tmp quota efetiva ainda deve ser confirmada no runtime, sem presumir512MB.
- Só docs mudaram/diffcheck; nenhuma arquitetura implementada/flag habilitada. Próximo: orquestrador decidir aprovação de spike e depois validar bundle+fixture real antes de liberar upload.

## Início implementação inline autorizada —29/10
- Orquestrador autorizou MVP originalMP4 validado na Function, sem transcode/novohost. Flagfalse até revisão/runtime. Plano binário/fixtures, processor REST CAS/lease/deadline, integração complete/tests.
- Próxima ação instalar ffprobe fixado com origem/licença e validar fixtures sintéticas. maxDuration120 proposto; frontend timeout150 sócomplete sob coordenação. Nenhuma migration aplicada será reescrita.

## Marco inline parcial —29/10
- Implementado processor REST CAS/lease2min/tentativas3,deadline110s+finalização5s,download limitado,ffprobe original H264/yuv420p/AACou semáudio,sem transcode. Complete inline aguarda seu claim, concorrente202. Modo env validado/capabilities. Sem migration nova necessária até agora.
- Binário fixado @ffprobe-installer/ffprobe2.1.2, build copia plataforma para vendor; origem/licenças em FFPROBE-NOTICE. ffprobe-static4.0.2 investigado e descartado por antigo; não ficou dependência.
- Smoke real Windows empacotado passou2s/20s,rejeita21s/codecMPEG4/corrompido.21 testes locais passaram antes do último ajuste deadline; repetir typecheck/test/build. Container futuro atualizado COPYscripts, precisa reconstrução pois build agora copia binário.
- Próxima ação: conferir ajuste deadline/fixtures adicionais e smoke Linux do binário em build, docs, commit/push para revisão. Uploadfalse/remoto intocados. Arquivos inline/probe/transfer/config/API/scripts/testes/package/lock/vercel/Docker/docs locais ainda sem commit neste marco.

## Inline pronto para revisão —29/10
- 22 testes locais passaram (inclui concorrência fake, replayready,leaseativa/expirada/tentativas,errocodec). Typecheck/build/bootstrap-smoke passam; entrada semawaitglobal preservada.
- Smoke real binário Windows empacotado: aceita2/20s e rejeita21s,MPEG4,corrompido. Sem Supabase/Storage/E2E. Linux não testado porque Docker daemon npipe indisponível; não iniciar serviço/pagar/provisionar. Bundle/execLinux/Vercel precisa revisão real antes flagtrue.
- Deadline110s+5sfinalização,maxDuration120; timeoutUI150 sócomplete alinhado. Modo/capabilities e flag documentados. Sem migrations novas ou mudanças001/002.
- Próxima ação: orquestrador revisar/envmode/preview e testar binárioLinux/Storage autorizado; só então habilitar flag. Mantidafalse. Dockerfile/.dockerignore ajustados para scripts necessários build, reconstrução pendente.
- Arquivos deste marco serão enviados em commits de binário/config e processamento inline; conferir SHAs no log. Nenhum segredo ou binário em Git (vendor ignorado). Após push não devem restar mudanças locais.

## Build limpo falhou —29/10
- Orquestrador reportou TS18046 inline.checked. Reproduzido com npmciignore-scripts+build no worktree: generic bounded(any) infereunknown e acesso r.error/data falha.
- Próxima ação tipar entrada checked como PromiseLike de envelope data/error, sem cast; repetir build/typecheck/tests/smoke após instalação limpa. Nenhum remoto/config alterado.

## Build limpo corrigido —29/10
- checked<T> agora recebe PromiseLike<{data:T;error:unknown}>, inferência preservada sem cast. Falha anterior confirmada, não era env.
- Após npmciignore-scripts: build/typecheck/22testes/probe-smoke fixturesWindows/bootstrap-smoke/diffcheck passaram. LinuxCI/Vercel/Storage continuam pendentes, flagfalse.
- Próxima ação orquestrador integrar commitcorretivo e executar LinuxCI/runtime. Apenas inline.ts e checkpoint alterados neste incremento; enviar push feat/backend.

## Correção config native/tracing — início29/10
- LinuxCI real passou reportado root run40909575037/e928061. Deployfalhou unused_function emglobsrc/server.ts antesbuild; removerfunctionsconfig, timeout120 definido no projeto pelo root.
- Próxima ação mover probe para runtime dependency e require.resolveliteral porplataforma, confirmar tracingNFT e smoke antespush. Flagfalse intacta; sem wrapper/SQL/envremoto.

## Tracing estático corrigido —29/10
- Removido functions glob inválido do vercel.json; timeout120 será configurado no projeto pelo root. Runtime usa createRequire+require.resolveliteral Linuxx64/win32x64; wrapper fixado movido para dependencies.
- Após npmci: build/typecheck22testes/probe-smokeWindows/diffcheck passam. NFT0.30.4 printdist/server.js incluiu node_modules/@ffprobe-installer/win32-x64/ffprobe.exe; warnings Linuxausente Windows e tentativa de parse doexe comoJS registradas, não ocultadas. CI/root devem conferir traceLinux/bundlefinal; não declarar Vercelvalidado.
- Próxima ação enviar SHA para integraçãoCI+deployflagfalse. Root define timeout projeto. Nenhumwrapper/SQL/envremoto. vendor inspeção continua mas caminho runtime não depende dele/includeFiles.

## CI Linux permissão executável — início29/10
- Root reportou run40910741421: tracing inclui assetLinux, mas X_OK falhou EACCES no original node_modules; prepare chmod somente cópia vendor.
- Próxima ação chmod explícito binary.path no build alémcópia, mantendo npmciignore-scripts. Sem scriptsglobais/env/SQL. ValidaçãoLinux será pelo CIroot, não Windows.
- Correção aplicada: await chmod(binary.path,0o755) antes da cópia, somente binário selecionado explicitamente. Build/typecheck22testes/diffcheck locais passaram; Windows não prova permissãoPOSIX, repetir LinuxCIroot. Próximo enviarSHA e aguardar X_OK/probe noLinux, flagfalse.

## Pausa solicitada pelo usuário —29/10
- Usuário pediu parar alterações quando houver versão utilizável para testar. Orquestrador finaliza publicação inline e liberação controlada; este chat NÃO inicia melhorias/features/testes amplos. Corrigir somente bloqueio concreto se solicitado.
- Último código enviado e322fe2: chmod originalffprobe; estado anterior local22testes/build/typecheck passavam. LinuxCI/URLfinal/liberaçãoupload ainda precisam confirmação do orquestrador, não presumir sucesso.
- Limitações: somenteMP4H264/yuv420p/AACousemáudio20s/50MB; sem reconversão/importadores. ffprobe não decodeintegral; Storage/E2E e runtimefinal dependem QAcoordenado. Dockerworker permanece futuro, não necessário noinline. Nenhum segredo/conta/env alterado neste marco.
- Estado: aguardando confirmação URLpronta pelo orquestrador, depois implementação pausada por pedido explícito para usuário testar. Próxima ação: ler checkpoint+conferirGit e aguardar relato/testes; não continuar backlog automaticamente.
- Alteração desta tarefa somente checkpoint, commit/push docs na feat/backend; não repetidos testes pois código intacto.

## Publicação confirmada; implementação pausada —29/10
- Orquestrador confirmou API deploy dpl_8f87KGm2zcH1wocmnp2T1FuBY5wz READY,código1a1dec2; health200/configuredtrue,capabilities200/uploadtrue/inline-original/20s/50MB. Resultado reportado pelo root, não retestado aqui conforme pausa.
- Front publicado https://pcdnades.vercel.app ; usuário assume teste real. NÃO afirmar E2Eremoto/uploadcompletovalidado.
- Trabalho PAUSADO por pedido explícito do usuário: não iniciar alterações,deploys,testes ou backlog. Próxima ação é aguardar feedback; ao retomar ler checkpoints/conferirGit e agir somente no escopo solicitado.
- Apenas preservação deste checkpoint neste marco, sem código/env/remoto de aplicação. Commitdocs próprio enviado na feat/backend.

## Bloqueio pontual DATABASE_ERROR — investigação autorizada29/10
- Pausa geral mantida; somente diagnóstico/correção bloqueio solicitado pelo orquestrador. Screenshot Nova granada DATABASE_ERROR; root logPOST/media/uploads503 antesbytes,media/grenadesvazios. SQLservice_roleinsert+rollback passou conforme root, sem confirmação causaREST/key.
- Código checked atualmente mascara erro retornado por insert; não altera RLS/grants sem evidência. Nenhuma mudança de aplicação feita nesta etapa.
- Próxima ação aguardar logsSupabase/root, propor logger estruturado só códigoDB allowlist (sem payloadheaderskeysSQL/mensagembruta) e testecliente substituído se autorizado. Não continuar melhorias/testesamplos. Formulário deve ser preservado pelo frontend.
