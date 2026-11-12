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

Estourou: `P0001` com `CONTRIBUTOR_QUOTA_EXCEEDED` → API devolve `429`. Administradores (sem `contributor_id`) não são afetados. Os valores estão em `private.contributor_quota()`. Não existe limpeza automática de uploads abandonados; o teto diário limita o dano, mas o plano gratuito (1 GB de Storage) continua sensível: monitorar e, se necessário, adicionar expurgo em PR próprio.

## 5. Estratégia para os dados existentes

- A migration só **adiciona** colunas/tabelas/triggers; nenhuma linha existente é alterada. Granadas históricas ficam com `author_id = NULL` ("equipe/histórico"): só administradores editam, nenhum contribuidor consegue reivindicá-las (o trigger proíbe `NULL → valor`).
- Atribuir um autor a registro antigo, se um dia for desejado, é operação manual revisada (SQL pontual com o trigger desabilitado numa transação), nunca pela API.
- Compatível com o backend atual: ele insere granadas sem `author_id` e mídias sem `contributor_id`; os triggers aceitam. **Ordem de publicação**: migration → backend novo → (PR B) frontend. O backend novo exige a migration.
- Rollback em `backend/rollbacks/`; ensaiado em teste (PGlite) e deve ser ensaiado sobre restauração do dump de produção antes de aplicar.

## 6. Dependências de configuração (fora do código)

1. Habilitar *Anonymous sign-ins* no Supabase Auth (painel) — **não feito**.
2. Ativar CAPTCHA (Turnstile/hCaptcha) para logins anônimos e conferir o limite por IP do Auth: sem isso, quem cria milhares de sessões anônimas multiplica as cotas. Esta é a principal limitação de abuso e não se resolve no backend.
3. Variáveis novas (todas opcionais, padrão desligado): `CONTRIBUTORS_ENABLED`, `CONTRIBUTOR_IMPORTS_ENABLED`.

## 7. Riscos e limitações conhecidos

- Sessão anônima perdida = autoria inacessível até o PR C; admin continua podendo editar.
- Cotas por contribuidor não impedem muitos contribuidores falsos (ver §6.2).
- `author_id` (uuid opaco) é legível pela API pública do PostgREST (`select=*` anônimo) como todo o resto de `grenades`; não concede nenhuma autoridade e não é o uid de login.
- A validação do JWT é remota a cada requisição (como hoje): mais latência, mas token revogado/usuário apagado falha imediatamente.
- Concorrência das cotas é garantida por lock consultivo em PostgreSQL real; o PGlite dos testes tem uma única conexão, então a corrida multi-conexão **não** foi exercitada.
- Os testes de API usam PostgreSQL real (PGlite) com um adaptador mínimo no lugar do PostgREST; não há GoTrue, PostgREST nem Storage reais. Não equivalem a teste no ambiente Supabase.

## 8. PR C — recuperação opcional (desenho, não implementado)

- Código de 160 bits (CSPRNG, base32), mostrado uma única vez; no banco só `HMAC-SHA256(pepper, código)` em `contributor_recovery_codes(contributor_id, code_hash unique, created_at, used_at, revoked_at)`. Nada em log.
- `POST /recovery/redeem` com a sessão anônima **nova** + código: busca por hash, compara em tempo constante, e numa RPC única e transacional marca `used_at` (condicionado a `used_at is null and revoked_at is null`) e insere o vínculo `(nova sessão → contributor)`. Uso concorrente: só um vence.
- Limites: por IP, por uid anônimo e global de falhas, com bloqueio progressivo; resposta idêntica para código inexistente/usado/revogado.
- Após o resgate o código morre; emitir outro exige sessão já vinculada. Revogar vínculos antigos é opcional (decidir no PR C).
- Nenhuma granada/vídeo é reescrito, graças ao contribuidor como dono estável.
