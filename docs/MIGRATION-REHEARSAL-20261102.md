# Ensaio real das três migrations — 02/11/2026

## Resultado

GO para o ensaio SQL local e revisão/PR draft. Não é autorização ou GO irrestrito para produção, clone integral de roles, Auth/Storage E2E ou deploy. Nenhum arquivo Git, branch, worktree de integração ou produção foi alterado por este ensaio.

## Origem e isolamento

Cópia privada do dump production-after-cleanup.dump: SHA256 CBD08D9F81DEDB87E9375027E680EEA358BAD958E3569B768070B8DF350E07C3, conferido no original e na cópia antes e no original ao final. Diretório novo C:/Users/felip/pcdnades-migration-review-20261102-ecad7270 com ACL privada herdada do diretório de backup protegido. Não copiar/publicar o diretório completo: contém dump e logs privados.

Container NOVO supabase_db_pcdnades-migrations-20261102, imagem oficial existente public.ecr.aws/supabase/postgres:17.11.0.006, PostgreSQL17.11, network none e nenhuma porta publicada. Nenhum serviço Auth/Storage/SMTP/webhook/worker iniciado; pg_cron e pg_net não presentes na base restaurada. Não houve tráfego externo ou mudança para suspender produção. Container/lab ORIGINAL supabase_db_pcdnades-restore-20261102-isolated e porta55322 apenas consultados para metadados; não alterados/apagados. Nenhum volume antigo removido.

## Restore e limitação de roles

Restore pg_restore --no-owner --exit-on-error da cópia no banco NOVO migration_qa_complete, mantendo ACLs do dump. Sucesso sem erros após bootstrap de nomes de roles. Os nomes foram lidos SOMENTE de pg_roles do laboratório original, sem senhas/hashes ou outros atributos, e criados como placeholders NOLOGIN quando ausentes. Não é clone completo de roles/identidades/propriedade. A role administrativa local supabase_admin foi usada; a role postgres da imagem é NOSUPERUSER.

Duas tentativas iniciais foram preservadas em bancos separados, sem DROP: migration_qa parou antes de dados por privilégio SET log_min_messages; migration_qa_admin parou por role ausente. Nenhuma falha foi ignorada para declarar restore bem-sucedido. Logs completos ficaram privados. Service_role BYPASSRLS foi modelado apenas dentro da transação QA e revertido com ROLLBACK, não restaurado como identidade completa.

## Migrations aplicadas em ordem no clone descartável

1. 20261101152756_solo_exec_destinations.sql
2. 20261101153422_instagram_import_sessions.sql
3. 20261102000337_import_source_previews.sql

Histórico baseline5 preservado; três registros QA acrescentados somente no clone após cada DDL bem-sucedida, histórico final8. Não reaplicamos TikTok20261030124528. Não executamos migrations no backup, laboratório original ou remoto.

## Evidências reais PostgreSQL

Baseline:1granada,4media_assets,1auth.users,0storage.objects,histórico5. Após3migrations: mesmas contagens e histórico8. Hashes SHA256 agregados de grenadas (excluída nova coluna nullable destinations), mídias e Auth permaneceram iguais. Nenhuma PII ou UUID real foi impressa.

Oito grupos QA transacionais passaram: RLS ativado; grants de tabelas/RPCs; Solo válido nos limites0/1; Solo sem origem/lista vazia/target divergente recusado; Instagram idempotente e seleção imutável; reserva/owner/ready de prévia; claim/holder/CAS de limpeza; expiração. Fixtures foram criadas somente no clone e ROLLBACK removeu todas: contagens retornaram1/4/1, preview_jobs0. Nenhuma linha real foi usada em teste destrutivo: apenas leitura/FK de mídia pronta e inserções/alterações de fixtures QA revertidas.

Quatro negações executadas realmente com SET LOCAL ROLE anon/authenticated: acesso preview_jobs/maintenance e RPCs de reserva/Instagram recusados por privilégio. Isso comprova grants/negações no PostgreSQL modelado, não Auth REST completo.

Outro banco NOVO migration_qa_rollback restaurado da mesma cópia provou DDL em transação: preview table existiu dentro da transação; após ROLLBACK, destinations, preview table e RPC Instagram ausentes novamente, histórico5 e legado1/4 preservados. Não é promessa de rollback destrutivo depois de haver novos dados em produção; após commit preferir flags/forward-fix e aprovação separada.

Compatibilidade do modelo backend real grenadeView:1registro legado com mídia relacionada passou preservação de tipo, target e videoId e destinations opcional/ausente. Não houve servidor HTTP/Auth/Storage E2E; não repetimos testes de frontend/importação externa. O harness local foi ajustado para ESM e campo destinations opcional conforme contrato, sem alteração de código do produto.

Conferência final do laboratório ORIGINAL:1granada,4mídias,1usuário e histórico5, intactos. Dump original mantém SHA256 informado.

## Scripts e comandos reproduzíveis sem segredos

Scripts privados neste diretório: restore-copy.mjs, restore-admin-copy.mjs (falhas preservadas), bootstrap-roles-restore.mjs, apply-three.mjs, qa-run.mjs, qa-role-denials.mjs, ddl-rollback.mjs, backend-model.mts. Não publicar scripts/logs em massa: usar somente este relatório sanitizado após revisão.

Comandos conceituais usados, EXCLUSIVAMENTE no container novo: createdb -U supabase_admin -T template0 NOVO_BANCO; pg_restore -U supabase_admin -d NOVO_BANCO --no-owner --exit-on-error /tmp/source-copy.dump; psql -U supabase_admin -d NOVO_BANCO -v ON_ERROR_STOP=1 -f /tmp/MIGRATION.sql. Fonte e logs privados montados/copied sem imprimir conteúdo. Nada usa credenciais de produção.

## Pendências / conclusão

GO local para as três migrations e compatibilidade SQL/legado descritas. Roles/propriedade/config de identidade não são cópia integral; nenhuma prova nova de Auth/Storage playback ou runtime cloud neste ensaio. Backup bytes/config e restore integral continuam com seu próprio escopo de evidência. Aplicação remota, registro oficial das migrations, backup pré-release e rollout dependem exclusivamente da revisão/autorização do orquestrador/usuário. Recursos e bancos de ensaio preservados para inspeção, nenhum push/deploy/main ou modificação de branches.