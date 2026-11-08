# Continuação do ensaio — 08/11/2026

Resultado: **APROVADA COM RISCOS RESIDUAIS** na fase técnica isolada. Passagem final completa terminou exit0/PASS. Produção depende de barreira hospedada comprovada e autorização de backup real/rollout.

PASS: backend antigo/schema antigo;freeze/dreno/backup préDDL;20/50 e histórico local;revision;backend novo;200/409 concorrentes,428 cliente antigo,401/403,UPDATE direto negado,legado/SoloExec;GoTrue/PostgREST/Storage reais sobre banco e objetos restaurados;login,leitura,criação,edição,reproduçãoHTTP/hash;frontendChromium real loga e salva edição no editor. Sem mocks nesses caminhos. Processamento inline-original;worker externo/transcodificação/TikTok não executados.110browser/152backend/63frontend anteriores preservados sem repetir suítes.

TOC contém Auth/grenades;grants/RLS/triggers originais/restaurados iguais. SHA256 dump prérevision:61c60f8bb95e2b988c5938043db84b8d01eb2e6cb0c93f091e6fc3d7f1f633c1;tarStorage:6e9ea9a12ad5284401ba69bf7ed88bec9a37fb3dc565c80985236cae5541945c. http-result.private.json registra globalProductionFreezeProven=false.8containers próprios parados,volumes/bancos/tentativas preservados. Registro anterior abaixo é histórico.

## Reprodução e isolamento

Projeto novo `rollout-loopback-20261108`, API58621/DB58622/mail58624/analytics58627. CLI2.102.0 fornece imagens/config inicial; seu publish wildcard não foi aceito para testes. Rede bridge própria com `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`; como a CLI publica wildcard explicitamente, esse default sozinho NÃO resolveu. Compose Docker com `ports[].host_ip=127.0.0.1` resolveu. `docker inspect` em todos os oito containers confirmou somente127.0.0.1, sem IPv6 wildcard, antes de qualquer teste. Não há isolamento de egress; os scripts não chamam TikTok nem usam dados/credenciais reais.

`backend/scripts/prepare-loopback-compose.mjs` gera config privada a partir dos oito containers exclusivos da CLI, recusa volumes alheios e arquivos existentes. Não inicia/para nada. Conservar entrypoint/command/env/healthchecks/aliases e mounts; escapar `$` da interpolação Compose. Parar somente esse projeto CLI, preservando volumes; iniciar Compose e conferir bindings efetivos novamente. Não executar `stop --all`, `--no-backup` ou prune. Arquivos privados ficam em backend/vendor ignorado, nunca versionar configurações com credenciais.

Ensaio dirigido: `node backend/node_modules/tsx/dist/cli.mjs backend/scripts/rollout-loopback-full.mjs`. Script propositalmente não idempotente, restrito aos endpoints58621/58622 e nomes fixos deste laboratório; não é ferramenta produtiva. Usa configuração privada source-round4, banco source_round4 (ownerpostgres), restaura em recovered_round6 e volume novo. Para reproduzir em laboratório novo, preparar nomes exclusivos/configuração compatível e revisar constantes; não rodar cegamente sobre evidências existentes. Aplicação antiga obtida com `git archive 9187b72 backend/src`, sem mudar checkout original. Backend atual precisa de dist atualizado. Frontend Vite e Chromium reais usam58703 e API em porta loopback dinâmica.

## Barreira operacional ensaiada

Fechar todas as instâncias HTTP locais (incluindo antiga), aguardando requisições aceitas. Parar gateway, Auth, REST, Storage e serviços auxiliares desse laboratório; testes confirmam REST e URL assinada previamente emitida inacessíveis. Não existem runners externos nesse laboratório. Transação de escrita anterior à barreira termina primeiro; outra sessão adquire SHARE LOCK em grenades,media_assets,import_sources,import_preview_jobs,storage.objects/storage.buckets. Uma tentativa DML direta falha por lock_timeout; aguardar encerramento das conexões e conferir zero escritores ativos antes do dump. Lock permite leitura/dump e é liberado explicitamente antes do DDL. Deadlines abortam a operação; não prosseguir se o lock/dreno falhar.

Isso garante a barreira do laboratório controlado, NÃO uma suspensão global comprovada no Supabase hospedado. API_WRITES_PAUSED continua mitigação de admissão apenas. Manter leitura é desejável, mas a alternativa segura ensaiada é indisponibilidade total temporária dos gateways.

## Aplicação futura em produção: decisão operacional obrigatória

Antes de autorizar a janela, identificar todas as origens, aliases/deployments antigos e acesso direto Supabase, workers/Edge/Cron/filas, processos de mídia e operadores com service_role/SQL. Congelar produtores e admissão em TODAS as versões/instâncias, aguardar requisições, jobs e leases terminarem sem eliminar filas/sessões. Consultar pg_stat_activity/locks e estado dos jobs; ausência de uma query ativa isolada não prova ausência de escritores.

A barreira escolhida precisa negar também REST/RPC DML direto e Storage PUT/POST/DELETE, inclusive uma URL assinada emitida antes. Revogar apenas UPDATE, ocultar botão, mudar API flag ou RLS não invalida automaticamente URLs assinadas. Capturar ACLs/RPCs antes de qualquer revogação autorizada; service_role/SECURITY DEFINER exigem análise explícita. Parar gateway no Docker não é um comando equivalente disponível no Supabase gerenciado. Não usar pausa do projeto como se permitisse executar migrations enquanto pausado.

Alternativa mais segura: janela total com barreiras de ingresso suportadas e verificadas nos dois serviços e Supabase/Storage; se não houver controle do ingresso Storage, interromper emissão e esperar a validade máxima comprovada de todas as URLs anteriores MAIS uploads/processamentos em andamento, com observabilidade e nova verificação. Se expiração ou dreno não puderem ser demonstrados, NÃO fazer backup final/DDL/rollout: manter bloqueio e solicitar solução/apoio do provedor. Não considerar espera arbitrária suficiente. Toda alteração remota de ACL, firewall, jobs ou configuração exige autorização própria e restauração exata ao reabrir.

## Recuperação e correções do procedimento

Backup custom do banco ANTES da revision, mais volume Storage com atributos estendidos: GNU tar `--xattrs --xattrs-include='*' -czf` e restauração `--xattrs --xattrs-include='*' -xzf` em volume NOVO. BusyBox tar sem xattrs preservou hashes, mas Storage retornou500/ENODATA: tentativa reprovada e preservada. Não basta comparar bytes. Restore do banco deve preservar ownerpostgres (`createdb -U supabase_admin -O postgres` somente neste laboratório); banco criado com owner diferente impediu CREATE OR REPLACE em public. Não corrigir isso ampliando grants indiscriminadamente. Configs/Auth/JWT/roles pertencem ao ambiente sintético; backup produtivo requer inventário/configuração/roles e exportação suportada privados, sem copiar segredos para Git.

Snapshot DB e objetos são feitos sob a mesma barreira. Apontar GoTrue/PostgREST/Storage para banco e volume restaurados, mantendo versões compatíveis, aguardar health e testar login real, permissões, leitura, edição/criação e reprodução HTTP com status e hash. A recuperação não depende só de comparação SQL. Guardar TOC, checksums e logs privados e revisar owners/grants/RLS/triggers antes de reabrir.

---

## Registro histórico da primeira tentativa (superado somente pelas evidências da continuação)

# Ensaio técnico isolado — 08/11/2026

Resultado global:BLOQUEADO. Progresso comprovado abaixo;não é autorização de rollout. Somente dados,contas,chaves e MP4 sintéticos;nenhuma consulta/cópia/escrita de produção,TikTok ou lab alheio.

## Ambiente exclusivo e reprodução

CLIoficialSupabase2.102.0 via npx,project_id rollout-lab-20261108,diretório ignorado backend/vendor/rollout-lab-20261108. Config/migrations-base anteriores à revisão geradas ali;portas58521API/58522DB,identificadores próprios,sem reutilizar volumes/segredos de outros projetos. RedeDockerinternal pcdnades-rollout-20261108 falhou no acesso127.0.0.1:58522. Segunda redebridge exclusiva iniciou serviçosGoTrue,PostgREST,Storage,PostgreSQL17.11 e gateway reais,mas sem restrição de egress. Não houve chamada de aquisição externa. Status/chaves/logs permanecem exclusivamente em status.private.json/logs privados no vendor.

ATENÇÃO:docker port revelou bind0.0.0.0/[::] pelaCLI. Stack foi PARADA ao constatar isso com supabase stop --workdir (sem --all e sem --no-backup). Volumes sintéticos preservados;zero containers ativos com esseproject_id ao final. Antes de retomar,configurar efetivo bind127.0.0.1 para todos os endpoints ou isolamento equivalente e conferir via docker port;esta stack não recebe aprovação de isolamento de rede. Não reiniciar cegamente ou reutilizar ambientes existentes.

Scripts novos:
-node backend/scripts/rollout-local-http.mjs:exige origins58521/58522 exatas,recusa URL remota;usa stack NOVA semrevision/histórico20,cria usuários sintéticos aleatórios,abreFastifyHTTP emloopback,usaGoTrue/PostgREST/StorageSDK reais. Não é idempotente:guardar resultado e não repetir contra stack com migrations já aplicadas. Preparar freshschema somente nesta stack ou parametrizar nova stack antes de novo ensaio.
-node backend/scripts/rollout-backup-check.mjs:confere fingerprints de DBoriginal/restored_rollout_admin,metadadosStorage/Auth/histórico,RLS/grants/triggers;baixaMP4 sintético e restaura bytes em bucket privado novo,confereSHA256 e referência metadatarestaurada. Lê somente statuslocal58521/58522. Requer dumps/restores abaixo já preparados. Não é backup produtivo.

## Evidência real executada

LoginGoTrue admin e comum;HTTPFastify→PostgREST/Storage real;401semJWT,403viewer;upload assinado/processamento MP4 inline/playbackHTTP eSHA256 iguais;granada legado semorigem;SoloExecdoisdestinos;revision1;duas edições HTTP simultâneas resultam200/409;PATCHsemversão428;UPDATEdiretoautenticado negado. ResultadoPASS em http-result.private.json. Frontend não participou deste E2E:110browser anteriores continuam com APIcontrolada.

Simulação parcial:estadoDBprérevision,criaçãolegado/mídia,APIinstânciaemmanutenção503,fechamento da instância de escrita aguardado,efeito20 aplicado localmente,histórico sintético registrado após verificar20,revisionaplicada,backendHTTPnovo,checks e reabertura local. NÃO foi executado backendfrontendantigos binários juntos,nemfrontendnovo real;nenhuma prova de drain distribuído/StorageURLs emvoo. BackuprealSupabasesintético foi após alteração e não no ponto exato préDDL:sequência completa de rollbackprérevision continua pendente.

## Manutenção implementada e limites

API_WRITES_PAUSED defaultfalse,aceita apenas true/false;inválido aborta startup. true recusa todos métodos foraGET/HEAD/OPTIONS no onRequest com503/WRITES_PAUSED/Retry-After60,antes deJWT/DB/Storage. Mantém leitura;afeta tambémPOSTinspect/import/preview/upload/complete ePATCH/DELETE. TestesREDantes/GREENdepois e152backendPASS,typecheck/buildPASS. Nenhuma variável produtiva alterada. Flag é capturada no startup,exige reinicialização/deploymentAPIsob autorização;NÃO protege instâncias antigas ainda roteadas.

Ativar futuramente:publicar etapaAPIcompatível com pausatrue na janelaautorizada,verificar503HTTPemPOST/PATCH/DELETE e leituraGET,esperar instâncias antigas e operações aceitas terminarem (app.close drena só instância local,serverless exige controle/observabilidade externos). Desativar:somente após schema/parAPIfrontendcompatíveis e smoke,configurarfalse e aguardar instânciasatuais;confirmar escrita admin/negações e leitura. Não é switchglobal nem declara drained.

Caminhos não cobertos e que impedem freezeintegral:INSERT/DELETEdiretoSupabase comJWTadmin e grants existentes;service_role externo/operadores;workers;completesjáemvoo;URLsStorageassinadasantesdapausa;Cron/Edge/runner de coleta alterandoStorage/leases/heartbeat;Authupdates e tarefas geridas. Fluxo de congelamento requer bloquear admissãoAPIemTODASinstâncias,restringirDMLdiretodurantejanela conformeACLprévia,pausarprodutores/consumidoresCron/worker/Edge autorizados,aguardar leases/requests eURLsativos ou barreiraStoragecomprovada. RevogarJWT/ocultarbotão/zerarfila não prova isso. Reabrir restauraACLs/configs EXATAS antesregistradas,sem concessões ampliadas. Nenhum desses controles remotos foi ativado;barreiraDB/Storage e drain distribuído continuam pendentes de implementação/ensaio. Não inventar endpoint de manutenção:flag requer configuraçãoexterna autorizada.

## Backup/restauração sintéticos

NoPostgreSQLdescartável reduzido:integration-schema-smoke aplica11migrations,dumpcustom,TOC,restore emrestored_synthetic;fingerprints/grants/RLS/triggersPASS. SemHTTPAuth/Storage nessa parte.

Na stackSupabaserealnova:docker exec supabase_db_rollout-lab-20261108 pg_dump -U postgres -Fc -f /tmp/rollout-synthetic.dump postgres;archiveSHA25609adb9d87fd20b4d14b9889872355c743e250ad0dbef7423f3f8e6343aabccc1. TOClistPASS. Tentativa --clean --if-exists emDBvaziofalhouDROPpolicysemrelation;outra com postgresfalhouSETROLEsupabase_admin. Não relaxadaspermissões:novoDBrestored_rollout_admin criado e restore com papelADMINREALDO LABsupabase_admin(superuser) + --exit-on-error SEMclean emDBvazioPASS. Comandos (somenteesteprojetosintético):createdb -U supabase_admin restored_rollout_admin;pg_restore -U supabase_admin --exit-on-error -d restored_rollout_admin /tmp/rollout-synthetic.dump. Não tratar essepapel como disponível/permitido em produção;restoreremoto exige estratégiaSupabase suportada própria.

rollout-backup-checkPASS:fingerprintsgrenades/media/authusers/storageobjects/buckets/histórico iguais,grants/RLS/triggers iguais;bytesStorageemnovobucket privado restaurados/hashigual,nomesreferenciados noDBrestaurado conferidos. Manifest/bytesem vendorprivado. NÃO foi apontada aplicaçãoAuth/REST/StorageHTTP para DBrestaurado;metadatapreservada e byte-roundtrip não comprovam restaurooperacionalcompleto. Dumpnãoinclui sozinho bytesStorage,configAuth/JWT/SMTP ou globals;restauração usou roles da mesmainstâncialocal. Dados de produção não foram copiados e backup produtivo NÃO concluído.

## Próximos gates exatos

1.Corrigir bind/isolamento emnova stack;reproduzir config sem chaves versionadas.
2.Barreira de escritaDB/Storage e pausarconsumidores com drain verificável,incluindoURLs/requests antigos;manterleituras quando possível.
3.Repetir sequênciacompleta:backendantigo→freeze/dumppréDDL→histórico20/revision→backend/frontendnovos reais→reabertura;nenhumTikTok.
4.Apontar serviçosnovos apenas paraDB/objetosrestaurados e provarlogin/playback/permissõesHTTP;roles/configgeridas compatíveis.
5.Só então aprovação técnicaisolada;depois solicitar autorização separada para backupprivadoreal,restoreisoladocomdadosreais e janela/rollout. Sem essaaprovação,não propor execução imediata de produção.
