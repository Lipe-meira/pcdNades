# PR #20 integrado ao PR #19 — 13/11/2026

**PR #20 MERGED exclusivamente em `feat/colaboracao-identidade`; PR #19 permanece OPEN. Main e produção preservadas.** Esta entrega encerra a correção de órfãos/R1/R2; não é rollout público nem autorização para integrar o #19 à main.

## Commits e integridade

- Merge normal: [`1689f66789f5e0386dc0774136ae7e1ac10c90ab`](https://github.com/Lipe-meira/pcdNades/commit/1689f66789f5e0386dc0774136ae7e1ac10c90ab), criado pelo GitHub em 13/11/2026 12:39:49 UTC (09:39:49 America/Sao_Paulo).
- Pais exatos: base auditada do #19 `352c0e177602fc1e6e79fe817960f92c76286f43` e HEAD aprovado do #20 `f6dc3143b84d0e5bc521205e1efa0bb8160acd7a`. Merge efetuado com `expected_head_sha` e método `merge`; sem squash/rebase/force-push.
- Tree do merge e do SHA aprovado idêntica: `9f295089a834fc924ce041718bc3d0011f0b8310`. `git diff f6dc314 1689f66` vazio e ancestralidade confirmada. Chave determinística, upsert false, decode integral, fencing, bytes e inventário read-only intactos.
- HEAD de integração do #19: `1689f66`; depois desta entrega recebe somente documentação/checkpoints, sem alteração de implementação. O HEAD documental final é identificado pelo commit `docs(continuidade): encerra integração do PR 20 no PR 19` e pela referência remota `feat/colaboracao-identidade`, conferida no fechamento.
- Main permaneceu exatamente `8776ddf4d3658b1d5ecf8d91a5e13760047d8f50`. Nada foi enviado à main. PR #20 não foi reaberto nem teve sua branch reescrita; PR #19 não foi fechado/mergeado.

## Preflight de publicação — bloqueio anterior resolvido

A primeira tentativa parou porque o conector Vercel omitia settings e o navegador Windows não era suportado. Na retomada autorizada por “tenta dnv”, o **navegador integrado autenticado (IAB)** permitiu ler os controles atuais. Não foi feita nenhuma mudança de configuração nem contornado o bloqueio do Firefox.

| Projeto | Git | Produção | Preview / Branch Tracking | Deploy Hooks |
| --- | --- | --- | --- | --- |
| `pcdnades` | Lipe-meira/pcdNades | `main` | Disabled; checkbox Branch Tracking desmarcado, Save desabilitado | “This project does not have any deploy hooks” |
| `pcdnades-api` | Lipe-meira/pcdNades | `main` | Disabled; checkbox Branch Tracking desmarcado, Save desabilitado | “This project does not have any deploy hooks” |
| `pcdnades-preview-api` | Sem Git conectado | Não acionável por este push | Sem integração Git | Sem hooks; painel informa que exige conexão Git |

Fontes de leitura: páginas `settings/environments`, `settings/environments/preview` e `settings/git` dos dois projetos em `https://vercel.com/lipe-s-projects1/`; Git do auxiliar. Custom environments retornaram lista vazia via conector para frontend/API. Não foram criados previews manuais, chamadas a hooks ou modificações nos controles.

GitHub: SHAs/base/GO/CI aprovados conferidos; #20 `CLEAN/MERGEABLE`; base sem proteção/rulesets aplicáveis; merge commits permitidos. Repository hooks retornou `[]`. Somente dois Actions ativos e fontes lidas: backend e frontend, ambos apenas CI local, sem secrets Supabase, migration/deploy ou chamadas Vercel. Eventos `deployment_status`/`repository_dispatch` da integração aparecem desmarcados. Portanto o avanço de uma branch diferente de main não aciona publicação pelos mecanismos conhecidos e verificados; ausência de deployment anterior não foi usada como prova.

## Verificação pós-merge

CI do SHA aprovado: [43332518278](https://github.com/Lipe-meira/pcdNades/actions/runs/43332518278), success; [GO independente em e16b1fc](https://github.com/Lipe-meira/pcdNades/blob/e16b1fc34d0d20dd5bb388c529703f16a5cbad43/docs/REVALIDACAO-PR20-20261113.md). Nenhum teste extenso local repetido: código/tree idênticos. O GitHub executou novo CI no merge:

- [Run pós-merge 43427094800](https://github.com/Lipe-meira/pcdNades/actions/runs/43427094800), HEAD `1689f66`, job `Build, testes e ffprobe empacotado`: PASS — 322/322, 0 falhas, 0 pulos; build/bootstrap/trace/MP4 aprovados.
- A entrega documental final mantém código/configuração/migrations/workflows idênticos ao merge; [checks atuais do PR #19](https://github.com/Lipe-meira/pcdNades/pull/19/checks) conferidos após o push. A referência explícita acima registra a validação do merge, sem criar sequência infinita de commits apenas para registrar o próprio CI.
- Lista de deployments dos três projetos desde o instante do preflight: nenhuma criação após a operação, rechecado no fechamento. Produção permanece nos mesmos deployments READY: frontend `dpl_4Cx4CaU4v4s5tEwrcFG8kDBYMeSL`, API `dpl_FzbX7WDngPU3YZHwqJUz5SuVPNhq`, ambos commit main `8776ddf`.
- Metadados de env da API, sem decriptar valores: nenhuma variável `CONTRIBUTOR*`; flags continuam nos padrões `false` de `config.ts`. Nenhuma env, flag, configuração Vercel ou recurso Supabase foi alterado. Nenhuma migration remota nem operação Storage foi executada.
- Worktrees/arquivos parciais dos demais agentes preservados; registros locais anteriores em `96c2288`/`fe7c855` não foram misturados à implementação nem empurrados para main. Documentação final preparada em worktree/branch próprios `F:/projetos/nadesCs2-integrated-pr20` / `codex/registro-integracao-pr20-20261113`, a partir do merge e enviada por fast-forward à branch do #19.

## Continuidade e limites

Riscos residuais do GO permanecem: TTL produtivo e tokens históricos; reconciliação/backfill ao reaplicar migration 2; órfãos por tentativa de importador/worker; 503 sem retomada automática completa na interface; classificação genérica de falhas do ffprobe; decode lento consumindo tentativas; dois processos hospedados independentes ainda não comprovados; capacidade/antiabuso, gateway/TLS, provedores e validações públicas. Integração do código não resolve nem ativa esses itens.

**Próximo passo para #19 → main:** autorização específica para essa integração e um plano de publicação separado com backup/restauração, migrations coordenadas, revisão dos gates operacionais e flags mantidas desligadas até aprovação própria. Não executar essa etapa por inferência. Não iniciar PR B ou PR C.

Continuidade: `docs/continuity/backend.md` e `docs/continuity/orchestrator.md`, com o registro atual no topo e histórico anterior preservado. Esta tarefa termina após confirmar PR20 MERGED, PR19 OPEN, CI final verde e ausência de novos deployments.
