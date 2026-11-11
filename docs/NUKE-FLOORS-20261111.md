# Nuke com dois andares — 11/11/2026

Branch `feat/nuke-two-floors` (base `main` b661dd0, que contém o PR #10). Referência funcional: botões 1 e 2 do CSNADES;
layout e identidade continuam os do pcdNades. **A migration deste PR não foi aplicada em nenhum ambiente.**

## Modelo de dados
- Coordenadas **não mudam**: continuam normalizadas (0–1) no radar 1024×1024. Os dois andares da Nuke usam o mesmo sistema
  (`nuke.png` e `nuke_lower.png` têm a mesma calibração), então uma granada só precisa dizer **em qual andar** cada ponto está.
- `grenades.origin_level` e `grenades.target_level` (`text`, nulos, `'upper'|'lower'`). Cada destino do Solo Exec ganha a chave
  opcional `level` dentro de `destinations`. Nível nulo = andar padrão do mapa (`upper`), logo registros anteriores seguem válidos.
- Regras no banco (`20261111120000_map_levels.sql`): andares só em mapas de `private.map_has_levels` (hoje só `nuke`); andar da
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
- Rollback: `backend/rollbacks/20261111120000_map_levels_rollback.sql` (descarta as colunas; só com a Nuke sem registros).

## Sequência de publicação (aguarda autorização)
1. Backup do banco (pg_dump, schemas incluindo `private`) e dos objetos novos do Storage.
2. Aplicar a migration (aditiva; compatível com o backend e o frontend atuais, que ignoram as colunas novas).
3. Merge deste PR e conferência dos deployments `pcdnades` e `pcdnades-api`. Backend antes do frontend se forem publicados separados.
4. Smoke: cadastrar uma granada de teste na Nuke (origem andar 1, destino andar 2), conferir os dois radares, editar, excluir.

## Limitações
- Radares: ver `frontend/public/maps/valve/ATTRIBUTION.md` (origem e licença não registradas; setpos.gg não tem andar inferior).
- O andar inferior mostra a silhueta do superior esmaecida, como no arquivo original.
- O PR #11 (UX mobile) altera estilos próprios (`mobile-ux.css`); não há arquivo em comum além do checkpoint do frontend.
