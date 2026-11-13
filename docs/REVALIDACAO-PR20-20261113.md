# Revalidação FINAL do PR #20 — 13/11/2026

**GO: o PR #20 está pronto para integração no HEAD `f6dc3143b84d0e5bc521205e1efa0bb8160acd7a`, sobre o PR #19 em `352c0e177602fc1e6e79fe817960f92c76286f43`. R1 e R2 encerrados. Nenhum novo bloqueador encontrado no delta revisado.** O parecer substitui o NO-GO anterior exclusivamente quanto a esse novo HEAD; não autoriza merge ou ativação pública.

## Escopo e proveniência

Revalidação focada de `e5add826b4affb14b4390c5f42c43184ac814796..f6dc3143b84d0e5bc521205e1efa0bb8160acd7a`, sem repetir a auditoria anterior. Foram lidos o [relatório original no commit documental d306266](https://github.com/Lipe-meira/pcdNades/blob/d306266646ab7b4a0b7ae31fea74d88a7fd204ef/docs/REVISAO-PR20-20261112.md), o delta completo de implementação/testes e as novas evidências. Código corrigido em `7e2fb4f`, documentação/evidências em `f85493e`, checkpoint em `f6dc314`.

Branch própria: `codex/revalidacao-pr20-20261113`; worktree `F:/projetos/nadesCs2-review-pr20-final`. PR/base/HEAD confirmados pelo GitHub; merge-base continua `352c0e1`. Apenas `inline.ts` e `trimming.ts` mudaram na implementação desde o SHA reprovado. Nenhuma alteração em frontend, migrations, chave/upsert, inventário ou ferramenta de TTL nesse delta.

## Fechamento dos bloqueadores

| Item | Verificação e conclusão |
| --- | --- |
| **R1 — encerrado** | `inline.ts:28` chama `decodeVideoOutcome` sobre **stored.mp4 baixado**, depois de download limitado, probe e duração, antes da publicação. Resultado inválido vira `STORED_CLIP_INVALID`; não adota nem altera o objeto. A rotina usa os mesmos argumentos de decode do corte novo: uma thread, 20 s, buffer de 64 KiB, AbortSignal. A fixture real com `moov` válido e payload truncado passa no probe, falha no decode e **não** vira `ready`; o controle íntegro é adotado. |
| **R2 — encerrado** | Falhas de assinatura/download/`info` ambíguo e decode sem conclusão retornam `503 STORAGE_UNAVAILABLE` sem transição terminal. A mídia conserva `processing`, lease e reserva; chamada com lease ativo devolve 202 sem trabalho; após expirar, novo claim consome a próxima tentativa. Três tentativas continuam sendo o limite e terminam em `ATTEMPTS_EXHAUSTED` sem liberar reserva indevidamente. A tentativa antiga não escreve no caminho transitório; a confirmação de sucesso/conteúdo inválido continua fenciada por status/tentativa/lease/validade. `failed` não é reaberto. |

Os testes cobrem inclusive o sinal realmente abortado no prazo de 110 s, usando relógio simulado, e a tentativa antiga que perde a mídia para outra instância. A mudança em `decodeVideo` preserva seu contrato anterior para os demais chamadores: qualquer resultado diferente de `ok` lança `INVALID_MEDIA`, ou `PROCESSING_TIMEOUT` quando o sinal está abortado.

## Ausência de regressão nos invariantes

- `clipOutputKey(id) = <id>/clip.mp4`, assinatura com `upsert:false` e PUT com `x-upsert:false` estão inalterados. Não foi introduzida exclusão ou sobrescrita; tokens do usuário continuam limitados à fonte.
- O caminho de adoção publica os bytes do objeto efetivamente baixado, conserva `sourceBytes` e mantém a reserva máxima em falhas transitórias/terminais. Os testes de E03, resposta perdida, codificações com tamanhos diferentes, esgotamento e preservação de objeto publicado continuam passando.
- O lease de 120 s, fencing de claim/conclusão e limite de três tentativas não foram enfraquecidos. A nova recuperação não reduz reserva nem modifica linha de titular posterior.
- Inventário/TTL e contratos administrativos não mudaram; sua aprovação anterior continua aplicável. Não foram repetidas suas suítes nem a auditoria geral de autorização/edição/playback.

## Verificações independentes nesta retomada

Dependências instaladas apenas no worktree próprio com `npm ci --ignore-scripts`. FFmpeg Windows b6.1.1 preparado com o script existente e SHA-256 validado, sem tocar arquivos versionados. `npm run typecheck`: **PASS**.

```text
npx tsx --test tests/clip-adoption-hardening.test.ts tests/clip-retry-accounting.test.ts tests/inline.test.ts tests/trimming.test.ts
44 testes / 44 PASS / 0 FAIL / 0 SKIP
```

Os 18 testes novos de adoção foram executados, inclusive os três casos com FFmpeg/ffprobe reais. O restante cobre os caminhos diretamente afetados e os invariantes anteriores. Não foram escritos testes novos nesta revisão; a cobertura existente já demonstrava os casos necessários. PGlite executa SQL/triggers em processo e os adaptadores simulam Storage/rede/trim onde indicado nos testes. Isso não é execução independente do laboratório Supabase.

**CI do HEAD atual:** [run 43332518278](https://github.com/Lipe-meira/pcdNades/actions/runs/43332518278), job `Build, testes e ffprobe empacotado` **success**. Metadados e logs consultados: **322/322, 0 falhas, 0 pulos**, build, bootstrap serverless, trace do executável Linux e verificação de MP4/codec/corrupção concluídos. Não dependi somente do CI do commit anterior citado pelo autor nem disparei outro workflow.

## Evidências de laboratório reaproveitadas e conferidas

Lidos `adocao.ts`/`adocao-launch.mjs`, §11 de `ORFAOS-RETENTATIVAS-20261112.md` e os nove JSONs sob `evidence/pr20-r1-r2/`, incluindo a rodada anterior que falhou. Conferidos os cinco hashes de fonte contra o HEAD atual (LF/CRLF) e as dez somas físicas do laboratório `-r72` a partir de `adocao-physical-sizes.txt`: iguais ao resumo e a `storage.objects`. Para todos os casos corrigidos `ready`, físico = cobrado.

- Baseline `e5add82`: 3/3 cenários **reproduzem** os defeitos/controle. Corrigido: **8/8**, incluindo rejeição do truncado com objeto preservado, controle íntegro, retomada após 503 em assinatura/download/`info`, esgotamento e disputa entre módulos.
- A corrida usa dois módulos isolados no mesmo processo contra PostgreSQL/Storage reais: novo=200, antigo=202, linha publicada intacta, físico=cobrado=231.586 B. Não prova dois processos hospedados independentes.
- O ensaio `-r71` preservado registra uma falha por `CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED` na criação da fixture da corrida. A repetição `-r72` em laboratório novo passou; não foi descartada uma falha da implementação sem explicação.
- Fluxo documentado `-r72`: 29 registros PASS, incluindo backup/restauração sintéticos (48 tabelas idênticas). Isolamento registrado: rede interna, zero portas publicadas e egress bloqueado. Nesta retomada nada do laboratório foi iniciado, modificado ou repetido.

## Riscos residuais que permanecem separados do GO de integração

1. **Recuperação na interface:** o frontend propaga 503 e não repete essa chamada automaticamente. A API exige nova `complete` após o lease (até 120 s), antes de esgotar tentativas; não foi prometida recuperação automática da interface neste PR.
2. **Classificação do ffprobe:** `probeOriginal`, inalterado, ainda converte falhas locais de execução/timeout não sinalizado em `INVALID_MEDIA`. Esse limite preexistente está explicitado no §11; não é a falha de assinatura/download que motivou R2. Não se afirma recuperação de toda falha possível de infraestrutura. Decode acima de 20 s é transitório na adoção e pode esgotar as três tentativas.
3. **Operação pública:** TTL produtivo/tokens históricos, reconciliação após reaplicação da migration 2, órfãos de importador/worker, processos hospedados independentes, capacidade, antiabuso e demais gates anteriores continuam pendentes. O GO não habilita contribuições nem altera flags.

**Conclusão: GO técnico para encerrar a revisão do PR #20 como pronto para integração neste SHA e nesta base.** Implementação e PRs preservados; sem merge, deploy, migrations, mudanças em produção ou nova auditoria geral. Trabalho encerrado após registrar e enviar a documentação da branch própria.
