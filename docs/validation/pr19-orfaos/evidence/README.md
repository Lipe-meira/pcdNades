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
