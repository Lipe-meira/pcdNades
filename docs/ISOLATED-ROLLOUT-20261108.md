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
