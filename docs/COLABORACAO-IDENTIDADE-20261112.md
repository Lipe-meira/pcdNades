# Publicação colaborativa — PR A: identidade, autoria e autorização (12/11/2026)

Branch `feat/colaboracao-identidade`, base `main` 8776ddf. Escopo deste PR: **backend e banco**. Nenhuma interface, nenhuma migration aplicada em produção, nenhum deploy. A área pública de contribuição só existe depois do PR B e só funciona com `CONTRIBUTORS_ENABLED=true` (desligado por padrão).

## 1. Auditoria da arquitetura atual (antes de qualquer alteração)

| Ponto | Situação encontrada | Risco ao abrir para contribuidores |
| --- | --- | --- |
| Autenticação | `admin()` em `application.ts`: valida o JWT com `auth.getUser(token)` e chama `rpc('is_admin')` (tabela `private.administrators`). | Todo usuário Supabase (inclusive anônimo) tem papel `authenticated`; o papel sozinho nunca pode autorizar. |
| Autorização de granadas | `INSERT`/`DELETE` via cliente do usuário sob RLS `is_admin()`. `UPDATE` revogado de `authenticated`; o `PATCH` usa **`service_role`** depois do `admin()`. | `service_role` ignora RLS: a checagem de dono precisa estar no código do servidor, em cada operação, e o banco precisa de invariantes que valem até para `service_role`. |
| Autoria | Não existe. `grenades` não tem dono; `media_assets.owner_id` guarda o uid de quem enviou/importou. | Sem coluna de autoria não há como separar "minha" de "dela". |
| `videoId` ao criar/editar | Só exige mídia `ready` (trigger). **Não verifica o dono do vídeo.** | IDOR/BOLA: contribuidor B poderia anexar o vídeo de A à sua granada. |
| `GET /media/:id`, `POST /media/:id/complete` | Qualquer admin lê/finaliza qualquer mídia `upload`. | Com contribuidores, B leria/finalizaria o upload de A. |
| Importação TikTok/Instagram | Trava dupla: `admin()` + `MEDIA_TIKTOK_ADMIN_USER_ID` (um único uid). Sessões, prévias e reprodução filtram por `owner_id`. | Superfície cara (processo externo, slot global, 50/h). Abrir sem opt-in aumentaria o abuso. |
| Reedição de corte (PR #16) | Orquestrada no cliente: consulta o link de novo, importa o corte novo e faz `PATCH` com o novo `videoId`. Não há endpoint próprio. | A segurança da reedição é: dono do vídeo no `PATCH` + gate de importação. |
| Limites | Só os de importação (20/h por admin, 50/h global) e tamanho/duração de mídia. | Sem cota por contribuidor, um anônimo pode encher o Storage (plano gratuito). |
| Dados existentes | 15 granadas, 21 mídias (produção, 11/11). Nenhuma com autor. | Migration precisa ser aditiva e retrocompatível com o backend atual. |
| Padrão de schema | Tabelas internas ficam em `public` com RLS ligada, `revoke all` de `anon/authenticated` e `grant` só a `service_role` (ex.: `import_sources`). | Seguir o mesmo padrão. |

## 2. Arquitetura escolhida

### Identidade e propriedade

- **Autenticação**: Supabase Auth anônimo. O JWT traz `is_anonymous: true`. O backend revalida o token em cada requisição (`auth.getUser`), como já faz hoje.
- **Propriedade desacoplada do login**: a autoria aponta para um **contribuidor** (`public.contributors.id`), não para `auth.users.id`. Um vínculo `public.contributor_links (auth_user_id → contributor_id)` liga a sessão anônima ao contribuidor.
  - Por quê: uma identidade anônima do Supabase **não pode ser recuperada** depois que o navegador perde a sessão (não há credencial). Se a autoria apontasse para `auth.users.id`, a recuperação teria de reescrever `author_id`/`owner_id` de granadas e vídeos em produção. Com o contribuidor como dono estável, recuperar é só **acrescentar um vínculo** (PR C); nenhuma granada nem vídeo muda de dono.
  - Hoje há exatamente um vínculo por contribuidor.
- **Apelido** (`contributors.nickname`) é só exibição: não entra em nenhuma decisão de autorização; dois contribuidores podem ter o mesmo apelido; renomear não toca em autoria. Validação: 2–24 caracteres, letras/números/espaço/`._-`, sem nomes reservados (admin, equipe, pcdnades…).
- **Administrador** continua em `private.administrators` / `is_admin()`. Admin não vira contribuidor e não vira autor ao editar.

### Colunas e tabelas (migration aditiva)

- `public.contributors(id, nickname, created_at, updated_at)` — RLS ligada, sem acesso para `anon`/`authenticated`.
- `public.contributor_links(auth_user_id pk → auth.users, contributor_id → contributors)` — idem.
- `public.grenades.author_id → contributors(id)`, **nulo** para registros históricos e para publicações de administrador. Imutável por trigger.
- `public.media_assets.contributor_id → contributors(id)`, preenchido **por trigger** a partir de `owner_id` (vale também para as RPCs de importação, que não são alteradas). Imutável por trigger.
- Triggers de invariantes (valem para qualquer papel, inclusive `service_role`):
  - `author_id` e `contributor_id` nunca mudam depois do `INSERT` (nem de/para `NULL`);
  - granada com autor só aceita vídeo do próprio autor na criação, e nunca vídeo de **outro** contribuidor depois;
  - cotas por contribuidor (§4), atômicas com `pg_advisory_xact_lock`.
- Política de `INSERT` em `grenades` passa a exigir `author_id is null`: quem escreve com a chave pública + JWT (admin) não consegue forjar autoria; granadas com autor só nascem pelo backend.
- Funções novas (`register_contributor`, `rename_contributor`) só executáveis por `service_role`.

### Fluxo de autorização no backend

`resolveActor(req)`: Bearer → `auth.getUser` (401) → `is_admin` (503 se falhar) →
1. admin → `{kind:'admin'}`;
2. senão, se `CONTRIBUTORS_ENABLED=true` **e** `user.is_anonymous===true` → procura o vínculo; sem vínculo → `{kind:'unregistered'}`;
3. senão → 403 `FORBIDDEN` (comportamento de hoje para quem não é admin).

O `author_id` e o `contributor_id` vêm **somente** do servidor. O corpo é `.strict()`: `authorId`/`author_id`/`ownerId` → 400.

## 3. Matriz de permissões implementada

| Operação | Sem sessão | Anônimo sem apelido | Contribuidor | Admin |
| --- | --- | --- | --- | --- |
| Ver mapas, granadas, vídeos | sim | sim | sim | sim |
| `POST /contributors` (criar apelido) | 401 | sim | idempotente | 403 |
| `GET/PATCH /me`, `GET /me/grenades` | 401 | 403 `CONTRIBUTOR_REQUIRED` | sim | `GET /me` sim |
| Publicar granada | 401 | 403 `CONTRIBUTOR_REQUIRED` | sim (vídeo próprio) | sim (autor nulo) |
| Editar granada | 401 | 403 | só as suas | qualquer |
| Trocar o vídeo (reedição) | 401 | 403 | só por vídeo próprio | qualquer |
| Excluir granada | 401 | 403 | **403 (nem as próprias)** | qualquer |
| Upload MP4 / finalizar | 401 | 403 | só o próprio | qualquer |
| Importar TikTok/Instagram | 401 | 403 | só com `CONTRIBUTOR_IMPORTS_ENABLED=true` | como hoje (uid de `MEDIA_TIKTOK_ADMIN_USER_ID`) |
| Ler `GET /media/:id` | 401 | 403 | só o próprio (404 nos alheios) | qualquer |

Códigos: não autenticado `401`, sem permissão `403`, granada inexistente `404`, conflito de revisão `409`, cota `429`.

## 4. Limites de abuso (por contribuidor, no banco)

- mídias criadas: 10 por hora e 30 por dia (janela móvel);
- granadas criadas: 30 por dia;
- teto global de mídias de contribuidores: 200 por dia.

Estourou: `P0001` com `CONTRIBUTOR_QUOTA_EXCEEDED` → API devolve `429`. Administradores (sem `contributor_id`) não são afetados. Os valores estão em `private.contributor_quota()`. Limites de BYTES, pendentes e abandonados (S1) estão no §10; não existe limpeza automática de uploads abandonados (de propósito, §10.3).

## 5. Estratégia para os dados existentes

- A migration só **adiciona** colunas/tabelas/triggers; nenhuma linha existente é alterada. Granadas históricas ficam com `author_id = NULL` ("equipe/histórico"): só administradores editam, nenhum contribuidor consegue reivindicá-las (o trigger proíbe `NULL → valor`).
- Atribuir um autor a registro antigo, se um dia for desejado, é operação manual revisada (SQL pontual com o trigger desabilitado numa transação), nunca pela API.
- Compatível com o backend atual: ele insere granadas sem `author_id` e mídias sem `contributor_id`; os triggers aceitam. **Ordem de publicação**: migration → backend novo → (PR B) frontend. O backend novo exige a migration.
- Rollback em `backend/rollbacks/`; ensaiado em teste (PGlite) e deve ser ensaiado sobre restauração do dump de produção antes de aplicar.

## 6. Dependências de configuração (fora do código)

1. Habilitar *Anonymous sign-ins* no Supabase Auth (painel) — **não feito**.
2. Ativar CAPTCHA (Turnstile/hCaptcha) para logins anônimos e conferir o limite por IP do Auth: sem isso, quem cria milhares de sessões anônimas multiplica as cotas. Esta é a principal limitação de abuso e não se resolve no backend.
3. Variáveis novas (todas opcionais, padrão desligado): `CONTRIBUTORS_ENABLED`, `CONTRIBUTOR_UPLOADS_ENABLED` (exige a primeira), `CONTRIBUTOR_IMPORTS_ENABLED` (exige a primeira).
4. Conferir no projeto real o bucket `videos-staging` (privado, `file_size_limit` ≤ 50.000.000, apenas `video/mp4`): a migration inicial só cria o bucket se ele não existir (`on conflict do nothing`), então um bucket antigo com configuração diferente derrota o orçamento de bytes (§10).

## 7. Riscos e limitações conhecidos

- Sessão anônima perdida = autoria inacessível até o PR C; admin continua podendo editar.
- Cotas por contribuidor não impedem muitos contribuidores falsos (ver §6.2).
- `author_id` (uuid opaco) é legível pela API pública do PostgREST (`select=*` anônimo) como todo o resto de `grenades`; não concede nenhuma autoridade e não é o uid de login.
- Importação por link para contribuidores (flag, desligada): o acoplamento de cotas com o administrador foi corrigido (§10.2); restam riscos operacionais descritos lá (slot único, prévias, falhas externas).
- Sem moderação de conteúdo além de o administrador poder editar/excluir; título e instruções de contribuidor são texto livre (a interface React escapa; qualquer outro consumidor precisa escapar também).
- A validação do JWT é remota a cada requisição (como hoje): mais latência, mas token revogado/usuário apagado falha imediatamente.
- Concorrência das cotas e dos orçamentos é garantida por lock consultivo; o PGlite dos testes tem uma única conexão. A corrida multiconexão foi exercitada **à parte**, em PostgreSQL 17.5 real descartável (`backend/scripts/contributor-concurrency-real-pg.mjs`, §10.5), mas NÃO no Supabase.
- Os testes de API usam PostgreSQL real (PGlite) com um adaptador mínimo no lugar do PostgREST; não há GoTrue, PostgREST nem Storage reais. Não equivalem a teste no ambiente Supabase.

## 8. Testes e verificações

Arquivos: `backend/tests/contributors-sql.test.ts` (19, banco), `backend/tests/contributors-api.test.ts` (17, API), `backend/tests/config.test.ts` (+1, flags), apoio em `backend/tests/support/` (`pg.ts`: PostgreSQL real em PGlite com papéis/JWT/privilégios no estilo Supabase; `supabase-pg.ts`: adaptador mínimo que executa as consultas do backend nesse banco com o papel e o JWT de cada cliente).

| # pedido | Cobertura |
| --- | --- |
| 1 A publica | API: "A publica" (autoria do servidor; corpo com `authorId`/`author_id`/`ownerId` → 400) |
| 2 A edita a sua | API: "A edita a própria granada" (+ conflito de revisão e corrida entre duas edições) |
| 3 B edita a de A → 403 | API: mesma suíte; a linha não muda |
| 4 B não assume a autoria | API (PATCH com `authorId` → 400) + banco (`author_id` imutável, inclusive para `service_role`; NULL→valor proibido) |
| 5 A exclui a própria → 403 | API ("ninguém exclui…"; também B e anônimo sem apelido) + banco (RLS: dono anônimo não apaga direto) |
| 6 Admin edita A e B | API: "admin edita…" (autor continua sendo A/B; publicação de admin sem autor) |
| 7 Admin exclui A e B | API: "ninguém exclui…" (204) |
| 8 sem sessão → 401 | API: "visitante sem sessão" (publicar, editar, excluir, upload, `/me`, token inválido) |
| 9 apelido não altera permissões | API: renomear (inclusive para o apelido de outro) mantém autoria e 403 |
| 10 vídeo de outra pessoa | API: criação e edição → 403 `VIDEO_NOT_OWNED`; banco: trigger recusa mesmo com bug da API |
| 11 reedição respeita dono | API: "reedição de corte…" (próprio ok; alheio/legado → 403; admin ok; admin não troca por vídeo de OUTRO contribuidor) |
| 12 falha de upload/importação | API: upload sem arquivo → `complete` 409; mídia não pronta → `VIDEO_NOT_READY`; publicação existente intacta (revisão e vídeo iguais) |
| 13 registros antigos | API + banco: legado legível, `author: null`, só admin edita; migration deixa linhas, policies, grants e RLS idênticos (exceto `grenades_insert`) |
| 14 recuperação | **Não aplicável neste PR** (recuperação é o PR C). Fica pendente. |

Extras: importação por link fechada por padrão e presa ao dono (fonte inspecionada por A não vira importação de B); cotas por hora/dia/granada/global (429); RLS isolada com triggers desligados para provar que a política sozinha nega; rollback testado; backend antigo continua inserindo após a migration; resposta pública sem ids de contribuidor/login.

Execução (12/11/2026, Windows/Node 24, esta worktree): `npm --prefix backend test` → 192/192 (155 anteriores + 37 novos); `npm --prefix backend run typecheck` OK; smokes legados `map-levels-migration-smoke.mjs` (18 checagens, corrigido para não exigir ser a última migration) e `he-migration-smoke.mjs` (10) PASS via PGlite.

Mutação manual (defesa removida → teste falha): checagem de dono no PATCH (3 testes), `ownMedia` aceitando mídia sem dono (1), ignorar `is_anonymous` (1), dono em `GET /media/:id` e `complete` (2). Todas revertidas.

Não executado: teste contra Supabase real (Auth anônimo, PostgREST, Storage), concorrência multi-conexão, ensaio da migration sobre restauração do dump de produção, frontend contra a API nova (compatibilidade por inspeção: `apiContracts.ts` não rejeita chaves extras).

## 9. PR C — recuperação opcional (desenho, não implementado)

- Código de 160 bits (CSPRNG, base32), mostrado uma única vez; no banco só `HMAC-SHA256(pepper, código)` em `contributor_recovery_codes(contributor_id, code_hash unique, created_at, used_at, revoked_at)`. Nada em log.
- `POST /recovery/redeem` com a sessão anônima **nova** + código: busca por hash, compara em tempo constante, e numa RPC única e transacional marca `used_at` (condicionado a `used_at is null and revoked_at is null`) e insere o vínculo `(nova sessão → contributor)`. Uso concorrente: só um vence.
- Limites: por IP, por uid anônimo e global de falhas, com bloqueio progressivo; resposta idêntica para código inexistente/usado/revogado.
- Após o resgate o código morre; emitir outro exige sessão já vinculada. Revogar vínculos antigos é opcional (decidir no PR C).
- Nenhuma granada/vídeo é reescrito, graças ao contribuidor como dono estável.

## 10. Correções da revisão independente do PR #19 (S1, S2, S3)

Relatório de origem: `docs/reviews/PR19-SECURITY-20261112.md` (worktree de revisão, só leitura). Migration nova, **também não aplicada**: `backend/migrations/20261112180000_contributor_storage_and_import_pools.sql` (+ rollback), a aplicar **depois** de `20261112120000`. Aditiva: a coluna nova tem default constante e nenhuma linha existente muda.

### 10.1 S1 — orçamento de bytes de Storage (ALTO)

Princípio: o limite que protege o Storage é **de bytes e global**, aplicado no banco (vale até para `service_role`), e não depende do número de identidades.

| Regra | Valor | Onde |
| --- | --- | --- |
| Reserva por mídia ao pedir upload | 50 MB (upload simples), 100 MB (upload com corte: fonte + trecho), 50 MB (importação: só o trecho é armazenado) | `private.media_charge`, coluna `media_assets.storage_charge_bytes` |
| Pendentes por contribuidor | 2 | trigger `private.media_contributor` |
| Pendentes globais | 10 | idem |
| Orçamento por contribuidor | 150 MB | idem |
| Orçamento global de contribuidores | 400 MB | idem |
| Janela de "pendente" para `awaiting_upload` | 150 min (URL assinada de upload vale 2 h + 30 min de margem) | `contributor_quota('upload_window_minutes')` |

- **Reserva atômica**: o trigger toma os advisory locks (global → contribuidor) e só então soma os bytes; a reserva é gravada na mesma linha da mídia. Não há janela entre "checar" e "reservar".
- **Reservado × efetivamente usado**: a linha nasce com a reserva máxima; ao virar `ready` a cobrança cai para o tamanho real (`metadata.bytes`, mais `metadata.sourceBytes` quando há corte — gravado agora por `completeInline`; sem ele assume-se 50 MB). A cobrança só pode **cair**, nunca é definida nem alterada pelo chamador (testado com `service_role`).
- **Fonte original + vídeo processado**: contabilizados juntos no upload com corte (a fonte continua no Storage). Resíduo conhecido: se uma tentativa de processamento morre depois de gravar o trecho e outra recomeça (`attempts` ≤ 3), podem sobrar até 2 trechos órfãos de ≤ 50 MB por mídia com corte; não são reservados individualmente.
- **Uploads abandonados/não finalizados**: o *slot* de pendente libera após a janela das URLs assinadas, mas a **reserva de bytes permanece** (o objeto pode existir; uma URL ainda válida pode reenviar). Falhas (`failed`) também mantêm a reserva inteira.
- **Várias identidades anônimas**: identidade nova ganha cota individual, mas **não amplia** o orçamento global (400 MB) nem o teto global de pendentes. O custo do abuso é bloqueio da própria contribuição (503 `CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED`), nunca consumo ilimitado nem prejuízo ao administrador (uploads do administrador não são contabilizados nem barrados).
- **URLs assinadas**: apagar a linha **não** revoga uma URL ainda válida. Por isso nada é apagado automaticamente (§10.3). Premissas sobre o Storage real (a validar): URL de upload vale ~2 h; o backend não usa `upsert`, então um objeto existente não é sobrescrito; o bucket recusa > 50 MB e MIME diferente de `video/mp4`.
- **Contrato HTTP**: `429 CONTRIBUTOR_PENDING_LIMIT`, `429 CONTRIBUTOR_STORAGE_EXCEEDED` (limite do próprio contribuidor) e `503 CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED` (capacidade global). Mesma tradução nas rotas comuns e nas RPCs de importação (`src/contributor-errors.ts`).
- **Flag própria**: `CONTRIBUTOR_UPLOADS_ENABLED` (padrão `false`, exige `CONTRIBUTORS_ENABLED`). Sem ela contribuidores recebem 403 `CONTRIBUTOR_UPLOADS_DISABLED` em `POST /media/uploads` e não finalizam mídia de upload; o administrador não é afetado. **Decisão**: embora o orçamento esteja implementado e testado, a flag fica desligada porque a proteção do Storage real (limites do bucket, expiração e reuso de URLs, ocupação efetiva) não foi validada num Supabase descartável nesta etapa.
- **Operação (somente leitura)**: `public.contributor_storage_report()` (orçamento, cobrado, pendentes, bytes de não finalizados) e `public.contributor_reclaim_candidates(p_grace_minutes)` (mídias `awaiting_upload`/`failed` de contribuidor, antigas, sem granada nem importação ativa; a carência nunca é menor que a janela das URLs). Ambas só `service_role`. **Nada apaga linha ou objeto.** Procedimento manual: remover o objeto do Storage e só então apagar a linha (a cobrança some com ela).

### 10.2 S2 — importações de contribuidores × administrador (MÉDIO)

- **Reservas de inspeção** (`reserve_import_source`): mantidos o limite individual de 20/h e o total de 50/h para todos. Contribuidores ganham teto próprio: **6/h cada** e **20/h somados**. Como 20 < 50, sempre sobram ≥ 30 reservas/h para o administrador; o teto individual dele (20/h) segue valendo. "Contribuidor" = dono com vínculo em `contributor_links` (o cadastro é negado a administradores na API).
- **Slot único do processador** (inspeção, prévia e importação): `claim_import_slot(holder, seconds, owner)` aplica orçamento de **tempo** a contribuidores: **400 s/h** cada e **1200 s/h** somados (no máximo 1/3 do processador); estourou → `429 IMPORT_RATE_LIMIT` (também na prévia e na conclusão da importação). Cobra o pior caso ao assumir e devolve o tempo não usado ao liberar (`release_import_slot`). O administrador não tem esse limite. A assinatura antiga de dois argumentos continua existindo (compatibilidade), mas o backend só usa a nova.
- **Falhas do importador**: a reserva é feita antes da extração e continua contando se ela falhar (a extração é o recurso caro); isso vale só para contribuidores e não toca a reserva do administrador.
- **Resíduos**: (a) o slot é um só: se um contribuidor estiver executando, o administrador pode receber `503 PROCESSOR_BUSY` por até 30–120 s (transitório, não é cota); (b) o limite de trim em processo (`activeTrim`) e o de importação em processo (`active`) continuam únicos por instância; (c) prévias gravam em `import-previews` (bucket próprio, varredura de expiração já existente) e não entram no orçamento de bytes de contribuidores. `CONTRIBUTOR_IMPORTS_ENABLED` segue `false` por padrão.

### 10.3 O que NÃO foi feito, de propósito

Expurgo automático de uploads abandonados. Condições que precisam ser **comprovadas num Supabase descartável** antes de qualquer remoção automática: (1) validade real e não reuso da URL assinada de upload; (2) a remoção do objeto não ressuscita permissão (a URL expirada não reenvia); (3) objetos `ready` não são sobrescritos por permissões antigas; (4) o objeto removido é exatamente o da linha (nada de prefixo). Proposta: PR complementar com *reaper* idempotente, só sobre `contributor_reclaim_candidates`, com dry-run e auditoria.

### 10.4 S3 — erro de cota na importação (BAIXO)

`importDbResult` agora usa a mesma tradução que `checked()`: `CONTRIBUTOR_QUOTA_EXCEEDED` → 429 (antes 503 `SERVICE_UNAVAILABLE`), mais os códigos novos de §10.1. Testado para TikTok e Instagram com cota horária, diária, pendentes, bytes por contribuidor e orçamento global; a seleção é revertida (nenhuma mídia criada, `import_sources.media_id` continua nulo) e a mesma fonte funciona depois que a janela passa. Erros antigos (404/400/410/409/429 do importador) continuam iguais.

### 10.5 Evidências

- `npm --prefix backend test`: **248/248** (192 do PR A + 56 novos); typecheck OK; arquivos novos `contributor-storage-sql.test.ts`, `import-pools-sql.test.ts`, `contributor-hardening-api.test.ts` (PostgreSQL real via PGlite). Reproduz o achado S1 (21 autorizações/1,05 GB → no máximo 6/300 MB), o S2 (admin com 429 → continua com as suas 20/h) e o S3.
- Mutação manual: remover cada defesa (tradução S3, limite de pendentes, orçamento global, orçamento individual, pool/teto individual de reservas, orçamento de tempo individual e somado do slot, flag de uploads, reserva de corte) faz testes falharem. Equivalente: remover o `least()` na conciliação não muda resultado (limites de entrada já impõem o teto).
- **Concorrência multiconexão** (não é Supabase): `backend/scripts/contributor-concurrency-real-pg.mjs` sobe PostgreSQL 17.5 descartável (embedded-postgres, sem Docker) e dispara transações simultâneas com o lock seguro por 30 ms: 16 inserts do mesmo contribuidor → exatamente 2 pendentes; 20 identidades → exatamente 8 reservas (400 MB); cota horária 9→10; reservas simultâneas com administrador chegando às suas 20; 13 pedidos do slot → 1 dono; carga mista sem deadlock. Sem os advisory locks as verificações A, B, C e F falham (soma chegou a 1000 MB), o que prova que o teste enxerga a corrida. Não roda no CI.
- Smokes legados de andares (18) e HE (10) continuam PASS.

### 10.6 Riscos residuais

- Sem validação no Storage real a premissa "1 URL = 1 objeto ≤ 50 MB em 2 h" é uma premissa; por isso a flag de uploads fica desligada.
- Reservas de bytes de falhas/abandonos só se liberam por limpeza manual: um enxame de identidades pode esgotar os 400 MB e travar **contribuições** (nunca o administrador) até o operador limpar. É o preço de nunca apagar sem prova.
- Os valores (50/100 MB, 150/400 MB, 2/10 pendentes, 6/20 reservas, 400/1200 s) são constantes na migration, escolhidas sem conhecer a capacidade livre do projeto: **conferir antes de abrir**; mudar exige migration.
- CAPTCHA/limites de criação de sessões anônimas e crescimento de `auth.users`/`contributors` continuam dependendo da configuração do Supabase.
- Trechos órfãos de tentativas repetidas (§10.1) e prévias (§10.2) ficam fora do orçamento.

### 10.7 Validações que dependem de Supabase real descartável (não executadas)

GoTrue (anônimo + CAPTCHA, `getUser`, expiração); PostgREST com chaves anon/authenticated/service_role (grants, owners, default privileges, RLS, rollback das RPCs, resolução do overload de `claim_import_slot` com 2 e 3 argumentos); Storage (expiração/reuso de URL, `upsert`, limite e MIME do bucket, sobrescrita de mídia pronta, ocupação real); ensaio migration→backend→rollback sobre restauração do dump; TikTok/Instagram reais; navegador contra a API nova.

### 10.8 Divergência preexistente: duração máxima (20 s × 90 s) — NÃO alterada

Valor efetivo do código: `MEDIA_MAX_DURATION_SECONDS` tem padrão e teto **90** (`backend/src/config.ts`, `.env.example`); a máquina de estados de mídia aceita `ready` com até 90 s (migration 003, que substituiu o limite de 20 s da 001); o corte importado é limitado a `min(30, MEDIA_MAX_DURATION_SECONDS)`. O limite de 20 s do produto (AGENTS.md) só vale se o ambiente definir `MEDIA_MAX_DURATION_SECONDS=20`, o que não foi verificado em produção. Correção separada necessária: conferir a variável no deploy e, se 20 s for regra firme, alinhar padrão, constraint do banco e frontend num PR próprio.

### 10.9 Avaliação (duas decisões separadas)

- **Merge com tudo desligado** (`CONTRIBUTORS_ENABLED`, `CONTRIBUTOR_UPLOADS_ENABLED`, `CONTRIBUTOR_IMPORTS_ENABLED` = false): sem bloqueador conhecido; ressalva: o backend novo exige as duas migrations (aplicar antes, com backup e autorização) e ainda falta o ensaio sobre a restauração do dump.
- **Ativação pública**: **ainda não**. Faltam Supabase real (Auth anônimo + CAPTCHA, Storage, PostgREST), conferir bucket e capacidade, decidir os valores dos limites, e ligar por etapas (contribuição sem upload/importação → upload → importação).

## 11. Correções finais R1/R2/R3 (segunda revisão independente, SHA revisado cd627de)

Origem: `docs/reviews/PR19-SECURITY-20261112.md` (branch `codex/revisao-pr19-20261112`). A revisão histórica do SHA 3e3858c (S1/S2/S3) é outra; aqui só R1, R2 e R3. As migrations continuam **não aplicadas em nenhum Supabase**, por isso a migration `20261112180000` foi editada no lugar (sem terceira migration); quem tiver aplicado a versão anterior em banco descartável deve reaplicar.

### 11.1 R1 (ALTO) — worker-transcode subcontabilizava fonte + saída
Estratégia B (menor solução comprovadamente segura), em três camadas, sem desligar o processamento de vídeos:
- **API** (`application.ts`): contribuidor não cria nem finaliza upload quando `MEDIA_PROCESSOR_MODE=worker-transcode` (403 `CONTRIBUTOR_UPLOADS_UNSUPPORTED`, nada é reservado); `capabilities.contributors.uploads=false`. Administrador e `inline-original` inalterados.
- **Worker** (`worker-queue.ts`, usado por `worker.ts`): a fila nunca assume mídia de contribuidor; o que ele deixou em `queued` vira `failed` (`PROCESSOR_UNSUPPORTED`, reserva de bytes mantida, nada apagado).
- **Banco** (trigger `media_contributor`): upload de contribuidor **sem corte** só fica `ready` mantendo a `storage_key` da fonte; trocar a chave (playback-N.mp4) levanta `CONTRIBUTOR_STORAGE_UNACCOUNTED`. Com corte, a chave nova do trecho é legítima e continua cobrando fonte + trecho. Evita o estado "fonte 50 MB + saída 7 MB cobrados como 7 MB" mesmo por outro caminho. Limite: se o worker já tiver enviado `playback-N.mp4` antes da recusa, esse objeto fica órfão (≤50 MB, fora do orçamento) — por isso a camada do worker impede o caso antes do upload.
Estratégia A (cobrar fonte + saída) foi descartada: exigiria reservar 100 MB em todo upload (dobrar o custo do orçamento) e reconciliar dois tamanhos no worker.

### 11.2 R2 (MÉDIO) — complete tardio reativava pendentes antigos
O mesmo trigger, no UPDATE, trata qualquer **entrada** em `queued/processing` vinda de outro estado (na prática `awaiting_upload → queued`): toma os mesmos locks do INSERT (global → contribuidor), conta os **outros** pendentes (`id <> new.id`, mesma definição de pendente do INSERT) e rejeita com `CONTRIBUTOR_PENDING_LIMIT` (429) ou `CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED` (503). Escolhi **admissão**, não expiração terminal: a idade do registro não prova que o objeto não pode mais ser enviado (URL assinada válida) nem que não foi enviado; a linha rejeitada continua `awaiting_upload`, com reserva de bytes intacta, **nada é apagado**, e o complete pode ser repetido quando abrir vaga. `inline.ts` agora traduz esses erros (antes virariam 503 genérico). Administrador (sem `contributor_id`) não é afetado.

### 11.3 R3 (MÉDIO) — ordem de rollback
Decisão: **runbook + teste de compatibilidade**, sem proteção adicional no código. Um fallback para a assinatura antiga deixaria o backend novo rodando as importações do administrador SEM os limites da S2, mascarando a incompatibilidade; o erro 503 explícito é preferível. O cabeçalho do rollback agora lista a ordem:
1. desligar as três flags (`CONTRIBUTORS_ENABLED`, `CONTRIBUTOR_UPLOADS_ENABLED`, `CONTRIBUTOR_IMPORTS_ENABLED`);
2. publicar backend **compatível com o schema de destino** (anterior ao PR #19, ou que use só `claim_import_slot(uuid,integer)`) e **confirmar** health + inspeção administrativa;
3. só então executar `20261112180000_..._rollback.sql` (com backup);
4. para o rollback completo, depois `20261112120000_contributors_authorship_rollback.sql` (também exige backend anterior).
Flags desligadas não bastam: o backend novo chama `claim_import_slot(uuid,integer,uuid)` em todos os fluxos administrativos. Dados preservados (mídias, granadas, vínculos, fontes; só `storage_charge_bytes`, `import_slot_usage` e funções novas somem). Nenhum rollback real foi executado.

### 11.4 Evidências e limites
- `backend/tests/contributor-final-fixes.test.ts` (19 testes, PGlite): R1 (reprodução do achado, sem corte, com corte com/sem `sourceBytes`, falha mantém reserva, administrador, API em worker-transcode e inline, fila do worker), R2 (cenário exato do Codex: 2 antigas + 1 nova + complete nas 3 → no máximo 2; recuperação posterior; dentro da janela; isolamento entre contribuidores; administrador; API 429), R3 (backend anterior × schemas: só migration 1 / as duas / após rollback2 / após rollback1; backend atual falha sem a assinatura nova; dados preservados; permissões).
- `npm --prefix backend test`: **267/267** (248 + 19); typecheck OK; smokes HE (10) e andares (18) PASS.
- Concorrência multiconexão em **PostgreSQL 17.5 descartável** (embedded-postgres, fora do repositório, não é Supabase): `scripts/contributor-concurrency-real-pg.mjs` com o novo cenário H (6 completes tardios + inserts simultâneos de 2 contribuidores, 25 rodadas): nunca mais de 2 pendentes cada, nenhuma linha apagada, bytes intactos, 0 deadlocks; **sensibilidade**: removendo os advisory locks do bloco R2, H falha em 25/25 rodadas.
- **Não validado**: Supabase real (Auth/PostgREST/Storage), FFmpeg/upload físico em worker-transcode, expiração real de URL assinada. PGlite é conexão única; adaptador de teste ≠ PostgREST.
- Riscos residuais: objeto `playback-N.mp4` órfão se o worker for modificado para ignorar a fila segura; reservas de falhas/abandonos seguem liberadas só por limpeza manual (§10.6); ocupação física real só se confirma no Storage.
