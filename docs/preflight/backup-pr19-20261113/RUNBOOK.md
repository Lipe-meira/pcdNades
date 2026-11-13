# Runbook — backup atualizado e restauração verificada (pré-migrations do PR #19)

13/11/2026, America/Sao_Paulo. **Preflight operacional, somente leitura local e planejamento.** Nenhum dado real foi exportado, nenhuma consulta foi feita no Supabase de produção, nenhuma credencial foi lida. Sem segredos neste documento.

Decisão atual: **NO-GO para executar** até cumprir os pré-requisitos da seção 2 e receber autorização específica do responsável.

## 1. Estado dos dados

| Item | Valor | Origem / confiança |
| --- | --- | --- |
| Último baseline remoto | 19 granadas, 25 mídias, 21 objetos, 104.741.093 bytes declarados, 13 migrations (última `20261111031252 map_levels`) | Preflight de 13/11 10:20–10:28 SP. **Fotografia antiga: deve ser reconfirmada; não foi reconfirmada nesta tarefa.** |
| Último cadastro de granada | 12/11 23:46:37 UTC | idem |
| Backup mais recente | `release-20261111-nuke-premigration` (15 / 21 / 17, 12 migrations, 83.721.056 bytes) | Metadados lidos agora. **Não cobre o estado atual.** |
| Filas/leases | zero no instante do preflight | Não é barreira de escrita |
| Cron conhecido | `pcdnades-preview-sweep` (ativo em 11/11) | Reconfirmar |

**Inventário remoto desta tarefa: NÃO executado.** Esta sessão não tem conector Supabase, a CLI não está no PATH nem há login ativo; os arquivos de credencial locais (`production-backup/backup.env`) contêm uma service-role key, privilégio maior que o necessário para um inventário. Não a usei. O inventário passa a ser o **passo 1 da execução** (somente leitura, ver seção 5).

## 2. Ferramentas e pré-requisitos

Disponíveis (verificado): Docker 29.7.2 com Docker Desktop ativo; imagens `postgres:17`, `postgres:17.11-alpine`, `public.ecr.aws/supabase/postgres:17.11.0.006`; Node em `C:\Program Files\nodejs`; 413 GB livres em `F:`; backups anteriores íntegros por manifesto.

Ausentes / pendentes:

1. **Supabase CLI** (`npx supabase`, 3.1.0 pede download) e **login**. Sugestão: o responsável roda `! npx supabase login` e `! npx supabase link --project-ref <ref de produção>` nesta sessão (token fica no armazenamento da CLI, nunca no chat). Alternativa: conector Supabase em sessão que o tenha.
2. `pg_dump/psql` não existem no host: usar contêiner `postgres:17` (igual aos backups anteriores).
3. **Proteção do destino:** `F:\BackupsPrivados` herda ACL com *Usuários* (leitura) e *Usuários autenticados* (modificar); sem BitLocker (risco já aceito em 11/11). O backup novo contém `auth.users` (e-mails e hashes). A pasta nova deve ter herança desativada e uma única regra para o usuário `felip` (+ SYSTEM). Não altero ACL das pastas antigas.
4. Decisão de retenção do backup (quanto tempo, e onde fica a cópia fora de `F:`, se houver). Sem serviço pago.
5. Janela e operador: o responsável não usa o admin/importação durante a janela (~30–60 min estimados, depende de rede).
6. Confirmar quais produtos de **Auth/Vault/Cron/Edge** devem entrar (seção 3, item 7).

## 3. Escopo do backup

Pasta nova (não existe, não sobrescreve nada): `F:\BackupsPrivados\pcdnades\release-20261113-pre-collab-migrations\`

1. **PostgreSQL**, `pg_dump 17 -Fc` somente leitura, schemas `public`, `private`, `auth`, `storage`, `supabase_migrations` (o de 10/11 sem `private` falhava; manter `private`). Mais: `schema-public-private.sql` legível, `roles.sql` (`db dump --role-only`), `pg_restore --list`, SHA256 de cada arquivo. `pg_dump` roda numa única transação snapshot: o banco é consistente em si.
2. **Storage:** cópia completa do bucket `videos-staging` (e `import-previews`, hoje vazio) por `supabase --experimental storage cp -r`, em `storage/<bucket>/<uuid>/<arquivo>`.
3. **Inventário:** `INVENTORY-PRE.json` e `INVENTORY-POST.json` (contagens por tabela, `grenades/media_assets/import_sources/auth.users/storage.objects`, soma de bytes, hash das linhas de `grenades` e `media_assets` com `extra_float_digits=0`, hash de policies/grants/triggers, lista de migrations, lista `storage.objects` com `id,name,size,etag,updated_at`); `videos-sha256.csv` com tamanho, MD5 (= ETag) e SHA256 por objeto.
4. **Manifesto:** `MANIFEST.sha256` de todos os arquivos + `BACKUP-NOTES.md`.
5. **Não** vão ao Git: nenhum arquivo desta pasta. Só um resumo sem segredos no checkpoint.
6. **Credenciais:** senha da role temporária da CLI só em memória/variável de ambiente do processo, removida ao fim; sem `.env` copiado; nada em `docker run` visível em log (usar `-e VAR` sem valor na linha de comando); arquivos temporários só em `%TEMP%\pcdn-backup-<data>` com ACL do usuário, apagados ao fim com checagem de caminho.
7. **Fora do `pg_dump`, exportação complementar sem segredos:** definição de `cron.job` (nome, agenda, ativo, hash do comando), lista de **nomes** de Vault (nunca valores), lista/versão de Edge Functions e secrets por nome, configuração de Auth (anonymous/CAPTCHA/site URL) por captura de tela ou resposta da Management API sem chaves. Valores de Vault/secrets continuam sendo do responsável e não entram no backup (limitação explícita, igual aos backups anteriores).

## 4. Barreira de escrita

Restrições desta fase: não pausar Cron, não alterar flags, não revogar URLs. Portanto a barreira é **combinação de silêncio operacional + detecção**:

- **Antes:** responsável congela edição/upload/importação (nenhum login admin ativo). O app público é só leitura.
- **Detecção:** o inventário é tirado antes (`PRE`) e depois (`POST`) de dump e cópia de objetos. O backup só vale se `PRE == POST` em: contagem e hash de linhas de `grenades`, `media_assets`, `import_sources`; lista `storage.objects` (`id,size,etag,updated_at`); histórico de migrations; `max(updated_at/created_at)`. `import_sources`/`media_assets` podem mudar por processos assíncronos pendentes: qualquer diferença = tentativa **inválida**, repetir a janela, nunca "consertar".
- **Uploads/URLs assinadas ainda válidas:** TTL produtivo não comprovado (não presumir 2 h; 60 s do laboratório não vale). Uma URL assinada emitida antes da janela pode gravar durante a cópia. Tratamento: esperar a janela conservadora definida pelo responsável após o último uso do admin (proposta: **2 h** sem emissão de upload/reserva/inspect), conferir zeros em `media_assets` awaiting/queued/processing, leases e `import_sources` válidas **imediatamente antes** do dump, e confirmar `PRE == POST`. O `PRE == POST` é o que prova que nada gravou; a espera só reduz a chance de reexecução.
- **Cron `pcdnades-preview-sweep`:** só é considerado escritor se `cron.job_run_details` mostrar execução na janela ou se o PRE/POST divergir. Sua parada, se necessária, exige autorização própria (não pedida agora).

## 5. Sequência exata de execução

Nada disto executa sem a autorização da seção 9.

0. Confirmar HEADs (`main` = `e0ad980…`, PR #19 = `53686d2…`) e árvore de trabalho limpa. Criar a pasta, desativar herança da ACL (apenas nela), registrar hora de início.
1. **Inventário PRE somente leitura** (transação `READ ONLY`, sem colunas pessoais; `auth.users` só `count`): preenche `INVENTORY-PRE.json`; compara com 19/25/21. **GO/NO-GO #1** (ver seção 7).
2. Esperar a janela de silêncio e rodar de novo a checagem de filas/leases/fontes válidas/`cron.job_run_details`. **GO/NO-GO #2.**
3. `pg_dump -Fc` pelo pooler via contêiner `postgres:17` → `db/full-custom.dump`; `pg_restore --list`; `schema-public-private.sql`; `roles.sql`; SHA256.
4. Cópia do Storage; tamanho + MD5 = ETag por objeto; SHA256; `videos-sha256.csv`.
5. **Inventário POST** idêntico ao PRE. **GO/NO-GO #3.**
6. Exportações complementares (seção 3, item 7).
7. `MANIFEST.sha256`, `BACKUP-NOTES.md`; remover temporários e variáveis de ambiente de credencial; conferir ACL final.
8. **Restauração isolada** (seção 6) e validação. **GO/NO-GO #4.**
9. Registrar resultados no checkpoint; **PARAR.** Migrations só em autorização própria posterior.

## 6. Restauração em ambiente isolado

- Contêiner **novo e dedicado**, nome único `pcdn-restore-20261113`, imagem `public.ecr.aws/supabase/postgres:17.11.0.006` (mesma major/minor de produção, traz roles e extensões Supabase), `--network none` ou rede interna sem saída, sem publicar portas, dados em `tmpfs`/volume anônimo apagado ao fim. Não usar nenhum dos contêineres existentes (`pcdnades-restore-20261102-isolated`, `pcdnades-backup-lab`, os `solo-e2e`/`e2e`), que continuam rodando e não têm isolamento aprovado para dados reais; preservá-los.
- O dump e `roles.sql` entram por volume somente leitura; `pg_restore --no-owner` é tolerado só se o erro esperado `schema "public" already exists` for o único.
- Storage: validação por hash dos arquivos copiados contra o inventário e contra `storage.objects` restaurada (não sobe Storage real; o que se prova é a integridade dos bytes e da referência).
- O que **não** se prova: extensões gerenciadas, Auth/Storage hospedados, Vault, Cron, Edge. Registrar como limitação.
- Ao fim: parar e remover só o contêiner/volume criado por esta execução (verificar o nome antes), sem apagar backups.

## 7. Critérios GO/NO-GO

| Gate | GO se | NO-GO se |
| --- | --- | --- |
| #1 PRE | contagens lidas e coerentes (o esperado é ≥ 19/25/21); migrations = 13 e últimas conhecidas; duas migrations novas ausentes; zero reserva/lease/processamento | contagem menor que a baseline sem explicação; migrations 1/2 parcialmente presentes; processamento ativo; erro de autenticação |
| #2 janela | zeros de filas/leases/fontes; sem execução do Cron na janela de silêncio | qualquer escrita nova |
| #3 POST | `PRE == POST` em todos os itens da seção 4; tamanho+MD5=ETag em 100 % dos objetos | qualquer divergência: descartar a tentativa, repetir |
| #4 restauração | só o erro benigno; contagens e hashes iguais ao PRE; hash de policies/grants/triggers igual; `storage.objects` restaurado = arquivos copiados (nomes, tamanhos, SHA256) | qualquer diferença; erro além do benigno |
| Final | backups antigos intactos (manifestos antigos reverificados sem reescrever); ACL da pasta nova restrita; sem segredos em arquivos de texto (varredura); temporários removidos | — |

## 8. Interrupção e recuperação

- Qualquer falha antes do passo 3: nada foi alterado; apagar somente a pasta nova **se estiver vazia ou só com arquivos desta execução e com a sua confirmação**, ou renomear com sufixo `-FALHOU` (preferido).
- Falha do `pg_dump`/Storage: não reutilizar arquivos parciais; nova pasta com sufixo `-r2`.
- Divergência PRE/POST: manter o material, marcar `INVALIDO`, repetir.
- Credencial expirada: parar, pedir novo login ao responsável (nunca pelo chat), não improvisar com a service-role key.
- Contêiner de restauração travado: removê-lo pelo nome exato e repetir; nunca restaurar para o ambiente existente.
- O produto em produção não é tocado em nenhum dos passos; **recuperação do serviço = nenhuma ação**, pois só há leitura.

## 9. Participação do responsável e solicitação

Precisa de você: (a) login da CLI/vínculo do projeto (`!` no prompt), (b) silêncio operacional na janela, (c) decisão de retenção/cópia externa, (d) confirmar a janela de 2 h ou outra, (e) aprovar ACL restrita na pasta nova.

**Pedido de autorização:** autorize, por escrito, a execução dos passos 0–9 acima exclusivamente para criar `release-20261113-pre-collab-migrations`, com leituras somente-leitura no projeto de produção `kdyzxxgzvgiffluyjjxu`, cópia local dos dados e objetos, restauração apenas no contêiner dedicado sem rede, e parada ao final. Sem autorização, nada é executado.

Segue vedado, sem pedido: migrations, merge, deploy, flags, pausa do Cron, exclusões, rotação/revogação de credenciais, serviços pagos.
