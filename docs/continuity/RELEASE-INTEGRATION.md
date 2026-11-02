# Integração release — 02/11/2026

Objetivo: reconciliar dev/redesign/backend em branch exclusiva; validar testes integrados e migrations em clone descartável do backup; publicar branch/PR para main sem merge/deploy/migrations produção.

Branch integration/pcdnades-release, worktree C:/Users/felip/.codex/worktrees/pcdnades-release/nadesCs2, base origin/main fcd360d. Originais preservados: dev4e3d4dd limpa, frontend63729fa limpa (1commit exclusivo), backend28e10b4/reelsa46c7af/solo3126c6d jáancestraisdev. MainlocalF:/projetos/nadesCs2 em0a97bf8desatualizada não tocada. Previewc2f90e5 tem17arquivosparciais não commitados preservados; comparar comversãoconcluída semmergecego. Remotosfront/back antigos, não confundir combrancheslocais.

Hash backup informado e conferido:CBD08D9F81DEDB87E9375027E680EEA358BAD958E3569B768070B8DF350E07C3. Lab original55322 e backups somenteleitura/preservados. Backendexistente recebeu validação emNOVOcloneisolado semdados reaisdestrutivos/semprodução; frontendexistente revisão estática semmutarbranches. Rootfazmerges/testesintegração/relatórioplanorelease/PR. Nenhumoutroagente criado.

Próximaação: merge normal dev, depois frontend; revisar conflitos/contratos; instalar dependências no worktree novo e rodar frontend/backend/builds/browser; receber revisão e ensaio migrations. Atualizar este arquivo e checkpointorchestrator em marcos. Push branchintegração/PR autorizados após segurança; main/deploy/produção proibidos. Gates: migrations pendentes e coletor cloud nãoativo; Reels/préviaoffdefault/YouTubeoff, TikTokexistente preservado.

## Integração e auditoria em andamento
- Merges normais: dev em10d58ac e frontend63729fa em9721974, sem conflitos; main/branchesoriginais intactas.
- Na integração: backend136testes+buildPASS; frontend58unit+buildPASS. Playwright82baselineemandamento. Revisãofrontreadonlyapontou2P2: labels/numeraçãoSolo público e reposicionarorigemreativadestinoexistente; root corrigirá comregressão apósbaseline.
- Supabaseprodução SOMENTE metadata confirmou5migrationshistóricas e3novasausentes,semcolunadestinations/RPCInstagram/tabelapreview. Bucketexistenteprivado50MB. Nenhumaescritaremota.
- UI Vercelreadonly: frontend Production branchmain, autoassigndomainsON, PreviewBranchTrackingOFF; backendPreviewBranchTrackingOFF. PR/pushintegraçãonãodevepublicarprod,mainmergeacopladodeployexigecoordenaçãomigrations.
- Backend ensaiacloneNOVObackupreadonlysemexterno;lab55322/backuphashconferido preservados. Frontreviewterminou semalterar63729fa.

## Correções de integração verificadas
4 testesdirecionadosREDreproduziram2P2 emPC/celular; apósfix4GREENPASS: origemreposicionada nãoarmasobrescritadedestinoexistente, destinosSolo públicosisoladostêmíndice/tiponolabel+badge. Agrupamento/video/seleçãoporlineuppreservados;frontreviewreadonlyaprovou. Front58unit/buildPASSnovamente. Full82finalemandamento. Screenshotsreaisdemo radar-biblioteca/radar-ampliado daárvoreintegradarevisadasemdesktop;mobilependenteatégeraçãofinal. Backend136buildPASSnãoalteradonestasfixes.

## Fechamento
Backend136/buildPASS;frontend58/buildPASS;PlaywrightFINAL82/82PASS apósfix,4direcionadosGREEN. SQLclonePG17.11:3migrationsPASS/8gruposQA+4negaçõesreais/DDLrollbackPASS,rolesmodeladasnãofull. Relatório sanitizado docs/MIGRATION-REHEARSAL-20261102.md. GO PRdraft,NO-GOmergeimediato;mainautoProductione3migrationspendentes.
