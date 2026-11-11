# HE Grenade e vídeos mutados — 10/11/2026

Branch `feat/he-video-muted` (base `origin/main` 67445d5, merge do PR #9).

## HE Grenade (`he`)
- Frontend: `frontend/src/domain/types.ts` centraliza `singleGrenadeTypes`/`grenadeTypes` e os guards `isSingleGrenadeType`/`isGrenadeType`, usados por validação, contrato da API, rascunho local, radar, formulário e filtros. Ícone: `frontend/public/filter-icons/he.png`; rótulo "HE Grenade".
- Backend: `backend/src/model.ts` (Zod) aceita `he` em `type`, em `destinations[].type` do Solo Exec e no filtro `type` da listagem.
- Banco: `backend/migrations/20261111015949_he_grenade_type.sql` recria `grenades_type_check` com `he` e substitui (`create or replace`) `private.valid_solo_destinations`. Não toca em linhas, grants nem RLS.
- Validação isolada: `node backend/scripts/he-migration-smoke.mjs` (PGlite, requer `backend/vendor/sql-test`). Não substitui validação em Supabase real.

## Vídeos mutados
- `frontend/src/components/MutedVideo.tsx`: o `<video>` nasce com `muted = true` (aplicado uma vez no mount e quando `sourceKey` muda, nunca a cada render). Usado em `VideoPlayer`, `LocalVideoPreview`, `ImportSourcePreview` e no vídeo do teste privado.
- Renovação de URL do mesmo vídeo: posição, reprodução, mute e volume são capturados após a espera da rede e restaurados em `loadedmetadata` (`domain/playback.ts`). Outro vídeo recomeça mutado.
- Os MP4 e o Storage não são alterados; o áudio continua nos arquivos.

## Sequência segura de publicação (aguarda autorização explícita)
1. Revisar e aprovar o PR; nada é aplicado antes disso.
2. Backup/janela conforme `docs/ISOLATED-ROLLOUT-20261108.md`.
3. Aplicar a migration `20261111015949_he_grenade_type.sql` no Supabase (é aditiva e compatível com o backend atual, que simplesmente não envia `he`).
4. Publicar o backend (aceita `he`). Se o backend subir antes da migration, criar HE falha no banco; por isso a migration vem primeiro.
5. Publicar o frontend (passa a oferecer HE). Frontend antes do backend faz o cadastro HE ser rejeitado pela API.
6. Smoke em produção: criar HE de teste, filtrar, abrir vídeo (inicia mutado) e remover o teste.
