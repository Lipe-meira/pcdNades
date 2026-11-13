# Runbook — backup atualizado e restauração verificada (pré-migrations do PR #19)

13/11/2026, America/Sao_Paulo. **Revisão 3.** Preflight documental: nenhum dado real exportado, nenhuma consulta ao Supabase de produção, nenhum `login`/`link`, nenhum conteúdo de `backup.env` lido ou usado. Sem segredos neste documento.

**Decisão: NO-GO para executar.** Este documento não autoriza os passos 0–9.

## 0. O que este backup é — e o que não é

É uma **cópia lógica do PostgreSQL (5 schemas) e dos bytes dos objetos do Storage**, verificável por hash e restaurável em PostgreSQL local. **Não é recuperação integral da plataforma Supabase.** Não inclui (e portanto não se recupera só com ele): Vault (valores e chave raiz), secrets/variáveis de Edge Functions e das Vercel, **código e configuração das Edge Functions**, configuração de Auth (provedores, anonymous sign-in, CAPTCHA, URLs, JWT secret), definição do bucket além do que está em `storage.buckets`, extensões/roles gerenciados, `pg_cron`/`pg_net` (apenas `cron.job` exportado como metadado, ver 3.3), PITR/backups do provedor. A recuperação operacional completa exige, além disto, o re-cadastro manual desses itens.

## 1. Estado dos dados

| Item | Valor | Confiança |
| --- | --- | --- |
| Baseline remoto mais recente | 19 granadas, 25 mídias, 21 objetos, 104.741.093 bytes, 13 migrations (última `20261111031252`) | Fotografia de 13/11 10:20–10:28 SP. **Não reconfirmada** nesta tarefa. |
| Último backup | `release-20261111-nuke-premigration` (15/21/17, 12 migrations) | Metadados lidos. **Não cobre o estado atual.** |
| Refs Git (conferidas agora via `ls-remote`) | main `e0ad980…`; PR #19 `53686d2…`; branch documental `8b9d1ca…` (remoto) | Confirmado hoje |

## 2. Acesso ao Supabase (reavaliado)

Verificado: **não há** login da CLI neste host (sem `~/.supabase/access-token`, sem credencial `supabase` no cofre do Windows), a CLI **não está instalada** (`npx supabase` pediria baixar 3.1.0; `cli-latest` local = v3.1.0) e as pastas `.temp/linked-project.json` dos backups antigos são só registros. Nenhum `login`/`link` foi executado e nenhum vínculo de outras worktrees foi tocado. **Conferência da CLI v3.1.0** (única versão avaliada; a escolha final é sua): `--help` executado em pasta temporária isolada, com `SUPABASE_HOME` próprio e telemetria desligada, sem `login`, `link` nem conexão; nada foi instalado globalmente e a pasta temporária é removida ao fim desta revisão. Resultados do help, conferidos contra a documentação oficial (que confirma literalmente `db dump`, o `--remote` e a obsolescência de `--linked`/`--project-ref`/`--db-url`, removidos na v4; a página de `storage cp` não foi alcançável nos fetches, vale só o help):

- `--remote` é por comando, não global. `db dump`: "Local by default. Pass `--remote` for the linked project, or `--remote=<ref|branch|url>`"; `storage cp`: `--remote[=<ref|branch>]` (sem URL). Com `--remote=<ref>` o projeto é **escolhido explicitamente, sem `link`**; `--remote` sem valor exige projeto vinculado. Sem `--remote`, **o alvo é o banco/Storage local**: um comando sem a flag não toca produção, e esquecer o valor não escolhe projeto por engano. A documentação diz que `db dump` imprime uma linha `Target:` no stderr e não pede confirmação: **conferir essa linha antes de aceitar o resultado**.
- `--workdir <pasta>` é usado exatamente como dado, sem busca em diretórios-pai: usar uma pasta nova e vazia para nunca herdar o `supabase/` de outra worktree.
- **`storage cp` na v3.1.0 não lista `--experimental`** (os backups antigos usavam `--experimental`; a flag global ainda existe). Sintaxe: `supabase storage cp -r --remote=<ref> ss:///<bucket>/ <pasta-local>`; `-j` paraleliza (padrão 1; manter 1 para determinismo).
- Permissões de token com escopo (help): **`db dump --remote` sem `--password`** pode exigir `database_write` (a CLI cria a role temporária de login), mais `database_pooling_config_read` e `projects_read`; **`storage cp --remote`** pode exigir `api_gateway_keys_read` + `api_gateway_keys_secret_read` (lê a chave secreta pela Management API); `link` exige `project_admin_read`. `login` aceita só token **de usuário** (tokens de projeto/organização são rejeitados). Isso confirma que o caminho "sem senha" **é uma operação de escrita remota** e que ler Storage por essa via **lê uma chave secreta**, ambas com autorização própria.
- `db dump --remote=<url>` aceitaria uma URL de banco, mas colocaria a senha na linha de comando; **não usar**. `--password` também expõe na linha de comando: preferir o mecanismo da seção 5.
- Não confirmado em lugar nenhum: se `-s` anula a exclusão dos schemas gerenciados (por isso o `pg_dump` explícito) e o nome da role temporária (`cli_login_postgres` aparece só nos checkpoints antigos, não na documentação consultada).

Os três tipos de acesso são diferentes:

| Acesso | O que dá | Usado para | Observação |
| --- | --- | --- | --- |
| **Token de gerenciamento** (personal access token, `supabase login`) | Management API da conta: lista projetos, obtém chaves de API, cria role temporária de login | Intermediário; é o que permite à CLI pegar tudo o mais | Alto poder sobre a conta/organização inteira. Preferir `SUPABASE_ACCESS_TOKEN` só no processo, ou token com nome/validade curta; revogar depois (revogação do *meu* token, não da produção). |
| **Credencial PostgreSQL** (senha do banco, ou role temporária `cli_login_postgres` criada pela CLI) | Conexão ao pooler/banco; permite `pg_dump` | **Exportar o banco inteiro** (incluindo `auth`, `storage`, `private`, `supabase_migrations`) | **Não** redefinir a senha do banco: derrubaria o backend em produção. Criar role temporária pela CLI **é uma escrita remota** pequena (cria/remove role) e exige autorização própria. Se for usar a senha existente, ela é do responsável, entra só em variável de ambiente do processo. |
| **service-role key** | Bypass de RLS na API (PostgREST/Storage) | **Ler objetos de buckets privados** (`videos-staging` é privado) | Poder total sobre dados via API, inclusive escrita/exclusão. Usar somente o necessário (listar e baixar), nunca gravar nem apagar; a CLI obtém a chave com o token de gerenciamento, o que evita ler `backup.env`. |

Conclusões: (a) `pg_dump` completo precisa de **credencial PostgreSQL**, não de service-role; (b) copiar objetos privados precisa de **service-role** (diretamente ou via CLI com token de gerenciamento); (c) o token de gerenciamento sozinho não exporta nada, só viabiliza (a) e (b) pela CLI. `backup.env` (URL + service-role key) **não** serve para o dump de PostgreSQL e não será usado.

**Passos manuais do responsável (somente depois de aprovar a execução):** instalar/escolher a CLI e conferir `supabase --version`; autenticar com `SUPABASE_ACCESS_TOKEN` na sessão do terminal (ou `! supabase login`, sua decisão); informar o project ref; decidir entre senha existente ou role temporária. **Seleção do projeto:** sempre `--remote=<ref>` explícito e `--workdir` numa pasta nova e vazia, **sem `link`**; nunca o diretório ou o vínculo de outra worktree.

## 3. Procedimento de backup corrigido

Pasta nova, inexistente hoje: `F:\BackupsPrivados\pcdnades\release-20261113-pre-collab-migrations\`.

### 3.1 PostgreSQL — o dump é o `pg_dump` explícito, **não** o `supabase db dump`

A documentação diz que `supabase db dump` roda `pg_dump` **excluindo os schemas gerenciados (auth, storage, extensões), sem dados nem roles por padrão**, e não deixa claro se `--schema` anula essa exclusão. Por isso: **não usar `db dump` como método primário.** Usar `pg_dump` 17 em contêiner `postgres:17` com schemas explícitos, como nos backups anteriores:

```text
pg_dump "$URL" -Fc -n public -n private -n auth -n storage -n supabase_migrations -f full-custom.dump
```

(Sem `--no-owner`/`--no-acl`, sem `-x`: o padrão do `pg_dump` inclui dados, `GRANT/REVOKE`, policies e RLS.) Evidência de que esse comando já produz tudo isso, lida **no backup de 11/11** (`db/full-custom.list.txt`, 47 `TABLE DATA`): dados de `auth` (27), `private` (3), `storage` (10) e `supabase_migrations`; 129 entradas de ACL/POLICY/ROW SECURITY (ex.: ACL em 27 tabelas `auth`, 9 `storage`, 14 funções `public`, 6 `private`; 4 policies de `grenades`). Esse resultado vale como prova **do método**, não do backup novo: a mesma verificação é obrigatória no dump novo.

**Verificação obrigatória do dump novo** (critério de aceite, `pg_restore --list`, sem executar nada): (i) cada um dos cinco schemas tem `TABLE DATA`; (ii) `supabase_migrations.schema_migrations` com dados e 13 versões; (iii) presença de entradas `ACL`, `POLICY` e `ROW SECURITY` de `public`, `storage` e `auth`; (iv) contagem de linhas restauradas = contagem do inventário. **Modo de conexão do `pg_dump`** (documentação oficial de conexão, verbatim em essência):

| Modo | Endereço | Para `pg_dump`? |
| --- | --- | --- |
| **Direto** | `db.<ref>.supabase.co:5432`, usuário `postgres`; IPv6 (IPv4 só com o add-on pago) | **Recomendado pela documentação** para backup/restore (sessão única, comandos nativos). O Docker Desktop costuma não ter IPv6: testar antes; **não contratar o add-on**. |
| **Session pooler** | `aws-N-<região>.pooler.supabase.com:5432`, usuário `postgres.<ref>`; IPv4 | **Alternativa suportada** quando só há IPv4; foi o usado nos backups anteriores (`aws-1-sa-east-1`). Mantém a sessão, aceita `pg_dump`. |
| **Transaction pooler** | porta `6543`; sem *prepared statements* nem estado de sessão | **Não usar.** Pode quebrar o `pg_dump` ou, pior, funcionar sem a consistência da transação snapshot. |

A conferência de `SELECT current_setting('transaction_isolation')` não substitui isso: o `pg_dump` deve rodar numa única sessão estável (direto ou session). A role temporária da CLI, se for o caminho, só é comprovada pelo uso anterior no pooler; o usuário/host exatos saem do `--dry-run` quando autorizado.

Complementos legíveis para auditoria: `schema-public-private.sql` (`--schema-only`) e `roles.sql` (`supabase db dump --role-only`, ou `pg_dumpall --roles-only` se a CLI não puder). Se algum critério falhar, o backup **não é aceito**. O dump de 10/11 sem `private` e o de 09/11 mostram que a omissão silenciosa já aconteceu; a checagem existe por isso.

Limitações: `storage.objects` guarda só metadados; extensões gerenciadas não são recriadas; dados da role/senhas de roles gerenciados não são recuperáveis.

### 3.2 Storage — bytes copiados e comparados

1. **Lista de referência** (leitura): `storage.objects` com `bucket_id,name,id,updated_at,metadata->>'size',metadata->>'eTag'`, para todos os buckets, no PRE e no POST.
2. **Cópia:** `supabase storage cp -r --remote=<ref> --workdir <pasta vazia> ss:///videos-staging/ <destino>` (e `import-previews`, hoje vazio), conforme o help da v3.1.0 (sem `--experimental`). Somente leitura; a CLI lê a chave secreta pela Management API (escopos da seção 2). A origem é sempre `ss:///`, o destino local: **conferir a direção antes de executar** (a mesma sintaxe com origem e destino invertidos gravaria no Storage).
3. **Comparação com o inventário:** para cada objeto: existe arquivo local; tamanho = `metadata.size`; MD5 = ETag (válido para uploads simples, como nos backups anteriores; para multipart o ETag não é MD5 e se registra a exceção); SHA256 calculado → `videos-sha256.csv`. Contagem de arquivos locais = linhas de `storage.objects` = 21 (ou o total do PRE). Arquivo extra ou faltante = falha.
4. **Prova de bytes independente do ETag:** o SHA256 novo dos objetos que já existiam em `release-20261111` deve ser igual ao SHA256 registrado lá (17 objetos), o que detecta corrupção silenciosa de cópia.

### 3.3 Fora do dump — exportação complementar sem segredos

`cron.job` (nome, agenda, ativo, hash do comando; nunca texto com tokens) e `cron.job_run_details` da janela; **nomes** de secrets do Vault (nunca valores); lista de Edge Functions (nome, versão, `verify_jwt`) e **nomes** de secrets de funções; configuração de Auth e Storage por captura de tela do painel (sem chaves) ou resposta da Management API filtrada, com a lista de campos antes de salvar; `supabase functions download` e import maps ficam como pendência explícita (o download não traz import maps nem `deno.json`). Valores de Vault/secrets e a chave raiz **não** entram: ficam sob guarda do responsável.

## 4. Barreira de escrita (reavaliada)

**Premissa corrigida:** silêncio operacional e PRE/POST **não garantem** ausência de escrita concorrente. Há outros clientes autenticados e anônimos, o próprio backend em produção (workers, varredura), **Cron**, **Edge Functions**, URLs assinadas ainda válidas e processos externos que ainda não conhecemos. PRE == POST é uma **detecção** com buracos conhecidos: escritas que se desfazem entre as leituras, tabelas não listadas, mudanças fora do banco/Storage, e a janela entre o fim do POST e o uso do backup.

**TTL das URLs assinadas — o que o código mostra:** upload administrativo usa `createSignedUploadUrl` **sem TTL próprio** (vale o padrão do Storage, que a documentação do Supabase indica como 2 h; **não confirmado em produção**); links de leitura de reprodução usam 3.600 s; downloads internos 120 s. Uma URL de upload emitida pouco antes da janela pode gravar um objeto durante a cópia. **Espera de 2 h é só estimativa**, não barreira.

### Camadas

**Nível A — só leitura, sem alteração (pode entrar na autorização do backup):**
- PRE/POST de contagens, hashes de linha, `storage.objects` (id, tamanho, ETag, `updated_at`), migrations.
- Contadores `pg_stat_user_tables` (`n_tup_ins/upd/del`) das tabelas de interesse e `pg_current_wal_lsn()` antes/depois, para evidenciar escrita mesmo quando as linhas parecem iguais; o LSN também avança com atividade de fundo, então diferença exige explicação, não é falha automática.
- `cron.job_run_details`, `net._http_response` recentes e **logs do painel Supabase** (API, Auth, Storage, Edge) da janela, conferidos pelo responsável.
- Zeros de `media_assets` awaiting/queued/processing, leases e fontes válidas imediatamente antes e depois.
- Sentinela: o backup é marcado **"consistente verificado até o POST"**, nunca "garantidamente consistente".

**Nível B — reversíveis, exigem autorização separada e posterior (nenhuma proposta está autorizada agora):**
1. Pausar apenas o job `pcdnades-preview-sweep` (`cron.alter_job(active := false)`), registrando estado original e reativando no fim.
2. Janela em que o responsável **desliga os acessos administrativos** (sem alterar flags; é decisão de uso).
3. Pausar os workers do backend atual, mantendo só os endpoints de leitura, apenas se for possível sem deploy nem alteração de flags; senão não entra.
4. Esperar o TTL real **medido** das URLs assinadas (medição emite uma assinatura: operação própria).

**Nível C — não recomendados / só com decisão específica:** rotação do JWT secret ou das chaves (invalida tudo, não reversível limpa), revogação de URLs, mudar RLS/policies ou tornar o banco `read only`, trocar `default_transaction_read_only`. Fora do escopo.

**Efeito:** com apenas o nível A, o resultado é **evidência**, não barreira. Quem decidir sobre risco (por exemplo, aceitar o backup "verificado por PRE/POST") é o responsável; qualquer outra coisa exige o nível B.

## 5. Segurança e armazenamento

- **Destino:** `F:\BackupsPrivados` herda *Usuários* (leitura/execução) e *Usuários autenticados* (modificar). Isso **não** é aceitável para `auth.users`. Pasta nova: `icacls <pasta> /inheritance:r` e conceder apenas **o usuário atual, com controle total, e SYSTEM** (e, se for preferido, Administradores). Remover *Usuários* e *Usuários autenticados*; **herança desativada antes de criar qualquer arquivo**; conferir `icacls` com saída de verificação. Isso vale para o diretório; não alterar ACL das pastas antigas (apenas registrar o risco). Sem BitLocker no volume: risco já aceito em 11/11, **reconfirmar**; cifrar o dump (por exemplo, arquivo 7z/age com senha própria) é opção, não exigência.
- **Credenciais no Docker (corrigido).** `-e NOME` **não** protege: o Docker copia o valor para a configuração do contêiner e ele aparece em `docker inspect` (testado nesta revisão com um valor fictício: o valor apareceu). Também não usar `-e NOME=valor`, `--password`, nem URL com senha na linha de comando (`ps`, histórico, logs). **Mecanismo adotado: entrada padrão.** O segredo é digitado/colado pelo responsável em prompt oculto (`Read-Host -AsSecureString`, nunca ecoado), enviado por pipe para `docker run -i`, e lido dentro do contêiner por `read -r` para o ambiente do próprio `pg_dump`:

  ```text
  <segredo por stdin> | docker run -i --rm --network <sem rede ou padrão> -v <pasta-nova>:/out postgres:17 sh -c 'read -r PGPASSWORD; export PGPASSWORD; exec pg_dump -h <host> -U <usuário> -d postgres -Fc ... -f /out/full-custom.dump'
  ```

  Ensaio local feito (valor fictício, contêiner sem rede, removido): com `stdin` o valor **não** aparece em `docker inspect` nem na linha de comando. Limites: durante a execução o valor existe no ambiente do processo **dentro** do contêiner (visível a `docker exec` do mesmo usuário) e na memória do PowerShell; usar `SecureString`, converter só no instante do pipe, `Remove-Variable` e fechar o terminal ao fim. Evitar `.pgpass` em bind mount (no Windows chega com permissão aberta e o libpq o recusa, ou fica em disco). **Docker secrets/`--env-file` não são adotados** (arquivo em disco ou também visível em inspect). Nada disso modifica segredos existentes nem cria recurso em produção; o token de gerenciamento fica em `SUPABASE_ACCESS_TOKEN` só no processo da CLI (a CLI roda no host, fora do `docker inspect`) e o `--password` da CLI não é usado.
- **Temporários:** `%TEMP%\pcdn-backup-20261113` criada com herança desativada e ACL só do usuário; **nenhum segredo em arquivo**; removida ao fim.
- **Docker:** o dump roda com **volume de bind** só da pasta nova (`-v pasta:/out`); sem `--network host`; contêiner `--rm`. Volumes anônimos do restore: nome fixo `pcdn-restore-20261113-*`, `tmpfs` preferencial. O Docker Desktop (WSL2) guarda volumes em disco do usuário **fora** da ACL da pasta: dados reais restaurados ficam lá até a remoção; o runbook exige remoção e verificação de que não restou volume/contêiner com esse prefixo. Eles contêm hashes de senha de `auth`.
- **Logs e histórico do shell:** não registrar URL de conexão, token ou saída com credencial; limpar variáveis ao fim; checar `Get-History`/transcrições.
- **Preservação:** nenhum backup, worktree ou laboratório existente é alterado, parado ou removido. Contêineres e volumes `pcdn-pr19-*`, `supabase_db_*`, etc. permanecem como estão.
- **Git:** nada da pasta de backup vai ao repositório. Varredura de segredos nos arquivos de texto antes de fechar (padrões de JWT, `sb_`, `postgres://…:…@`).

## 6. Restauração — o que prova e o que não prova

**Restauração offline do PostgreSQL** (contêiner novo, `--network none`, nome `pcdn-restore-20261113`, imagem `public.ecr.aws/supabase/postgres:17.11.0.006`, mesma versão de produção): prova que o dump é **legível e completo em SQL**: contagens, hashes de linhas, schemas, policies, grants, triggers e histórico de migrations coincidem com o PRE.

**Não prova:** Auth real (GoTrue/JWT/login funcionam), Storage real (a API e o conteúdo dos buckets), RLS exercida por papéis reais via PostgREST, Edge Functions, Cron, Vault. **Validação real de Auth e Storage** só existiria com ambiente isolado aprovado que suba GoTrue/Storage/PostgREST sobre a cópia, o que **não é proposto agora** (exige autorização própria; os laboratórios existentes não têm isolamento aprovado para dados reais e não serão usados). Para Storage, o equivalente suportado é a comparação **arquivo × metadados restaurados**.

**Critérios para chamar o backup de recuperável** (todos):
1. Verificação do dump (3.1) aprovada nos cinco schemas.
2. Restauração sem erro além do `schema "public" already exists`.
3. Contagens e hashes pós-restauração = PRE (granadas, mídias, `import_sources`, `auth.users`, `storage.objects`, migrations, grenades/media_assets com `extra_float_digits=0`) e policies/grants/triggers com hashes iguais.
4. Objetos: 100 % existentes, tamanho = metadados, MD5 = ETag, SHA256 igual aos de `release-20261111` para os preexistentes.
5. PRE == POST (nível A) sem divergência inexplicada; qualquer divergência invalida.
6. Manifesto SHA256 do backup novo confere; manifestos antigos reconferidos **sem reescrever**.
7. ACL da pasta nova verificada; varredura de segredos limpa; temporários e contêiner removidos.
8. Itens fora do escopo (seção 0) documentados com responsável e forma de recadastro.

Resultado, se tudo passar: **"recuperável para banco e bytes dos objetos"**, não "recuperação integral".

## 7. Sequência e gates

Somente com autorização escrita específica:

0. Reconfirmar HEADs/refs, estado limpo; instalar/conferir CLI com `--help`; autenticar pelo método escolhido; criar pasta com ACL restrita **antes** de qualquer arquivo.
1. Inventário PRE (somente leitura; `auth.users` só `count`). **Gate 1:** contagens ≥ baseline, migrations 13, duas novas ausentes, zeros de fila; senão NO-GO.
2. Verificação de escritores (nível A) + janela definida pelo responsável. **Gate 2.**
3. `pg_dump` dos cinco schemas + verificação 3.1 + `roles.sql`/schema legível + SHA256. **Gate 3:** critérios (i)–(iv).
4. Cópia do Storage + comparação 3.2. **Gate 4.**
5. Inventário POST, comparação com PRE e contadores. **Gate 5:** sem divergência inexplicada.
6. Exportações complementares (3.3).
7. Manifesto, notas, varredura de segredos, limpeza de variáveis/temporários.
8. Restauração offline e critérios da seção 6. **Gate 6.**
9. Registrar e **parar**. Nenhuma migration, merge ou deploy.

## 8. Interrupção e recuperação

- Falha antes do dump: nada foi alterado em produção. Renomear a pasta com `-FALHOU` (não apagar).
- Falha de dump/cópia: não reaproveitar parciais; nova pasta `-r2`.
- Divergência PRE/POST: marcar `INVALIDO`, manter, repetir.
- Token/credencial expirada: parar; novo acesso é decisão do responsável, jamais pelo chat e jamais a service-role de `backup.env`.
- Role temporária criada pela CLI (se for o caminho aprovado): remover/deixar expirar conforme aprovado e registrar.
- Restauração falha: remover só o contêiner/volume de nome `pcdn-restore-20261113*`; repetir.
- Produção só recebe leitura (nível A) e, se aprovado, a criação/remoção de role temporária; nenhuma reversão de serviço é necessária.

## 9. Estado GO/NO-GO e pendências

**NO-GO (execução).** Pendências antes de pedir autorização:
1. CLI não instalada no host e sem login; v3.1.0 tem help conferido (seção 2), a versão a usar é decisão sua e o help deve ser repetido na versão escolhida.
2. Escolha do acesso PostgreSQL (senha existente vs role temporária; esta é escrita remota).
3. Aprovação do token de gerenciamento temporário e de seu descarte.
4. Decisão sobre o nível de barreira (A apenas, ou A+B1/B2) e a janela.
5. Decisão sobre cifrar o backup e retenção/cópia externa; BitLocker ausente.
6. Escolha do que fazer com Vault/Edge/Auth (seção 3.3) e quem guarda os valores.
7. Medição do TTL real das URLs assinadas, se se quiser reduzir a espera.

Segue vedado sem autorização específica: backup produtivo, leitura de dados reais, migrations, deploy, merge, flags, pausa do Cron, rotação/revogação, exclusões, serviços pagos, alteração de vínculo de outras worktrees.

## 10. Proposta operacional para a próxima etapa

**Já preparado (documentação, sem execução):** escopo do backup, método do `pg_dump` e verificação do dump, cópia e comparação dos bytes do Storage, acesso e escopos da CLI v3.1.0 (help conferido), mecanismo de credencial por stdin (ensaio local com valor fictício), ACL da pasta, restauração offline e critérios de "recuperável", gates e plano de falha.

**Combinação recomendada**, em ordem:
1. **Silêncio administrativo (sua ação, sem alteração técnica):** ninguém usa admin, upload, corte ou importação durante a janela; sessões admin fechadas. Janela sugerida: começar ≥ 2 h após o último upload/importação/inspect (estimativa do TTL do upload, ver seção 4), ou aceitar o risco residual declarado.
2. **Pausa temporária do Cron `pcdnades-preview-sweep` (nível B1): recomendada, mas só com autorização específica e posterior.** Antes de pausar, ler e registrar o estado original do job; depois de PRE/POST e do dump, reativar e conferir o estado idêntico. Sem essa autorização, seguir só com o nível A e tratar qualquer execução do Cron na janela como possível divergência.
3. **PRE/POST (nível A)** em volta do dump e da cópia dos objetos, com contadores, logs e `cron.job_run_details`. Resultado rotulado "consistente verificado até o POST".
4. **Restauração offline** em contêiner novo sem rede e critérios da seção 6, com a limitação de Auth/Storage reais registrada.

**Depende de decisão ou autorização sua:** versão da CLI; token de gerenciamento temporário e seus escopos (`database_write` se for role temporária; `api_gateway_keys_secret_read` para o Storage); senha existente ou role temporária; pausa do Cron; janela; cifrar/retenção; guarda de Vault/Edge/Auth; medição do TTL. **Nada acima está autorizado.**
