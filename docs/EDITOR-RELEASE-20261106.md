# Integração do editor — plano de publicação (06/11/2026)

Estado atual: PR #9 aberto em Draft e publicado para revisão. Push exclusivo da integração autorizado; rollout BLOQUEADO pelos gates abaixo. Não há autorização de produção. Branch codex/integracao-editor-20261106, base main9187b72; incorpora PR8 05cbc5a, concorrência7bc2e6a e limite3936153. Branches originais preservadas. Nenhuma alteração de layout ou limite durante integração.

## Correção de teste

Falha api-mobile `origens distintas no mesmo destino...`: NaN ao dividir por dimensão do radar. Marcadores podem existir antes do carregamento da imagem; boundingBox sem espera não garante geometria válida. Ajustado teste para complete/naturalWidth e expect.poll nas razões com mesma precisão0.001; sem sleep, relaxamento de assert ou mudança da aplicação. Teste dirigido desktop/mobile passou. Resultado da suíte final consta no checkpoint.

## Evidências e limites

Builds backend/frontend e typecheck;150 backend/63frontend unitários. Testes browser usam API/Auth/Storage simulados e MP4 sintético, sem TikTok real. Concorrência em PostgreSQL17 real isolado:uma escrita ganha e outra retorna UPDATE0; gatilho incrementa versão e preserva mídia/origem/destinos. Script integration-schema-smoke.mjs aplica as11 migrations do repositório em PostgreSQL17.11 descartável sem rede, exercita grants/RLS/is_admin/mídia/rollback e rate limit20/50/janela60min. Auth.uid/users e storage.buckets são schema sintético; não comprova GoTrue/PostgREST/Storage HTTP real. Build local não empacotou yt-dlp porque importador não foi habilitado no ambiente de build. CI Linux precisa ser conferido no SHA final antes de publicação.

## Preflight somente leitura já realizado

Produção: histórico9 versões até20261103120954; revision ausente. reserve_import_source já tem>=20 por owner e>=50global,created_at>now()-1hour,advisory lock762001139,search_path vazio,security invoker,owner postgres,EXECUTE postgres/service_role. Migration20261105210000 ainda ausente. Nova comparação somente leitura retornou body_equivalent=true após normalizar whitespace, assinatura p_owner uuid,retorno import_sources,volatile=true,security_invoker=true,search_path vazio,owner postgres e ACL esperada. Isso comprova equivalência do efeito atual, mas não autoriza reparo do histórico; repetir na janela aprovada. Nenhum attacl explícito de coluna em grenades e nenhuma membership de anon/authenticated/service_role retornados; authenticated mantém UPDATE de tabela antes da migration. Revalidar no momento da aplicação. Leitura não prova ausência de toda RPC customizada: revisar funções security definer/rotas que escrevem grenades no preflight autorizado.

Vercel: usuário confirmou manualmente Root Directory frontend/backend,Production=main,Preview Tracking Disabled,sem Custom Environments ou Deploy Hooks e workflow sem deploy. Ambos os arquivos efetivos possuem bloqueio explícito git.deploymentEnabled=false para a branch de integração. Push e PR9 foram autorizados e realizados,com zero deployments novos nas consultas pós-publicação. CI Linux do HEAD0ab9095 passou no run42275850248. Isso não autoriza merge ou rollout;revalidar configuração antes da janela.

## Ordem exata após aprovações separadas

1. Conferir SHA final/main/CI, configuração Production Branch=main e Preview Tracking off nos dois projetos. Confirmar deploys conhecidos para retorno e preservar configurações/flags atuais. Revisar disponibilidade das pessoas e janela; não ativar importadores nem alterar limites.
2. Backup privado recente de DB/schema/grants/RLS/histórico/Auth e inventário/backup dos objetos Storage publicados, com hashes e restauração isolada comprovada; dados/segredos fora do Git. Esta tarefa não criou backup real de produção. Definir responsável e duração da janela; backup deve preceder qualquer alteração remota.
3. Pausar operacionalmente cadastros/edições e finalizar operações em voo, mantendo leitura quando possível. Evitar upload seguido de conflito/cutover. Registrar grants exatos e estado de deployment antes de alterar. Preparar artefatos backend/frontend do mesmo SHA; sem promover ainda.
4. Reconciliar a migration20: obter definição e comparar corpo normalizado CRLF/LF, assinatura/retorno,linguagem,volatilidade,security invoker,search_path,owner e ACL com estado esperado. Sem alterações semânticas além10→20; se houver divergência, PARAR. Após comprovação registrada e autorização explícita, usar ferramenta oficial de reparo do histórico (`supabase migration repair 20261105210000 --status applied` com versão/escopo remoto conferidos via help). Esse passo altera SOMENTE histórico e não deve reexecutar a função. Não usar db push genérico ou reaplicar antigas; arquivos001..004 correspondem a versões remotas diferentes. Não marcar revision como aplicada neste reparo.
5. Ainda na janela, aplicar exclusivamente20261105170000_grenade_revision.sql por procedimento aprovado que registre sua versão; testar em isolamento previamente o fato de20 já estar registrada apesar do timestamp posterior. Confirmar coluna revision default1,trigger monotônico e grants de tabela/coluna/RLS; confirmar registros e mídias existentes sem mudanças indevidas. A ordem física de efeito20 já ocorreu antes da revisão; os dois scripts são independentes. Nenhuma sessão é apagada/resetada.
6. Autorizar merge SOMENTE do PR de integração para main (não integrar novamente PR8/branches componentes); main dispara os dois deployments quando configuração confirmada. Aguardar API e frontend READY no mesmo SHA antes de liberar edições. As builds automáticas não são atômicas: manter janela durante toda discrepância. Se ordem manual for autorizada, backend deve estar pronto antes do frontend novo. Não disparar redeploys repetidos por padrão.
7. Com autorização de escrita de smoke específica, conta administrativa e dados descartáveis:GET inclui revision;POST1/PATCH2;duas edições da mesma revisão produzem200/409,sem sobrescrita;PATCH antigo sem expectedRevision retorna428;anon/não-admin recusados;MP4 existente e novo,legado sem origem,Solo com destinos,rascunho por conta/reload e reprodução/renovação. Não importar TikTok real sem autorização. Confirmar20/50 por definição/histórico,sem consumir cota para ensaio em produção.
8. Verificar hashes/contagens autorizadas,logs sem segredos e cliente antigo orientado a recarregar. Só então reabrir edição; monitorar409/428/5xx e registrar evidências. Leitura com backend antigo/novo e clientes cacheados precisa ser observada.

## Incompatibilidades e mídia após409

Frontend novo exige revision nas respostas; backend antigo não a fornece. Backend novo exige expectedRevision e clientes antigos recebem428. Migration revoga UPDATE de authenticated, logo backend antigo perde caminho de edição. Não há rollout sem janela de escrita garantido com este contrato. Informar usuários para salvar rascunhos e recarregar após publicação; aba antiga não deve ser tratada como compatível.

Mídia pode ficar ready mesmo se o PATCH retornar409. Serviço valida mídia e conserva mediaId em memória; não repetir PATCH automaticamente nem apagar vídeo. Novo salvar com revisão antiga continuará409. Salvar rascunho não persiste mediaId/File/URL: fechar janela pode perder referência local à mídia pronta, deixando objeto não vinculado. Preservar objeto e cadastro publicado; reconciliar administrativamente sob autorização, não coletar automaticamente nem afirmar que rascunho recupera o upload. Reabrir com revisão atual e revisar antes de nova publicação; eventual reaproveitamento do mediaId exige fluxo suportado/validação de propriedade, nunca alterar estado privado no navegador por fora.

## Recuperação

Falha antes do DDL: manter deployments antigos e janela; reparar histórico somente com evidência/autorizações. Falha após revision: manter schema aditivo e dados, parar novas escritas e preferir corrigir adiante/publicar par compatível. Promover backend antigo isoladamente NÃO é rollback seguro: seus PATCH perderam UPDATE e cliente novo exige revision. Se retorno ao par antigo for expressamente aprovado, restaurar grants exatos registrados após avaliar que isso remove proteção CAS; não remover revision/trigger nem restaurar banco inteiro sobre novos dados por padrão. Rollback de código não reverte histórico,grants,Storage ou banco. Preservar mídias órfãs para investigação. Falha em smoke: manter edição suspensa e reportar; nenhuma repetição automática de importação ou migração.

## Gates antes de produção

Confirmação atual de disparos Vercel; backup/restore aprovado; CI final; validação real Auth/PostgREST/Storage em ambiente autorizado ou aceite explícito de sua ausência; simulação de cutover com cliente antigo; autorização separada de reparo do histórico,DDL,merge/deploy e escrita de smoke. Abertura de Draft não atende esses gates.

## Bloqueio Git publicado

frontend/vercel.json e backend/vercel.json preservam única regra false para codex/integracao-editor-20261106,sem wildcard conflitante. Configuração já publicada no PR9; roots e ausência de hooks confirmadas manualmente pelo usuário. Não repetir conferência antiga como pendência resolvida; revalidar somente se houver mudança relevante ou antes da janela.

## Revisão de risco e compatibilidade real — 06/11/2026

Novas leituras produtivas confirmam9 migrations até20261103120954,ausência de revision e da versão20;função efetiva20/50,lock/janela preservados,ACLpostgres/service_role e search_path vazio. grenades tem RLS,políticas SELECTpúblico e INSERT/UPDATE/DELETE autenticado condicionado a is_admin;UPDATEauthenticated de tabela ainda presente. Nenhum ACL explícito por coluna,membership das roles consultadas ou função public/private cujo corpo referencie grenades foi encontrado. Busca textual não é prova contra SQL dinâmico/extensões/caminhos externos.

Migrationrevision não colide com coluna/trigger/função já existente segundo leitura atual;antes de aplicar confirmar também private.grenade_revision() ausente. Triggergrenade_ready existente deve coexistir,sem remover ou desabilitar. Conferir versãoPostgreSQL,locks longos,tamanho/tempo esperado do ALTERTABLE e disponibilidade de proprietário;usar lock_timeout/statement_timeout aprovados para falhar sem bloquear indefinidamente. Se timeout:ROLLBACK e abortar rollout,sem retry automático.

### Matriz de gates restantes

| Gate | Evidência atual | Falta para aprovação |
|---|---|---|
| CAS/migrations/grants/RLS | PostgreSQLreal11migrations e disputa2sessõesPASS | Preflight e aplicação autorizados no ambiente destino |
| Auth/REST/Storage reais integrados ao novo backend | Não executado nesta entrega;harness antigos apontam labs de terceiros/alguns consultam TikTok | Nova stack sintética exclusiva com GoTrue/PostgREST/Storage,sem reutilizar dados/volumes/labs existentes |
| Admin vs usuário comum,401/403,409/428 | APIcontrolada e PGreal cobertos | Repetir por HTTP com loginGoTrue real na stack nova |
| MP4/upload/reprodução/Solo | BrowserfixturePASS,integridade de mídiaPGPASS | UploadStorage real,Range/playback/hash e client antigo/novo no mesmo ensaio |
| Backup/restauração | Procedimento abaixo preparado | Execução privada explicitamente autorizada e restore comprovado |
| Reconciliação histórico20 | Definição equivalente por leitura | Reparar histórico com autorização e registrar evidência |
| Janela de escrita | Somente orientação operacional | Bloqueio efetivo para todos os admins/abas/API;acordo verbal ou esconder botão não basta |

Containers antigos em execução não foram alterados,nem lidos seus segredos. Não execute source-preview-local-e2e.ts:contém fontesTikTok/Reels reais e limpeza;solo-local-e2e.mjs exige nome/portas/credenciais de lab histórico. Adaptar para stack nova é trabalho pendente,não integração aprovada. Usuário autorizou testes isolados,mas não uso de dados reais nem interferência nesses labs. Nenhum E2EHTTP real foi alegado nesta revisão.

## Backup privado reproduzível — somente após autorização específica

1.Escolher diretório NOVO fora do Git e de sincronização cloud,criptografado,com ACL exclusiva ao operador/Admin/SYSTEM e espaço verificado;sem links/reparsepoints. Criar manifest privado de IDs de projeto,PostgreSQLversão,horárioUTC,SHAs de aplicação/migrations e ferramentas. Credenciais via PGSERVICEFILE/PGPASSFILE privados,sem senha em argumento/log/chat;papel de leitura com privilégios suficientes para Auth/Storage/schema. Não usar credencial parcial e anunciar backup completo.
2.Conferir pg_dump/pg_restore17 compatíveis e usar conexão direta/session-mode suportada,não transactionpooler. Backup-base consistente em um único archivecustom cobre schemas public,private,auth,storage,supabase_migrations e dependências. Modelo de comando,não executado:
```powershell
pg_dump --dbname="service=pcdnades_backup_read" --format=custom --file="$backupDir/database.dump" --verbose 2> "$backupDir/pg-dump.log"
if ($LASTEXITCODE -ne 0) { throw 'Backup falhou: não prosseguir.' }
pg_restore --list "$backupDir/database.dump" > "$backupDir/toc.txt"
if ($LASTEXITCODE -ne 0) { throw 'Archive inválido.' }
Get-FileHash -Algorithm SHA256 "$backupDir/database.dump"
```
Não usar --no-acl/--no-owner no backup-mestre. Um dump completo pode conter segredos de Auth/Vault;mantê-lo privado e só executar com escopo autorizado. Extensões/schemas geridos não devem ser restaurados cegamente em outro projetoSupabase. Inventariar roles/memberships/grants/configuraçãoAuth e dependências;roles-only dump pode conter passwordhashes e exige aprovação/armazenamento privado. Capturar configurações via interfaces oficiais,sem publicar valores. ArchiveSQL não inclui configurações de serviço Auth/SMTP/JWT nem bytes dos objetosStorage.
3.Storage:por SDK/API oficial com permissão de leitura,listar todos os buckets relevantes (videos-staging,publicados,prévia e outros encontrados),paginar até terminar e preservar chaves relativas,metadados,tamanhos,ETag/versão quando disponível. Copiar bytes para destino privado mantendo bucket/chave;calcularSHA256 de cada objeto baixado e manifest. Nenhuma URL assinada ou token no manifest público. Comparar contagem/tamanhos/hash;relistar para detectar drift. Não tratar metadados storage.objects como backup de arquivos.
4.Restore em NOVO ambiente isolado explicitamente autorizado,sem egress/SMTP/webhooks externos e sem chaves de produção. Primeiro ensaiar com dadosSINTÉTICOS;dados reais só após autorização específica. Preparar roles/extensões/serviços compatíveis,restaurar archive com pg_restore --exit-on-error em banco vazio por procedimento aprovado;conferir erros/TOC/schema/FKs/policies/grants/triggers/funções/histórico. Configurar Auth/Storage locais para não emitir e-mails ou chamar endpoints externos. Se usar --no-owner em cópia de ensaio,documentar e testar ACL/roles separadamente:isso não prova restore exato de permissões.
5.Restaurar bytesStorage por mecanismo compatível do destino sem duplicar incorretamente registros de metadata. Confirmar contagem eSHA256 de objetos,referências grenades→media,estado ready,hash dos dados relevantes,login de conta de teste autorizada,is_admin,negações anon/viewer,playbackRange e roles. Authusers sem sessão/configuração/JWT compatível não comprova recuperação de login. Registrar PASS/FAIL de cada camada,sem declarar sucesso parcial como restauração integral.
6.ConsistênciaDB+Storage:dump usa snapshot transacionalDB,mas não snapshot atômico de objetos. Backup-base pode ocorrer antes da janela;após suspender TODOS os escritores/importadores/coleta que alterem dados relevantes e drenar operações,verificar drift e produzir backupfinal/delta e manifest de objetos estável,com revalidação/restore. Se houver writers não controlados,parar:backup entre camadas não é consistente. PausarCron/serviços seria alteração remota que requer autorização separada;nenhuma foi executada aqui.
7.Guardar hashes/logs/resultado de restore em manifest privado,segregar senha de criptografia e testar acesso pelo responsável de recuperação. Não apagar backups anteriores;retention/eliminação só com autorização. Falha de integridade,permissão,drift ou restore impede rollout.

## Checklist operacional final — cada mutação requer autorização

1.Autorizar/realizar backupbase privado e restoreisolado;revalidar HEAD/CI/preflight/configVercel e nomear responsável pela janela.
2.Ativar bloqueio REAL de novas escritas para todos os admins/API/abas,drenar uploads/processing/requests e controlar escritores de fundo;confirmar zero operações em voo. Nenhum mecanismo remoto de manutenção foi provisionado nesta tarefa. Finalizar backupcoerente/delta após freeze e validar antes de DDL.
3.Revalidar equivalência exata da função20 e metadata/ACL;registrar evidência privada. Com autorização,usar repair oficial SOMENTE20261105210000applied,não executar novamenteSQL nem dbpushgeral. Validar histórico e função inalterada.
4.Aplicar exclusivamente20261105170000 por procedimento transacional aprovado que registre versão. Capturar schema/grants antes;validar default1,trigger incremento,grenade_ready preservado,RLS/policies e ausência UPDATEauthenticated/colunas/memberships/atalhos. Testar sequência de histórico fora da ordem numérica em ensaioCLI antes;não corrigir isso reaplicando antigas.
5.Autorizar merge únicoPR9 em main. BloqueioGit é exato para branch integração,portanto não impede deploymain;não reutilizar regra false geral. Não integrar PR8/componentes novamente.
6.Aguardar API/frontendREADY e aliases no MESMO SHA;manter freeze durante builds não atômicas. Se operação manual for autorizada,API compatível primeiro,frontend depois. Não promover deployment antigo do backend isoladamente após migration.
7.Executar smoke de escrita explicitamente autorizado com dados descartáveis:loginadmin/viewer,401/403,create/GETrevision1,PATCHrevision2,duas edições200/409,clienteantigo428,UPDATEdireto negado,MP4upload/playback/hash,legado/Solo/rascunhos. Sem TikTokreal. Nenhuma mídia publicada deve ser substituída pelo teste.
8.Conferir integridade e erros,reabrir escritores de forma coordenada;orientar reload/recuperação de rascunho e manter edição suspensa se clientes antigos persistirem sem controle.
9.Monitorar5xx/409/428/Auth/upload/playback e locks durante janela acordada. Em falha:fechar escrita,preservar logs/mídias e decidir correção adiante/retorno com responsável. Restaurar backup completo sobre dados novos causa perda e exige aprovação específica;preferir schemaaditivo e recuperação seletiva. Reabrir apenas após smokePass.

Conclusão atual:BLOQUEADO para rollout. Motivos:backup/restauração não executados;integraçãoHTTP realAuth/PostgREST/Storage e cutover/cliente antigo não comprovados;bloqueio efetivo de escrita e reparo/aplicação ainda não autorizados. PR9 é revisável,mas não autorização de produção.
