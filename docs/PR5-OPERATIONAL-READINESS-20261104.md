# PR5 — evidências consolidadas e publicação para revisão

04/11/2026. GO para revisão em Draft; **NO-GO para produção, merge ou ativação**. Correção local validada0c602609ee221b9a7525a503ef01be011e2cb570; documentação desta entrega acompanha a mesma branch. Consultar HEAD/CI do PR para a versão publicada, sem inferir aprovação operacional do CI.

## Escopo e proteção da publicação

PR https://github.com/Lipe-meira/pcdNades/pull/5, base main, branch codex/tiktok-preview-edge-review-20261103. Antes da entrega remoto03b632fa367feafcd4d55ecd20de12ded75dbbb7, mainf4389af34807c0f5f31a23d9e4b6c0649d19b1b5. Fetch confirmou fast-forward possível, sem alterações remotas concorrentes. Sem frontend/downloader/contratos/dependências adicionais nesta correção; migration de lease existente no PR preservada, não executada por CI.

Preflight Vercel por leitura autenticada no painel: pcdnades e pcdnades-api, ambos Production Branch=main; Preview Branch Tracking=off. São os dois projetos vinculados ao repo no contexto Git da equipe. Projeto pcdnades-preview-api não aparece vinculado a esse Git. Não modificar essas configurações; se mudarem, a conclusão precisa revisão antes de novo push. O conector resumia projetos sem esses campos e a credencial CLI recebeu403; painel resolveu a lacuna sem alterar recursos ou revelar variáveis.

Workflow .github/workflows/backend-linux.yml: push em main e pull_request filtrados por backend; contents:read, sem segredos/SQL/deploy. Compila/testa/bootstrap/trace/MP4 sintético. Não executa o script de regressão SQL local automaticamente, nem comprova Edge/Deno/serviços hospedados. Apenas push nesta branch foi autorizado; sem main, deploy ou Supabase.

## Evidências aprovadas — não repetir sem motivo

| Escopo | Comprovação | Limite |
|---|---|---|
| Gateway Lab | POST sem token e token inválido recusados401 | Não testa abuso de recursos |
| Sweep sintético real |204; job/objeto vencidos removidos; job vigente e sentinela de mídia final preservados | Não falha no meio da exclusão |
| Integridade anterior pós-sweep | Dois arquivos1860bytes, SHA25611DCA3EA979EA2088D4E18D55CDFFE9CB42B93F69F627913B0AA38E9716F6FCE | Leituras posteriores conferiram metadados, não novo hash de bytes |
| Cron real Lab com migration final | Dez ciclos de três minutos, dez HTTP204 | Não carga ou falhas reais |
| Monitor independente | DOWN por e-mail confirmado; recuperação única204, ping e UP confirmado | Não demonstra SLA ou efeitos após timeout |
| Instalação concorrente local | PG17.11/pg_cron1.6.4, duas sessões, uma instala inativo e outra recusa; repetição/alias/segredo ausente recusados; zero jobs executados | Vault fixture SQL; não é instalação concorrente hospedada |
| Recusa hospedada do instalador |04/11 14h52 Brasília; DO exato0c60260 em READ ONLY, exceção esperada P0001, ROLLBACK; outro backend confirmou estado idêntico | Não prova criação hospedada; job existente preservado |
| Gate local com Lab real |04/11 15h19 Brasília, três GET200, função real uma chamada, argumento true local, idade~4.043.317ms e resultado false; leitura final igual | Não HTTP hospedado nem transição saudável→vencido |
| Node/Deno |13 testes Node e6 Deno simulados; TypeScript e Deno check PASS no código da correção | Não equivalem a falhas reais |

Lab qtixfjntddsxjirxwqon: nove migrations. Último estado conferido do Cron id1 pcdnades-preview-sweep-lab: inactive,11 execuções concluídas e nenhuma em andamento; lease livre, fila HTTP vazia. Heartbeat17:12:02UTC; Healthchecks pausado ao final do ensaio anterior, não reativado. Fixture ready vence04/11 às18:08 Brasília. Depois de vencer, não executar coletor presumindo preservação: preparar novas fixtures/proteção somente com autorização. Nenhum estado de checkpoint autoriza novas operações.

## Correções e limites de segurança

- Instalador agora contém check/schedule/desativação numa transação DO, advisory_xact_lock762001141 e recusa job/aliases reconhecidos, segredos faltantes/vazios/duplicados. Exige postgres e instala inativo via cron.alter_job. Nenhum FOR UPDATE/UPDATE direto em cron.job. Somente operadores cooperantes usam o lock; administradores fora do protocolo não são impedidos. Inventário e operador exclusivo continuam pré-requisitos.
- Corrigida mensagem do comando manual: falha pode ocorrer depois do heartbeat. Um teste simulado cobre falha de release posterior. Heartbeat do banco, HTTP do coletor e ping externo são sinais distintos.
- Revisão do CAS não identificou defeito comprovado: claim atômico, finish/release condicionados a titular e vigência. Cancelamento local não garante cancelamento remoto. Não modificar migration histórica por hipótese.
- Runner legado não participa do lease novo e pode limpar antes de falhar no heartbeat revogado. Precisa ser parado e drenado antes da migration/Edge. Runner PR5 usa as três RPCs; rollback de código não desfaz revogação.
- Configuração privada de teste fica fora do Git; não versionar .env, tokens, URLs assinadas, vídeos ou evidências privadas. Relatórios só contêm dados sanitizados.

## Bloqueios críticos e próximo plano

1. **Falhas reais PG/Storage e efeitos tardios:** falta comprovar o comportamento do código final quando a operação externa falha ou conclui depois de timeout/lease. A harness PowerShell/Deno anteriormente rejeitada não pode ser reproduzida por outra ferramenta, fragmentação ou equivalente. Não há procedimento real alternativo já aprovado para esses mesmos cenários. Próxima ação é obter avaliação/autorização de um procedimento expressamente permitido; caso não exista, manter bloqueio e não declarar GO.
2. **Interoperabilidade Edge/runner:** CAS revisado e simulado não comprovam concorrência real dos dois runtimes. Mesmo requisito de procedimento permitido, ambiente isolado e autorização específica; não usar produção nem os arquivos preservados como alvo.
3. **Gate hospedado:** o gate local com dados reais está aprovado. Um ensaio da capability no runtime hospedado requer plano separado, exclusivamente Lab, sem produção; listar recursos/configurações e obter aprovação antes de qualquer deploy/flag. Não confundir uma leitura com heartbeat antigo com a transição temporal completa.
4. **Revisão/CI:** esta publicação disponibiliza as correções e relatórios no Draft e exige CI do HEAD exato. PASS de CI libera revisão de código, não os três gates operacionais acima.

Permitidos e comprovados nesta entrega: revisão local, testes simulados identificados, SQL-only local, ensaio hospedado readonly de recusa e leitura real do heartbeat por backend local. Não autorizados para esta publicação: novos ensaios remotos, injeção de falhas, concorrência, atualização de Edge/migration/Vault/Cron/monitor, flags ou deploy.

Esforço restante concentra-se em validação operacional, não em reescrever player/downloader. Estimativa de planejamento: uma sessão curta para fechar o procedimento permitido/matriz de evidências; ao menos uma janela isolada de ensaio para falhas/concorrência e outra validação hospedada de gate, se autorizadas. Não estimar prazo de lançamento enquanto houver bloqueio de procedimento ou resultados desconhecidos. Corrigir apenas defeitos que esses ensaios comprovarem.

## Sequência futura, sem execução

Fechar procedimento e evidências críticas → revisão/CI do HEAD final → preflight produtivo/backup-restauração fresco → autorizações específicas de migration e parada/drenagem de runner legado → publicação coordenada → instalação Edge/segredos/monitor/job inicialmente inativo → teste controlado → autorização de flag. Reels/YouTube fora do escopo. Falha interrompe sem retry/rollback automático; preservar dados. Código revertido não desfaz banco: priorizar forward-fix autorizado ou coletores parados e flag desligada.

Operações detalhadas: PR5-TECHNICAL-CORRECTIONS-20261104.md. Recusa: PR5-INSTALLER-LAB-PLAN-20261104.md. Gate: PR5-HEARTBEAT-GATE-TEST-PLAN-20261104.md. Continuidade: docs/continuity/backend.md.
