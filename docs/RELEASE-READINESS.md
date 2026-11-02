# Integração para main — 02/11/2026

Branch: `integration/pcdnades-release`, criada em worktree exclusivo a partir de `origin/main` fcd360d. Não houve merge/push na main, deploy, mudança de env ou escrita no Supabase remoto.

## Reconciliação do Git

| Origem | Estado inicial | Decisão |
| --- | --- | --- |
| origin/main | fcd360d; main local0a97bf8 em outro checkout | Base remota atual; main local preservada |
| dev | 4e3d4dd, limpa/sincronizada | Merge normal10d58ac |
| feat/frontend local | 63729fa, limpa, redesign exclusivo | Merge normal9721974; remoto antigo494ae91 não era a entrega |
| feat/backend local | 28e10b4, limpa | Já ancestral de dev, sem merge redundante |
| codex/reels / codex/solo-e2e | a46c7af /3126c6d, limpas | Já ancestrais de dev |
| feat/preview-fonte | c2f90e5, alterações não commitadas | Preservadas; implementação parcial obsoleta, não sobrepor versão final POST/GET/TTL/cleanup |

Nenhum conflito textual nos merges. Correção semântica25629a5: reposicionar origem não reativa destino já marcado; marcadores públicos Solo isolados mostram índice e tipo. Quatro testes direcionados falharam antes e passaram depois; agrupamento de destinos sobrepostos e seleção do mesmo vídeo foram preservados. Chats existentes revisaram sem alterar branches originais.

## Funcionalidades e contratos

- Radar maior, filtros acima, lista lateral desktop, ampliação com Escape/foco, seleção por mouse/toque/teclado e coordenadas percentuais preservadas.
- Solo Exec: um vídeo, origem única, até12destinos tipados, target compatível com primeiro destino; CRUD/conversão/filtros e leitura de legado.
- MP4 e playback existentes preservados; build novo não habilita importador por si só. TikTok depende das flags/autorização atuais e continua com o piloto30s/50MB; upload90s independente.
- Reels tem implementação e provas locais reais anteriores; nesta integração não foi feito novo download externo. Fica off por padrão até configuração e teste autorizados.
- Prévia privada tem player/cortes/URLs curtas/TTL/owner/reserva/cleanup e runner privado. Continua off sem heartbeat e infraestrutura monitorada; runner não provisionado.
- YouTube Shorts permanece explicitamente desabilitado. Não há importador operacional anunciado ou embed substituindo download.
- Teste privado de mídia não cria smoke; salvar granada é publicação explícita. Não existe rascunho privado de granada. Restrição de primeiro administrador continua no backend; liberar outros administradores é mudança futura.

Arquivos centrais: Radar.tsx, Library.tsx, LineupForm.tsx, styles.css; domain/types e validation; apiContracts/apiService; backend/model.ts/application.ts/import-api/runtime/processing/network; instagram.ts/source-preview*/maintenance-runner e as três migrations novas.

## Backup e banco

O relato antigo de backup bloqueado foi superado pelo procedimento manual informado pelo usuário. O orquestrador verificou SOMENTE o hash do arquivo privado `production-after-cleanup.dump`: CBD08D9F81DEDB87E9375027E680EEA358BAD958E3569B768070B8DF350E07C3. Original e laboratório55322 preservados. O usuário comprovou restore de schema/data, seis contagens e histórico de cinco migrations; roles.sql não foi restaurado integralmente. Isso não comprova igualdade de todas as linhas, configurações externas, chaves ou bytes de Storage. Nenhum dado/backup/credencial deve entrar no PR.

Consulta SOMENTE de metadata remota confirmou histórico inicial/canonical_maps/90segundos/origem/TikTok e ausência das três migrations novas, coluna destinations, RPC Instagram e tabela preview. TikTok20261030124528 já aplicada: NÃO reaplicar. Bucket existente videos-staging é privado50MB. O código novo depende de schema coordenado antes da publicação; flags off não dispensam migration Solo, pois CRUD envia campos novos.

Ordem: `20261101152756_solo_exec_destinations.sql` → `20261101153422_instagram_import_sessions.sql` → `20261102000337_import_source_previews.sql`. Ensaio em clone descartável derivado da cópia do backup, com rede desativada, conduzido pelo backend; resultado final será registrado antes do PR. Laboratório original não será atualizado para facilitar o ensaio.

## Publicação e rollback

Inspeção UI Vercel SOMENTE leitura: ambos projetos Production rastreiam `main`, com autoassign de domínios ligado; Preview Branch Tracking desligado em ambos. Push de integração/PR não deve publicar os projetos; merge main dispara builds de produção independentes. Nenhum Preview manual autorizado nesta tarefa.

Sequência após aprovação final: conferir backup/escopo e janela administrativa, autorizar/aplicar migrations exatas e verificar histórico/RLS/grants, manter Instagram/prévia off e TikTok existente configurado, autorizar merge normal do PR, confirmar deploys dos dois projetos e smoke tests legado/MP4/login/playback/CRUD antes de publicar Solo. Solo não tem flag e aparece após deploy; não criar registros enquanto frontend/backend ainda estiverem em versões diferentes. Somente depois definir coletor/supervisor/monitor e obter autorização separada para flags novas/teste privado.

Rollback código por revert de merge revisado e push normal autorizado, ou retorno aos deployments capturados com confirmação de aliases. Restaurar flags explicitamente: rollback Git/deploy não desfaz envs. Banco deve permanecer aditivo; retirar tipo/coluna após existir Solo/Instagram pode perder dados ou quebrar constraints, portanto só migration compensatória revisada e autorizada. Não apagar vídeos finais/publicados/buckets para reverter código. Front antigo pode não representar Solo recém-criado: esse risco precisa ser tratado antes de um rollback.

## Resultado final da integração

- Nesta worktree: backend136testes e buildPASS; frontend58unitários/typecheck/buildPASS; Playwright final82/82PASS em desktop/mobile após as correções. Quatro testes direcionados RED→GREEN comprovaram os dois bugs antes/depois. Não há comando lint configurado; nenhum resultado de lint alegado.
- Capturas da árvore integrada foram inspecionadas em desktop e celular (biblioteca/radar ampliado). Ficam em frontend/test-results, ignoradas pelo Git. Testes de navegador usam demo/API controlada: não são importações externas ou Storage cloud.
- Migrations em NOVO container17.11 sem rede/portas, restaurado de cópia do dump: baseline1granada/4mídias/1usuárioAuth/0objetosStorage/histórico5. Após Solo→Instagram→preview, mesmas contagens e hashes agregados de granadas/mídias/Auth; histórico QA8. Oito grupos QA transacionais e quatro negações reais anon/auth passaram, fixtures revertidas. Outro banco novo comprovou rollback das três DDL, mantendo histórico5 e legado. Sem dados reais excluídos nem alterações no laboratório original.
- Foram necessários placeholders NOLOGIN de roles do laboratório e restore --no-owner. Isso NÃO é clone integral de roles/identidades nem E2E Auth/Storage. O admin de serviço/BYPASS foi modelado só na transação QA e revertido. O relatório SQL detalhado sanitizado será anexado; scripts/logs/dados privados permanecem fora do Git.
- Consulta agregada somente leitura na produção confirmou também1granada/4mídias/1Auth/0storageobjects/histórico5. Não inferir disponibilidade dos bytes de vídeos por essas contagens; nenhuma mídia real foi baixada ou alterada nesta tarefa.
- Diff rastreado revisado: somente três migrations NOVAS, sem reescrever históricas; nenhum segredo, dump, MP4, arquivo env real ou artefato privado identificado. Worktrees originais mantidos em seus HEADs e estados iniciais.

**GO para revisão por PR em draft. NO-GO para merge imediato/produção.** Os bloqueios são de publicação coordenada, não testes falhando: aprovação/aplicação das três migrations antes do novo backend, confirmação da janela/backup e smoke tests após deploy. Instagram/prévia ficam off; prévia exige coletor cloud supervisionado e monitor independente antes de ser ativada. Nenhuma autorização para banco real, main ou deploy foi executada por inferência. PR/HEAD finais por checkpoint e refs remotas, para evitar SHA circular.
