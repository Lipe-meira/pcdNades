# Nuke com dois andares — 11/11/2026

Branch `feat/nuke-two-floors` (base `main` b661dd0, que contém o PR #10). Referência funcional: botões 1 e 2 do CSNADES;
layout e identidade continuam os do pcdNades. **A migration deste PR foi aplicada em produção em 11/11/2026 às 03:13 UTC (versão registrada `20261111031252 map_levels`); o merge e o deploy do PR dependem de autorização separada.**

## Modelo de dados
- Coordenadas **não mudam**: continuam normalizadas (0–1) no radar 1024×1024. Os dois andares da Nuke usam o mesmo sistema
  (`nuke.png` e `nuke_lower.png` têm a mesma calibração), então uma granada só precisa dizer **em qual andar** cada ponto está.
- `grenades.origin_level` e `grenades.target_level` (`text`, nulos, `'upper'|'lower'`). Cada destino do Solo Exec ganha a chave
  opcional `level` dentro de `destinations`. Nível nulo = andar padrão do mapa (`upper`), logo registros anteriores seguem válidos.
- Regras no banco (`20261111031252_map_levels.sql`): andares só em mapas de `private.map_has_levels` (hoje só `nuke`); andar da
  origem exige origem; no Solo Exec o `target_level` é o do 1º destino e `target` continua sendo `{x,y}`. Colunas, função e checks
  são aditivos; não altera linhas, grants, policies, triggers nem o `revision`.
- Produção hoje não tem **nenhuma** granada na Nuke (consulta de leitura em 11/11/2026: 16 granadas em Mirage, Inferno, Dust II e
  Cache), então não há dado legado de Nuke a migrar.
- API: `originLevel`, `targetLevel` e `destinations[].level`. O backend valida (`levelMaps`): Nuke exige andar do destino e, havendo
  origem, andar da origem; outros mapas rejeitam andares. O frontend não envia campos de andar para os demais mapas.

## Frontend
- `domain/mapLevels.ts`: catálogo `mapLevelCatalog` (id do mapa → andares, PNG de cada andar e recorte de exibição). Para um
  novo mapa com andares: uma entrada aqui, o id em `private.map_has_levels` (nova migration) e em `levelMaps` (backend).
- `Radar`: com `level` e `onLevelChange` mostra os botões 1/2 (alvo de toque 44px, `aria-pressed`, teclado), troca a imagem sem
  recarregar e mostra só os pontos do andar. O recorte (`viewport`) ocupa melhor o espaço: ele só afeta a exibição; marcadores e
  cliques continuam em coordenadas do PNG inteiro, por isso não deslocam em 320px, 390px, desktop nem no radar ampliado.
- Biblioteca: filtros e contagens independentes do andar; abrir uma granada mostra o andar onde ela cai; quando ela usa o outro
  andar (origem ou destino), aparece "Também usa o andar N · ver". Trocar de mapa volta ao andar padrão.
- Editor (só na Nuke): "Andar da origem" e "Andar do destino" (radios, também para quem usa só o teclado), radar mostra o andar do
  ponto em edição e clicar grava o ponto naquele andar; Solo Exec guarda o andar de cada destino sem perder o tipo.

## Verificação
- `node backend/scripts/map-levels-migration-smoke.mjs` (PGlite descartável, requer `backend/vendor/sql-test`): legado idêntico,
  ACL/policies/RLS/grants/triggers idênticos, regras de andar, rollback testado. Não substitui validar no Supabase real.
- Rollback: `backend/rollbacks/20261111031252_map_levels_rollback.sql` (descarta as colunas; só com a Nuke sem registros).

## Revisão final e ensaio (11/11/2026)
- Schema de produção lido (somente leitura) e igual ao esperado: `grenades_solo_destinations_check` exatamente com `target = (destinations->0) - 'type'`, `grenades_type_check` já com `he` (migration `20261111015949_he_grenade_type` registrada), 2 triggers (`grenade_ready`, `grenade_revision`), 4 policies com RLS ativo, `authenticated` sem UPDATE, função `private.valid_solo_destinations` com `he` e ACL `postgres/authenticated/service_role`, mapa `nuke` em `public.maps`, `private.map_has_levels` ainda inexistente, 16 granadas (0 na Nuke).
- Ensaio: o dump real de produção (`pg_dump -Fc`, com `private`) foi restaurado em Postgres 17 descartável (sem rede), a migration da HE e a da Nuke foram aplicadas nessa ordem e, depois, o rollback. Resultado: hash das 16 linhas idêntico antes/depois, policies, grants, triggers, RLS e ACL da função idênticos, as 2 granadas `solo_exec` reais revalidaram na nova constraint, inserção Nuke andar 1 → andar 2 aceita, andar em mapa sem andares rejeitado, e o rollback devolveu exatamente o estado anterior.
- Limites do ensaio: banco local, não o Supabase real; extensões como `pg_cron` não existem lá, mas a migration não toca nelas.

## Aplicação em produção (11/11/2026)
- Pré-checagens (somente leitura) aprovadas: projeto `pcdNades` (`kdyzxxgzvgiffluyjjxu`, ACTIVE_HEALTHY), histórico sem `map_levels`, `grenades_solo_destinations_check` com o texto esperado, backup `release-20261111-nuke-premigration` íntegro (manifest e 17 vídeos), CI verde no commit `a3f37b7`.
- Aplicada uma única vez com `apply_migration` (nome `map_levels`, SQL do arquivo sem `begin`/`commit`), registrada como `20261111031252`; o arquivo do repositório foi renomeado para essa versão (conteúdo idêntico, SHA256 `ca7b895f151e325f5fa5c2b2284ea6e5a2d5764250f16658ae181e5999671247`).
- Pós-checagens aprovadas: 15 granadas, 21 mídias, 27 `import_sources`, 17 objetos, hash das linhas de `grenades` igual ao do backup (`3c4cb282053d7f587a56720600c579f6`), hash de `media_assets`, policies, grants e triggers iguais; colunas `origin_level`/`target_level` criadas e vazias; `grenades_levels_check`, `grenades_solo_destinations_check` e `grenades_type_check` validadas; `private.map_has_levels` com ACL `postgres/authenticated/service_role`; RLS ativo; Cron ativo.
- Pendente: merge do PR #14, deployments, smoke com granada de teste na Nuke (ver abaixo) e eventual limpeza da mídia do teste, tudo com autorização.

## Sequência de publicação (itens 1 a 5 concluídos em 11/11/2026; restante aguarda autorização)
Pré-condições: PR aprovado, CI verde, branch sincronizada com a `main` (incluindo o PR #13).
1. **Backup novo** (o último, `release-20261110-delta`, é anterior a mudanças de dados): `pg_dump -Fc` com os schemas `public`, `private`, `auth`, `storage` e `supabase_migrations`, mais os objetos novos do Storage; conferir SHA256 e `pg_restore --list`.
2. **Pré-checagem** (somente leitura, repetir no momento da aplicação): `list_migrations` sem `map_levels`; `grenades_solo_destinations_check` com o texto acima; contagens (granadas, mídias, objetos) iguais às do backup; `private.map_has_levels` inexistente.
3. **Aplicar** com `apply_migration` (nome `map_levels`, SQL de `20261111031252_map_levels.sql` sem `begin`/`commit`, que o `apply_migration` já envolve numa transação). Sem inserir nada à mão em `schema_migrations`.
4. **Pós-checagem**: histórico registrado; colunas `origin_level`/`target_level`; checks `grenades_levels_check` e `grenades_solo_destinations_check` validados; `private.map_has_levels` com ACL `postgres/authenticated/service_role`; contagens e hash das linhas iguais ao pré; policies, grants, triggers, RLS e função iguais.
5. **Alinhar o nome do arquivo** à versão que o Supabase registrar (como foi feito na HE) em commit pequeno na branch do PR, antes do merge.
6. **Merge** do PR e conferência dos deployments `pcdnades` e `pcdnades-api` na Vercel (backend antes do frontend se forem publicados separados; a migration vem antes de ambos).
7. **Smoke** com granada de teste na Nuke (origem andar 1, destino andar 2 e um Solo Exec com destinos nos dois andares): conferir os dois radares, editar, excluir; depois confirmar 16 granadas originais. Excluir a granada não remove a mídia enviada pelo teste: sobra 1 mídia e 1 objeto (limpeza só com autorização).
- **Rollback**: antes de qualquer registro na Nuke, `backend/rollbacks/20261111031252_map_levels_rollback.sql`. Se já houver registros com andares, exportá-los ou removê-los primeiro (as colunas são descartadas). Problema só no frontend/backend: reverter o deployment na Vercel; a migration é compatível com as versões anteriores.

## Limitações
- Radares: ver `frontend/public/maps/valve/ATTRIBUTION.md` (origem e licença não registradas; setpos.gg não tem andar inferior).
- O andar inferior mostra a silhueta do superior esmaecida, como no arquivo original.
- Os PRs #11 (UX mobile), #12 (mensagens de feedback) e #13 (experiência de carregamento) já estão na main e foram integrados a esta branch (merge 005013e); nenhum arquivo deles foi alterado por esta funcionalidade e os testes deles continuam passando.
