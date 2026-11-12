# Evidências — validação de órfãos em retentativas (laboratório `pcdn-pr19-352c-20261112-r70`)

Dados sintéticos; sem chaves, JWT, URLs assinadas nem dumps. Análise completa em `docs/ORFAOS-RETENTATIVAS-20261112.md`.

| Arquivo | Conteúdo |
|---|---|
| `isolation.json` | Rede interna, nenhuma porta publicada, sem privilégio, baseline de recursos anteriores preservado, saída bloqueada (`ENETUNREACH`). |
| `documented-flow-results.json`, `backup-restore.json` | Fluxo documentado completo (`docs/validation/pr19/launch.mjs`) sobre o código corrigido: 28 verificações + backup/restauração sintéticos (29 PASS, 0 FAIL). |
| `orfaos-pr19-src.json` | F1–F3 contra o código do PR #19 (352c0e1): reproduz +55.820 B fora da cobrança. |
| `orfaos-src.json` | F1–F3, T1, T2 e I1 contra a correção. |
| `orfaos-summary.json`, `orfaos-physical-sizes.txt` | Bytes físicos medidos por `find/stat` no volume do Storage x `storage.objects` x `storage_charge_bytes`. |
| `inventory-cli.json` | Saída de `backend/scripts/storage-inventory.ts` (duas leituras, TTL 60 s) sobre todo o estado do laboratório. |
| `run1-script-defect/`, `run2-f3-expectation/` | Rodadas anteriores, mantidas de propósito: falharam por defeito do meu script (cliente `service` reaproveitado para login anônimo) e por expectativa errada (o Storage recusa **emitir** nova URL para chave existente). As linhas F1/F2 já mostravam o mesmo resultado. |

## R1/R2 do PR #20 (`pr20-r1-r2/`)

Cenários `docs/validation/pr19-orfaos/adocao.ts` + `adocao-launch.mjs` em laboratório novo `-r72` (serviços reais; falhas 503 pontuais injetadas por proxy no processo do teste, MP4 truncado gerado com FFmpeg real). Comparam o SHA revisado `e5add82` (reproduz R1 e R2) com a correção.

| Arquivo | Conteúdo |
|---|---|
| `adocao-pr20-src.json`, `adocao-src.json`, `adocao-summary.json` | Resultados (3/3 no SHA revisado reproduzindo os defeitos; 8/8 na correção), bytes físicos por `find/stat` x `storage.objects` x cobrança. |
| `adocao-physical-sizes.txt` | Listagem física do volume do Storage. |
| `documented-flow-results.json`, `backup-restore.json`, `isolation.json` | Fluxo documentado completo sobre o código corrigido neste laboratório (29 PASS), backup/restauração sintéticos e isolamento. |
| `run1-r71-budget-exhausted/` | Primeira rodada (`-r71`), mantida de propósito: tudo passou, exceto a corrida real, que falhou com `CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED` (orçamento global do laboratório consumido por reservas retidas de mídias `failed`). Os cenários foram reordenados e repetidos em ambiente novo. |
