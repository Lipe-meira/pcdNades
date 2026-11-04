# Instalador PR5 — plano restrito no Lab

Estado final: única tentativa autorizada concluída com PASS; consultar resultado abaixo. Plano histórico preservado, sem autorização para repetição.

04/11/2026, consulta às 14h46 Brasília. HEAD local `0c602609ee221b9a7525a503ef01be011e2cb570`; sem push. Este documento prepara um ensaio: não o executa nem autoriza recursos novos.

## Preflight realizado somente por leitura

- Lab `qtixfjntddsxjirxwqon`, ACTIVE_HEALTHY, São Paulo, organização `maalmxusvlnltyqhzjds`; PostgreSQL17.11, nove migrations preservadas. Produção não consultada por SQL nem alterada. Listagem de projetos confirmou os outros dois projetos inativos.
- pg_cron1.6.4, pg_net0.20.4, Vault0.3.1.
- Um job: id1, `pcdnades-preview-sweep-lab`, proprietário postgres, `*/3 * * * *`, inactive. MD5 do comando `7454fb1d1c20f2b75b5e0c01895dacef`. Onze execuções concluídas, nenhuma em andamento, fila HTTP vazia.
- Vault contém uma ocorrência de cada nome `preview_sweep_url`, `preview_sweep_token`, `preview_sweep_apikey`. Valores não consultados. Segredos da Edge não foram listados nesta revisão; não confundir Vault com configuração da função.
- Proprietário da conexão postgres, BYPASSRLS=true. Visibilidade integral sobre cron.job (RLS enabled, não forçada, policy por username). Pode SELECT, schedule e alter_job; não pode UPDATE cron.job. Não conceder novos privilégios.
- Lease global livre; heartbeat permanece em 04/11 17:12:02UTC.
- Um job ready com validade até 04/11 21:08:56UTC (18:08 Brasília). Dois objetos privados de1860bytes, um por bucket import-previews/videos-staging; ETags preservados. Metadados não são prova de hash dos bytes: nenhum download foi repetido.
- Healthchecks não acessado nem reativado nesta etapa; última evidência registrada é pausado.

## Revisão do commit e evidências reaproveitadas

Sete arquivos,197 inserções/9 remoções. Sem migration/Edge/downloader/frontend alterados. Instalador serializa check/schedule/desativação em DO único; recusa alias do job existente antes de schedule, mas depois da verificação interna dos segredos. Hash SHA256 do arquivo local `AF5B76CA6865924B9445BE005E4FE539D36074BEB05BC7660541A77C75FAD62E`; preservar codificação e quebras de linha ao comparar arquivo físico. Comparar também blob fixado no commit para evitar divergência de checkout.

Já aprovado localmente: SQL pg_cron real com duas sessões e criação inativa, recusa de repetição/alias/segredo ausente; Node13, Deno6 simulados e TypeScript. Não repetidos nesta etapa. Não inferir CI remoto para commit local ainda não publicado.

## Ensaio mínimo proposto — aguardando autorização

Não é preciso criar, remover, renomear ou substituir o job atual para comprovar a **recusa**. Executar uma única avaliação, sem retentar:

1. Reconfirmar destino/identidade postgres, SHA do instalador e operador exclusivo. Conexão exclusiva ao Lab, sem saída de valores privados. Conferir fixtures/estado inicial.
2. Abrir `BEGIN READ ONLY`, com lock_timeout/statement_timeout curtos; adquirir advisory_xact_lock762001141. Não usar FOR UPDATE em cron.job.
3. Guardas obrigatórias: exatamente um job total; id1/nome/proprietário/schedule/inactive/hash acima; zero execução em andamento e fila HTTP vazia. Se houver divergência, abortar antes do instalador.
4. Avaliar o DO **exato** do commit0c60260 nessa mesma transação. Esperado: exceção `Job already exists; inspect it before installation`, sem atingir cron.schedule/alter_job/net.http_post. O código verifica segredos internamente, sem retorná-los. READ ONLY funciona como proteção adicional: qualquer tentativa de escrita deve falhar mesmo se houver um erro no caminho previsto.
5. Fazer ROLLBACK explícito; em desconexão, não retentar automaticamente. Uma resposta inesperada ou erro diferente é FAIL, investigar sem nova execução.
6. Em conexão nova somente leitura, comparar contagem, id, active, schedule e hash do comando, histórico, fila HTTP, lease, heartbeat, job da fixture e metadados dos dois objetos. Tudo deve permanecer igual, salvo avanço do relógio/expiração natural. Não invocar função nem fazer ping para verificar resultados.

Critério PASS: exceção esperada, nenhuma alteração persistente, nenhum job/executável novo ou resposta HTTP nova. READ ONLY não significa que código foi executado nesta preparação: depende da autorização específica do usuário para a avaliação proposta. Esse ensaio não é a harness de falhas rejeitada nem substitui seus cenários.

## Operações de escrita e escopo não solicitado agora

Ensaio de recusa acima: nenhuma escrita necessária. Instalação bem-sucedida usaria cron.schedule e cron.alter_job para criar um job inativo; concorrência hospedada exigiria duas sessões de instalação e ambiente dedicado aprovado. No Lab atual o instalador deve recusar por desenho. Não desabilitar a guarda, alterar nomes arbitrariamente, apagar o job existente ou trocar seu comando para forçar sucesso.

Se o usuário quiser comprovar criação no serviço gerenciado, será necessário aprovar separadamente um ambiente dedicado sem o job preservado, ou outro procedimento de teste explicitamente revisado, incluindo criação e descarte. Não criar outro projeto/job por inferência. Ativação, execução e limpeza de fixtures exigiriam autorizações adicionais e plano atualizado para o vencimento delas.

## Bloqueios independentes para lançamento

Mesmo com PASS da recusa: faltam falhas reais PG/Storage na versão final, concorrência Edge/runner e interoperabilidade, requisições concluídas após timeout/lease e gate hospedado após8min. Não usar simulação como comprovação e não reproduzir a harness bloqueada por equivalentes. Para esses ensaios, primeiro obter procedimento expressamente permitido e aprovação específica de ambiente/efeitos.

Também faltam revisão/CI do futuro HEAD publicado, preflight/backup de produção e aprovações separadas de migration do lease, rollout coordenado com parada do runner antigo, merge/deploy, infraestrutura/segredos/monitor e flag. Nenhuma aprovação atual cobre esses passos. GO para propor ensaio de recusa; NO-GO para lançamento/ativação.

## Resultado da única tentativa autorizada — PASS

Executada em04/11/2026 às17:52:12.814UTC (14:52 Brasília), exclusivamente no Lab. Commit0c602609ee221b9a7525a503ef01be011e2cb570 e SHA físicoAF5B76CA6865924B9445BE005E4FE539D36074BEB05BC7660541A77C75FAD62E reconfirmados; git diff do instalador contra commit vazio. DO obtido por git show, sem edição. Preflight17:51:38UTC encontrou zero outras sessões cliente não idle e advisory lock livre; não é garantia contra novo operador futuro, por isso guardas foram repetidas dentro da transação.

Uma única chamada com BEGIN READ ONLY, lock_timeout2s, statement_timeout8s e advisory_xact_lock762001141. Guardas conferiram postgres, transação readonly, jobid/nome/proprietário/schedule/hash/inactive,11 execuções, ausência de execução/fila e lease livre. Wrapper de controle executou o DO exato por EXECUTE uma única vez; capturou exclusivamente SQLSTATE P0001 com mensagem exata `Job already exists; inspect it before installation`. Qualquer outra exceção seria propagada; sucesso inesperado seria erro. O wrapper permitiu chegar ao ROLLBACK explícito, sem deixar o lote interrompido em transação abortada. Resultado retornou read_only=on e PASS. Não ocorreu retry.

Leitura posterior às17:52:18UTC em outro backend PostgreSQL (PID100619 versus100617 da tentativa), em transação própria somente leitura. Comparação automática dos resultados retornados:

| Evidência | Antes/depois |
|---|---|
| Jobs | Um, id1, mesmo nome/schedule/proprietário/hash, active=false |
| Histórico |11 execuções totais, zero em andamento |
| Fila pg_net | Zero |
| Lease global | holder/locked_until nulos |
| Heartbeat |17:12:02.332103UTC, sem renovação |
| Fixture | Mesmo job ready, mesmas colunas/expiração |
| Storage | Mesmos dois objetos1860bytes; metadados/ETags iguais |
| Lock instalador | Livre ao final |

PASS da recusa hospedada. Não houve cron.schedule, cron.alter_job, HTTP da Edge ou alteração do Vault; leituras internas do DO não retornaram segredos. Não foram baixados bytes dos arquivos nesta etapa; não afirmar novo hash de conteúdo. Healthchecks não foi acessado ou reativado. Nenhum SQL em produção, push, merge ou migration. Trabalho documental permanece local.

## Próximo plano centrado nos bloqueios críticos

1. Não repetir o instalador nem os dez ciclos/player/alertas já aprovados. Caminho de criação e concorrência do instalador tem evidência local, não hospedada; decidir em revisão se isso basta para o rollout futuro ou se exige ambiente dedicado autorizado, sem tocar no job preservado.
2. Preparar separadamente uma verificação do gate via backend local configurado exclusivamente para leitura do Lab, com a flag local de teste explícita e heartbeat já vencido. Provar indisponibilidade por idade do heartbeat, sem atualizá-lo nem esperar novo ciclo. Isso comprova o caso vencido, não a transição completa hospedada. Não usar a configuração de produção.
3. Falhas reais PG/Storage, interoperabilidade Edge/runner e conclusão tardia continuam NÃO comprovadas. Antes de executar, obter procedimento expressamente permitido e autorização de ambiente/efeitos; não reconstruir a harness rejeitada nem mudar ferramenta para a mesma ação. Se não houver procedimento permitido, manter bloqueio explícito e NO-GO em vez de substituir por simulação.
4. Depois de fechar essas evidências: revisão do diff/CI do HEAD que for autorizado para push; só então plano de produção com backup, parada do runner legado, migration exclusiva, infraestrutura e flag sob aprovações separadas. Não aprovar operacionalmente apenas pelo PASS desta recusa.

Estado final: Cron inativo, Healthchecks anteriormente pausado sem alteração, fixture preservada (vence18:08 Brasília). Não executar coletor após vencimento sem nova proteção/autorização. NO-GO para ativação enquanto os bloqueios críticos permanecerem.
