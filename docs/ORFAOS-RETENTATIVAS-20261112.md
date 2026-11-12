# Órfãos em retentativas, validade das URLs assinadas e política de limpeza — 12/11/2026

Base: SHA aprovado do PR #19 `352c0e177602fc1e6e79fe817960f92c76286f43` (a branch do PR não foi alterada).
Origem do achado: `docs/validation/pr19/REPORT.md` (branch documental `codex/validacao-integrada-pr19-20261112`), caso E03.
Escopo: somente backend/documentação. Nenhum merge, deploy, migration, flag, exclusão de dados reais, PR B ou C. Nenhuma migration nova.

## 1. Causa exata

Em `backend/src/inline.ts` o trecho recortado era gravado em `<id>/clip-<tentativa>.mp4`, mas `media_assets` guarda **uma só** `storage_key`, e a cobrança (`storage_charge_bytes`) assume fonte + **um** trecho.

1. A tentativa 1 grava `clip-1.mp4` no Storage.
2. A confirmação seguinte é um `UPDATE` fenciado (`status='processing' AND attempts=N AND locked_until=<claim> AND locked_until>now()`). Se o lease já expirou (E03 injeta isso ao entrar em `storing`) ou o banco falha, o `UPDATE` não aplica e o código só devolve 202, sem registrar nem tratar o objeto que acabou de gravar.
3. A tentativa 2 recebe `attempts=2` e grava `clip-2.mp4` (outra chave). O banco passa a apontar para `clip-2.mp4`.
4. `clip-1.mp4` continua no Storage sem linha, sem cobrança e sem inventário: 55.820 B no laboratório.

Não há transação entre PostgreSQL e Storage, então "gravou e não confirmou" é um estado real que precisa de tratamento por desenho. As variantes que produzem o mesmo estado (todas reproduzidas no laboratório com o código do PR #19): lease perdido (E03/F1), banco indisponível na confirmação (F2) e, por raciocínio equivalente, processo que morre entre a gravação e a confirmação.

A divergência do `clip-N` por tentativa é a causa raiz. O limite de tentativas (3) e o fencing do banco estavam corretos: o fencing impede publicar, mas não pode impedir que o Storage receba uma escrita.

## 2. Solução escolhida

**Chave única por mídia + adoção verificada. Nada é apagado.**

- `clipOutputKey(id) = <id>/clip.mp4`, igual em todas as tentativas (`backend/src/clip-storage.ts`).
- A gravação continua com `upsert:false` (já era assim; o Storage real recusa até **emitir** nova URL para chave existente: `The resource already exists`, F3).
- Se a gravação falhar e `info(<id>/clip.mp4)` mostrar que o objeto existe, a tentativa corrente o **baixa com limite de bytes, valida** (contêiner/codec via `ffprobe`, duração igual à do intervalo da mídia ±0,1 s, limite de bytes) e **adota** com os **bytes reais do objeto armazenado** em `metadata.bytes`. Se a validação falhar, a mídia vira `failed` (`STORED_CLIP_INVALID`) e o objeto é preservado, nunca sobrescrito nem apagado.
- A adoção só acontece depois do `claim` fenciado e a publicação continua exigindo o `UPDATE` fenciado final; uma tentativa antiga não publica nada.
- Evento de log por adoção: `{"event":"clip_output_adopted","mediaId":...,"attempt":N}` (sinal de detecção, sem dados pessoais).

Invariante obtido: por mídia com corte só pode existir `source.mp4` + `clip.mp4`, que é exatamente o que a reserva de 100 MB (e depois `fonte + trecho`) cobre. Isso vale também para o escritor antigo que acorda depois (a segunda escrita é recusada pelo Storage) e para uma resposta perdida do próprio Storage (o objeto é adotado na mesma tentativa).

### Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| `upsert:true` com chave fixa | Um escritor antigo pode sobrescrever o objeto **publicado** depois da retentativa e deixar `metadata.bytes` incorreto. Viola "preservação de objetos publicados". |
| Manter `clip-N` e apagar o objeto da tentativa perdida (como o importador faz após `failed` fenciado) | Exclusão automática sem as provas exigidas; só cobre o caso em que a escrita `failed` também aplica (em E03 ela não aplica). Um escritor pausado ainda recria o órfão depois da limpeza. |
| Varrer `clip-1..N` ao ficar `ready` e apagar | Mesmo problema de exclusão automática e não protege contra escrita tardia. |
| Aumentar a reserva para fonte + 3 trechos (200 MB) | Dobra a reserva por mídia e derruba a capacidade global (400 MB) para 2 mídias; só esconderia o problema. |
| Registrar a chave antes de gravar (coluna/tabela nova) | Exige migration adicional na sequência já ordenada do PR #19; a chave determinística dispensa o registro. |
| Reconciliação periódica automática | Primeiro inventário e dry-run (§6); exclusão só com as provas listadas no pedido. |

## 3. O que não foi tratado (fora deste PR)

- **Importações** (`<id>/import-<tentativa>.mp4`, `import-processing.ts`) e **worker-transcode** (`<id>/playback-<tentativa>.mp4`, com `upsert:true`, só administrador) têm a mesma forma de chave por tentativa e, portanto, o mesmo risco. O E03 reproduziu apenas o upload com corte, e a importação depende de provedores ainda não validados, então não foi alterada. O inventário classifica esses objetos (`attempt_output_unreferenced`). Recomendação: PR separado aplicando a mesma técnica (chave única + adoção verificada) ao importador.
- A cobrança zerada ao reaplicar a migration 2 sobre mídias existentes (ressalva do relatório) continua valendo; o inventário a quantifica (§6), mas não há backfill automático.

## 4. Bytes físicos x contabilidade (laboratório novo, serviços reais)

Medição independente: `find/stat` no volume do Storage (`orfaos-physical-sizes.txt`), conferida com `storage.objects` e com `storage_charge_bytes`. Ambiente `pcdn-pr19-352c-20261112-r70`: PostgreSQL 17.11, GoTrue 2.197.0, PostgREST 14.12, Storage 1.84.19, FFmpeg real, MP4 sintético, rede interna, nenhuma porta publicada.

| Cenário | Código | Arquivos físicos | Físico | Cobrado | Diferença |
|---|---|---|---|---|---|
| F1 lease perdido em `storing` (E03) | PR #19 (352c0e1) | source 175.766 + clip-1 55.820 + clip-2 55.820 | 287.406 | 231.586 | **+55.820** |
| F2 banco indisponível na confirmação | PR #19 | idem | 287.406 | 231.586 | **+55.820** |
| F1 | **corrigido** | source 175.766 + clip 55.820 | 231.586 | 231.586 | **0** |
| F2 | **corrigido** | idem | 231.586 | 231.586 | **0** |

Nas execuções do laboratório com a correção o log registrou `clip_output_adopted` com `attempt:2` nos dois cenários (saída do runner; não guardada como arquivo de evidência); a asserção de F1 confirma `metadata.bytes` igual ao tamanho do objeto armazenado. No laboratório as duas codificações (com `-threads 1`) tiveram o mesmo tamanho (55.820 B); o caso de codificações de tamanhos diferentes só foi exercitado nos testes automatizados (§7).

Objeto publicado (F3): publicar a granada, repetir `complete` três vezes e pedir nova capacidade de upload para a chave publicada deixou **o SHA-256 do arquivo e todas as linhas de `storage.objects` idênticos**; o Storage recusou emitir a capacidade (`The resource already exists`).

## 5. Validade das URLs assinadas de upload

**Não existe valor universal.** Fatos verificados:

- O SDK (`@supabase/storage-js`, doc de `createSignedUploadUrl`) fala em 2 horas e **não aceita** `expiresIn` nessa chamada.
- No Storage self-hosted a validade vem de `UPLOAD_SIGNED_URL_EXPIRATION_TIME` (alias `SIGNED_UPLOAD_URL_EXPIRATION_TIME`), em segundos, com **padrão de 60** quando ausente. Conferido no código das imagens `storage-api:v1.80.2` e `v1.84.19` (`dist/config.js` e rota `getSignedUploadURL`). Sem a variável, o laboratório emitiu `exp-iat = 60 s`, como no relatório integrado.
- A premissa de 2 h está em `contributor_quota('upload_window_minutes')` = 150 min (migration `20261112180000`, **não alterada aqui**) e no runbook `docs/EDITOR-RELEASE-20261106.md` ("esperar T0+2h"). O valor de produção **não foi consultado** nem alterado.

**Como medir o ambiente real** (emite um único token de sonda; não cria objeto, não envia byte, não imprime token/URL/chave):

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... CONFIRM_TARGET_HOST=<host de SUPABASE_URL> \
  npx tsx backend/scripts/measure-upload-url-ttl.ts
```

A trava `CONFIRM_TARGET_HOST` impede medir o ambiente errado. A saída traz `ttlSeconds`, se a janela SQL de 150 min cobre esse TTL e a espera de dreno sugerida (`ttl + 30 s de tolerância + 600 s de margem`). Meça de novo depois de qualquer troca de versão/configuração do Storage: tokens já emitidos mantêm a validade com que foram emitidos.

Implicações medidas no laboratório (T2, TTL 60 s):

| Passo | Resultado |
|---|---|
| 1º PUT com o token | 200 |
| 2º PUT com o mesmo token, objeto existente | 400 (duplicado) |
| Exclusão do objeto e novo PUT com o **mesmo token**, dentro da validade | **200 (reenvio permitido)** |
| PUT depois de expirar | 400 |

Ou seja: excluir um objeto **não** invalida tokens já emitidos; ele pode reaparecer enquanto o token valer. Por isso qualquer limpeza futura precisa esperar a maior validade efetiva já emitida (§6), e `source.mp4` nunca entra como candidato.

Se a validade real for maior que 150 min, a janela SQL de "pendente" subestima uploads possíveis; se for menor (60 s), fica conservadora demais. Corrigir isso exige decisão e migration nova (não feita).

## 6. Política de limpeza e reconciliação — inventário e dry-run primeiro

Entregue: **somente leitura**.

```bash
DATABASE_URL=... CONFIRM_TARGET_HOST=<host do DATABASE_URL> \
  npx tsx backend/scripts/storage-inventory.ts --signed-url-ttl-seconds <TTL medido> [--stability-seconds 30] [--out relatorio.json]
```

- Lê `media_assets`, `grenades.video_id`, `import_sources` e `storage.objects` (bucket `videos-staging`) em transação `READ ONLY`, **duas vezes**, e só considera confirmado o que ficou idêntico (objeto e linha).
- O TTL medido é **obrigatório** (sem padrão): janela = TTL + tolerância + margem.
- Classes: `current_reference`, `source_retained`, `deterministic_output_unreferenced`, `attempt_output_unreferenced`, `no_media_row`, `unrecognized_name`. Vereditos: `keep`, `review`, `blocked`, `candidate_unconfirmed`, `candidate`.
- Bloqueios: mídia em `queued`/`processing`, lease ativo, `awaiting_upload`, fonte de importação válida, atividade dentro da janela de URL, mudança entre leituras, timestamp desconhecido. Referenciado, fonte, objeto sem linha e nome fora do padrão **nunca** são candidatos (vão para `keep`/`review`).
- Relatório com caminhos **exatos**, tamanhos e motivos, mais a contabilidade por mídia (físico x cobrado, mídias com diferença) e `dryRun:true`, `destructiveActions:0`. Não existe opção de exclusão; um teste estático falha se algum caminho de exclusão ou escrita aparecer.

Resultado real no laboratório (`inventory-cli.json`, TTL 60 s): 40 objetos / 4.599.365 B. Os 6 órfãos de 55.820 B (rodadas do PR #19) apareceram com o caminho exato e veredito `blocked/inside_signed_url_window`; na simulação com o relógio do relatório adiantado 3 h viraram `candidate` (334.920 B). O inventário também quantificou as 6 mídias com cobrança 0 deixadas pelo ensaio de rollback/reaplicação (934.660 B) e o objeto sintético `synthetic-replay/test.mp4` (`review`). As tabelas ficaram idênticas antes e depois (hash) e uma escrita dentro da transação foi recusada (`cannot execute UPDATE in a read-only transaction`).

### Como cada pré-condição de exclusão é tratada

| Pré-condição pedida | Hoje (inventário) | Antes de existir qualquer exclusão |
|---|---|---|
| Objeto não publicado nem referenciado | Conjunto global de `storage_key` + ids publicados; referenciado = `keep` | Reconferir a linha no momento da exclusão |
| Sem processamento ativo | Status, lease, `awaiting_upload`, importação válida e estabilidade em duas leituras | Um snapshot não exclui um processamento que começa depois dele: a exclusão precisa de verificação fenciada por linha no instante da operação |
| URLs assinadas válidas não permitem reenvio | Janela com o TTL **medido**; fontes nunca são candidatas | Parar emissores, esperar a maior validade já emitida + tolerância + margem; nunca reduzir a espera porque um serviço novo emite tokens mais curtos |
| Referências e objetos inventariados | Relatório por classe/mídia | Guardar o relatório como manifesto aprovado por pessoa |
| Logs e recuperação | Relatório é o registro; não há exclusão para logar | Backup dos objetos candidatos (com SHA-256) e do banco, log JSON por chave, idempotência, exclusão de caminho exato (nunca prefixo) e plano de restauração testado |

Conclusão: **não implementei exclusão automática**; as provas acima não estão completas. Para as saídas derivadas (`clip.mp4`, `clip-N.mp4`) a recuperação é regenerar a partir da fonte retida, mas isso só vale enquanto a fonte existir e a mídia não estiver `failed` definitivo.

Reservas de mídias `failed`/abandonadas continuam só liberadas manualmente, depois da remoção do objeto (`contributor_reclaim_candidates`, existente, que só enxerga a `storage_key` da linha; o inventário cobre as saídas derivadas).

## 7. Testes

Backend: **304/304** (baseline do SHA aprovado: 267/267), `tsc --noEmit` limpo.

- `tests/clip-retry-accounting.test.ts` (12, PostgreSQL real via PGlite com triggers/cobrança da migration + Storage falso com tamanhos): E03; codificação diferente (adota os bytes do objeto armazenado, nunca sobrescreve); resposta do Storage perdida; banco indisponível em `ready` e `failed`; falha antes da gravação; objeto publicado preservado em repetições; objeto corrompido, duração incompatível e grande demais (mídia `failed`, objeto preservado, reserva máxima retida); três leases perdidos seguidos (físico ≤ cobrado em cada passo, esgota sem novo objeto); chamadas simultâneas (`PROCESSOR_BUSY`, um corte). **Contra o `src/` anterior 9 falham e 3 passam** (os 3 são guardas que valem antes e depois); com a correção 12/12.
- `tests/storage-inventory.test.ts` (19) e `tests/signed-url-ttl.test.ts` (6). Dez mutações enfraquecendo cada regra de segurança do inventário (janela, fila, lease, importação válida, duas leituras, referenciado, fonte, objeto sem linha, aguardando upload) foram todas detectadas; uma mutação na medição do TTL também.
- `tests/inline.test.ts`: 2 expectativas atualizadas (chave `clip.mp4` e Storage falso que dizia "existe" para qualquer chave).
- Laboratório real (`docs/validation/pr19-orfaos/`): fluxo documentado completo sobre o código corrigido **29 PASS / 0 FAIL**; cenários F1–F3 contra o PR #19 (reproduz) e contra a correção; T1/T2/I1 só na correção. Nas duas rodadas anteriores (preservadas em `evidence/run1-script-defect` e `run2-f3-expectation`) houve falhas **do meu script** (cliente de serviço reaproveitado para login anônimo e uma expectativa errada sobre emissão de URL), corrigidas e repetidas.

Não cobertos: duas instâncias reais disputando a mesma mídia ao mesmo tempo (simulado com o objeto pré-existente), importações e worker, Storage/gateway gerenciados e produção.

## 8. Riscos residuais

1. Importações e worker mantêm chave por tentativa (§3).
2. A adoção confia em um objeto que só o backend escreve nessa chave; valida contêiner/codec/duração/tamanho, mas não o deslocamento inicial do corte nem a identidade bit a bit. O `clip` da mídia não é alterado por nenhum endpoint de usuário.
3. Mídias que terminam `failed` com `clip.mp4` ficam com fonte + trecho no Storage; isso está coberto pela reserva retida (≤ 100 MB), mas só é liberável por limpeza manual aprovada.
4. A validade efetiva em produção é desconhecida; a migration segue com a suposição de 150 min e o runbook de 2 h.
5. Cobrança zerada após reaplicar a migration 2 sobre mídias existentes exige backfill/reconciliação antes de reativar contribuições.
6. O inventário depende de `storage.objects` como índice; a igualdade com o disco foi comprovada apenas no laboratório. Não foi executado em produção.

## 9. Limitações para a ativação pública (continuam valendo)

Tudo o que o relatório integrado já listava (capacidade operacional e quotas reais, antiabuso/CAPTCHA, gateway/TLS gerenciados, provedores autorizados de importação, frontend em dispositivos, restauração de produção) **e**: medir a validade real das URLs e decidir a janela SQL; corrigir ou aceitar formalmente o mesmo risco nas importações; backfill da cobrança após reaplicação da migration 2; processo aprovado de limpeza com backup. As três flags continuam `false`; este PR não as altera.

## 10. Reprodução

Unitário: `cd backend && npm ci --ignore-scripts && npm run typecheck && npm test`.

Laboratório (worktree própria, Docker, sem `.env` real): extrair a harness documentada da branch `codex/validacao-integrada-pr19-20261112` para `docs/validation/pr19/` (não versionar), criar um `.dockerignore` local com `**/node_modules`, `.git`, `**/.env*`, `docs/validation/pr19/runtime*`, e escolher um sufixo livre:

```powershell
node docs/validation/pr19/prepare.mjs -r70          # no Windows, extraia legacy.tar com System32\tar.exe se o tar do Git Bash falhar
docker compose -f docs/validation/pr19/runtime-r70/compose.json build runner
docker compose -f docs/validation/pr19/runtime-r70/compose.json up -d
node docs/validation/pr19/isolation.mjs -r70
node docs/validation/pr19/launch.mjs -r70
node docs/validation/pr19-orfaos/orfaos-launch.mjs -r70
```

Parar apenas a stack própria ao terminar; nenhuma instrução de remoção acompanha esta entrega. Evidências: `docs/validation/pr19-orfaos/evidence/`.
