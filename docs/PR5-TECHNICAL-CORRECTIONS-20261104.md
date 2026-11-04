# PR5 — correções locais de operação, 04/11/2026

Base: `03b632fa367feafcd4d55ecd20de12ded75dbbb7`. Sem push, merge ou operações remotas. Referência: relatório `PR5-OPERATIONAL-READINESS-20261104.md` no worktree do orquestrador. Nenhuma migration histórica alterada.

## Correções

- `backend/supabase/ops/preview-cron.sql`: check, schedule e desativação agora são uma única transação DO, com advisory lock transacional `762001141`. Dois instaladores cooperantes não sobrescrevem o job: um instala inativo; o outro recusa. Reexecução recusa em vez de atualizar. Segredos ausentes, vazios ou duplicados impedem instalação. Recusa nomes de laboratório e comandos reconhecidos do coletor, inclusive inativos. Nenhum valor de segredo é impresso.
- Exige proprietário `postgres`. Usa `cron.alter_job`, não UPDATE nem FOR UPDATE em `cron.job`. Se faltar privilégio gerenciado, toda a instalação é revertida; não conceder permissões como remediação automática.
- Diagnóstico do comando manual não afirma mais que todo erro impede renovação do heartbeat. Um erro de release pode acontecer depois da confirmação no banco.

O lock protege somente operadores que usam este protocolo, no mesmo banco. Não impede um administrador de criar jobs por outro caminho ou ocultar um destino através de wrapper. Antes de instalar, um operador exclusivo deve inventariar todos os coletores e respectivos proprietários; RLS de `cron.job` pode limitar a visibilidade. Visibilidade incompleta ou operador concorrente é NO-GO. A instalação não ativa o job e não prova funcionamento do gateway.

## Instalação e parada coordenada — NÃO executar nesta tarefa

1. Obter autorizações separadas para migration, publicação, infraestrutura e ativação. Confirmar projeto, backup, HEAD/CI, grants, funções e prévia desligada. Inventariar Cron e supervisores existentes, sem imprimir comandos contendo segredos.
2. Parar runner legado e seus timers/supervisores; confirmar ausência de execução em voo. O legado ignora o lease global e pode excluir objetos antes de falhar na RPC revogada. Seu advisory lock de sessão não coordena com Edge.
3. Aplicar somente a migration de lease pendente, com autorização. Ela revoga `mark_source_preview_sweep` para service_role. Não iniciar o runner PR5 antes das três RPCs claim/finish/release existirem. Não editar o histórico.
4. Publicar a versão compatível e verificar as três RPCs, ACLs e bucket. Escolher um único agendador contínuo. Edge e runner novos compartilham o lease, mas sua interoperabilidade real continua pendente.
5. Preparar função, Vault e monitor exclusivos do ambiente. Confirmar disponibilidade de pg_cron/pg_net e privilégios reais. Executar o instalador exato uma única vez; em nova conexão conferir jobid, username, schedule e `active=false`. Ativação exige decisão separada e verificação de fixtures/backlog/lease/monitor.

Para desativar um job identificado, o procedimento revisado é:

```sql
-- ALTERA o ambiente: somente após autorização. Substituir NULL pelo ID conferido.
do $$
declare expected_id bigint := NULL;
begin
 perform pg_catalog.pg_advisory_xact_lock(762001141);
 if current_user <> 'postgres' or expected_id is null then
   raise exception 'Confirmar proprietário e jobid antes de executar';
 end if;
 if (select count(*) from cron.job
     where jobid=expected_id and jobname='pcdnades-preview-sweep'
       and username=current_user) <> 1 then
   raise exception 'Identidade do job divergente';
 end if;
 perform cron.alter_job(expected_id, active := false);
end $$;
-- Em NOVA conexão: selecionar apenas jobid, jobname, username, schedule, active.
```

Não adaptar o nome para outro ambiente sem revisar seu ID e autorização. Não bloquear a tabela gerenciada: o erro 42501 observado no laboratório exige usar a API oficial, não alterar grants. Desativar não cancela HTTP já enfileirado pelo pg_net nem execução em voo.

Recuperação: investigar primeiro o resultado incerto, fila HTTP, lease e backlog. Conferir vencimento das fixtures e exclusividade do operador. Não renovar heartbeat à mão ou aumentar TTL. Uma recuperação que permita **no máximo uma** execução exige comando protegido por limite de execução e deadline, revisado e autorizado para o ambiente; simplesmente ativar o job contínuo e prometer desativá-lo não garante esse limite. Não reutilizar as datas/contadores do ensaio encerrado. Se não houver guarda validada, manter inativo e propor uma chamada manual única com intervenção privada do usuário. Após tentativa, desativar e conferir em nova conexão; não repetir automaticamente.

## Diagnóstico: três sinais distintos

| Sinal | Evidência e interpretação |
|---|---|
| Cron/HTTP | Cron SQL bem-sucedido pode significar apenas enfileiramento. Correlacionar horário e request_id do pg_net com resposta HTTP; não imprimir headers, token ou URL privada. 204 confirma a conclusão vista pelo handler; timeout/503 exige investigar estágio e efeitos antes de repetir. |
| Heartbeat no banco | `finish_preview_sweep` ocorre após sweep completo e antes do ping. 503 pode coexistir com heartbeat fresco. Gate usa flag + heartbeat até oito minutos, nunca e-mail/ping. Não fabricar saúde. |
| Healthchecks | Ping é posterior ao heartbeat. Pode falhar ou chegar tarde. DOWN/UP é observabilidade independente; não autoriza liberar a funcionalidade. Entrega de e-mail deve ser confirmada separadamente. |
| Lease | Titular e validade indicam exclusão mútua. CAS impede heartbeat/release por titular vencido ou diferente. Erro após heartbeat pode deixar lease até expirar; não apagá-lo manualmente para repetir. |

Runner contínuo mantém healthfile separado; o comando manual não envia ping externo. Examinar cada sinal independentemente, sem extrair segredos ou dados pessoais para relatórios.

## Timeout e evidências

Revisão especializada não encontrou defeito comprovado no CAS final: claim é atômico; finish bloqueia a linha privada e revalida titular/clock_timestamp no UPDATE; release também exige titular e vigência. Nenhuma alteração especulativa nessas RPCs.

Abort limita a espera do cliente, não garante cancelamento remoto de DELETE, RPC ou ping. Um efeito pode terminar depois do timeout, e uma RPC iniciada válida pode ser observada tarde. A proteção do heartbeat depende da checagem dentro da transação no banco, não do recebimento HTTP. Chaves imutáveis, elegibilidade e bucket dedicado reduzem o risco de exclusão tardia; não substituem teste real. Ping tardio jamais é autoridade para o gate.

Comprovado anteriormente no Lab (não repetido): dez ciclos normais de três minutos HTTP204, remoção de prévia expirada e preservação das demais, DOWN confirmado, recuperação única204 e UP confirmado. Cron inativo e Healthchecks pausado ao final. Estes resultados não cobrem falhas reais nem concorrência.

Continuam sem comprovação real: falha PostgreSQL/Storage na versão final, Edge versus runner simultâneos, operações concluídas após timeout/lease e recuperação correspondente, fechamento hospedado após oito minutos e backlog no limite. Suítes Deno/Node com respostas simuladas não preenchem essas lacunas. A harness rejeitada não foi repetida ou substituída por equivalente.

## Validação local focada

Teste SQL-only usa PostgreSQL17.11 e pg_cron1.6.4 reais em container novo sem rede, `cron.launch_active_jobs=off`; Vault substituído por fixture SQL sintética apenas nesse banco descartável. Não testa Vault hospedado, HTTP, Edge ou Storage; não reproduz a harness bloqueada. Nenhum job é executado.

Preparação reproduzível (nome novo a cada execução; preservar containers anteriores):

```powershell
docker run --detach --name pcdnades-cron-sql-review-NOVO --network none --env POSTGRES_HOST_AUTH_METHOD=trust public.ecr.aws/supabase/postgres:17.11.0.006 postgres -c shared_preload_libraries=pg_cron -c cron.database_name=postgres -c cron.launch_active_jobs=off
docker exec pcdnades-cron-sql-review-NOVO pg_isready -U postgres
docker exec pcdnades-cron-sql-review-NOVO psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'create extension pg_cron;'
node backend/scripts/test-preview-cron-local.mjs pcdnades-cron-sql-review-NOVO
docker stop pcdnades-cron-sql-review-NOVO
```

O teste configura permissões locais que reproduzem a API disponível ao postgres gerenciado, sem provar ACLs de outro projeto. Não transportar seus GRANTs para produção. Verifica duas sessões concorrentes, recusa de repetição/alias, criação inativa, segredo ausente e zero execuções; SQL gerado é o próprio template, sem cópia divergente.

## Próxima validação proposta

Solicitar aprovação específica para ensaio do **instalador corrigido** em laboratório: inventário e permissões somente leitura, job existente deve fazer instalação recusar sem alteração; instalação inicial concorrente requer ambiente/job de teste dedicado aprovado, não alterar nem remover o job preservado. Não reativar o Lab por inferência. Falhas Storage/Edge/runner seguem bloqueadas até existir procedimento expressamente permitido: não apresentar a mesma harness sob outra ferramenta. Confirmar política/procedimento e escopo antes de qualquer ensaio com escrita.

GO para revisão local das correções. NO-GO para produção/ativação enquanto faltarem evidências críticas e CI do futuro HEAD publicado. Rollback de código não desfaz migration/revogação: manter flag desligada, parar coletores e preparar forward-fix autorizado; não restaurar runner legado automaticamente nem excluir dados.

Fontes oficiais consultadas: [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart) confirma sobrescrita de nome existente; [pg_cron](https://github.com/citusdata/pg_cron) documenta cron.alter_job e privilégios por proprietário.
