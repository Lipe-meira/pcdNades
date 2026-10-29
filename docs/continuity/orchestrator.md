# Checkpoint — orquestrador

Atualizado em: 28/10/2026, America/Sao_Paulo.
Estado: em andamento; frontend demonstrativo publicado, backend ainda sem infraestrutura configurada.

## Objetivo e pedido atual

Coordenar os chats de frontend/backend do pcdNades. Pedido atual: tornar obrigatório o registro de progresso e retomada em toda tarefa, para sobreviver a limites de uso e mudanças de sessão.

## Localização do trabalho

- Worktree principal: `F:\projetos\nadesCs2`, branch `main`.
- Último commit publicado do frontend nesta checagem: `953a2ad`.
- GitHub: https://github.com/Lipe-meira/pcdNades ; `main` criada e confirmada como default.
- Front chat: `01a1853b-6e1e-79b3-8505-70e2d76056fe`, branch `feat/frontend`, worktree `C:\Users\felip\.codex\worktrees\pcdnades-frontend\nadesCs2`.
- Back chat: `01a1853b-dc21-73c1-ac42-d997b4b7c794`, branch `feat/backend`, worktree `C:\Users\felip\.codex\worktrees\pcdnades-backend\nadesCs2`.
- Política de continuidade adicionada nesta tarefa em `AGENTS.md` e `docs/continuity/`; commit/push será conferido na entrega. O identificador deste commit deve ser obtido no Git para evitar autorreferência.

## Feito

- README com escopo/referências; importação desejada é baixar e guardar, sem embed como substituição.
- Frontend React/TS/Vite com demonstração em memória e plantas vetoriais de mapas reais setposgg, licença CC BY 4.0 e atribuição em `frontend/public/maps/`.
- Main recebeu frontend até `953a2ad` por fast-forward. Backend continua em branch separada; não presumir que foi integrado.
- Vercel projeto `pcdnades`, ID `prj_2sGMLNYHQN6M9vxF6gyqspxDv1PD`, team `team_IdIH9Z57lKO3PxfIz8sDJFqN`; root `frontend`, `npm ci`, `npm run build`, saída `dist`.
- Deploy produção `dpl_6kVFXwZv2Gytw2GSpbFuHQRBknZZ` READY, commit `953a2ad`; https://pcdnades.vercel.app respondeu HTTP 200. Publicado em modo DEMO, sem persistência remota.
- Backend reportou API, schema/RLS, worker FFmpeg, uploads assinados e playback. Código/testes locais entregues; execução com Supabase/Storage/FFmpeg real não foi validada.

## Em andamento

- Front conclui testes, fallback SPA/documentação e ajuste do limite para 20s; aguardar commits e relatório antes da próxima integração.
- Backend informou ajuste de duração para teto de 20s com 8 testes passando; confirmar SHA remoto e diff ao revisar.
- Instituir os checkpoints próprios dos dois chats e preservar as mudanças em suas branches.

## Retomar daqui

1. Ler este arquivo, conferir `git status`, branches/remotos e novos commits; não sobrescrever alterações locais.
2. Consultar os checkpoints dos chats nas respectivas branches e obter seus relatórios atuais.
3. Revisar próxima entrega do frontend, validar, integrar e publicar quando adequada. Não confundir o deploy atual com integração completa.
4. Revisar backend e contrato em `backend/README.md` na `feat/backend`; planejar configuração real de Supabase/Storage e hospedagem do worker antes de prometer upload funcional.
5. Alinhar seed de mapas com IDs/URLs/radares canônicos do frontend.

## Decisões e contrato

- Confirmado: React+TS, treino do time, persistência compartilhada, MP4 e intenção de baixar por links Shorts/TikTok, commits/push convencionais PT-BR, main default, deploy Vercel e continuidade obrigatória.
- Usuário definiu teto de vídeo de 20s no chat backend, conforme mensagem do responsável repassada ao orquestrador.
- Stack em execução autorizada no chat backend: TS/Fastify/PostgreSQL/Supabase. Consulta pública e escrita admin seguem padrão provisório, ainda sem confirmação de privacidade.
- API `/api/v1`, listas `{data,pagination}`, detalhe `{data}`, escrita de lineup com `videoId` ready, leitura com `video` aninhado, `target` x/y em [0,1]. Contrato concreto em `backend/README.md` na branch backend.
- Importadores YouTube/TikTok indisponíveis nesta entrega; não prometer download operacional. Upload MP4 ainda exige integração real.

## Validação

- Orquestrador executou `npm ci --ignore-scripts`, `npm run build` (inclui typecheck), `npm test` em frontend no commit `953a2ad`: 9 testes passaram.
- Vercel confirmou READY e página retornou HTTP 200. Não houve auditoria visual completa do deploy pelo orquestrador.
- Backend: verificações reportadas pelo responsável; ainda não executadas independentemente pelo orquestrador.
- Não validado: migrations/RLS reais, upload, processamento real, seek/mobile, persistência entre dispositivos, importação por links.

## Bloqueios e dependências

- Infraestrutura e credenciais Supabase não configuradas; nunca solicitar tokens em texto nem versionar segredos.
- Worker exige ambiente com FFmpeg/ffprobe; frontend Vercel não substitui a hospedagem desse processo.
- Conferir Git integration da Vercel para futuros pushes na main: o deploy inicial foi criado usando SHA explícito pela API.

## Histórico curto

- `790cc30`: README inicial.
- `e889e3b`: upload/importação registrados.
- `056eea8`, `e3b66c0`, `953a2ad`: base frontend, radares licenciados e administração demonstrativa.
- Publicação inicial em https://pcdnades.vercel.app ; demais entregas aguardam integração.
