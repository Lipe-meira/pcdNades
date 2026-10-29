# Checkpoint — orquestrador

Atualizado em: 29/10/2026, America/Sao_Paulo.
Estado: em andamento; frontend demonstrativo publicado, backend ainda sem infraestrutura configurada.

## Checkpoint da retomada de 29/10 (estado mais recente)

- Usuário autorizou projeto Supabase dedicado em Lipe-meira's Org, São Paulo. Criado `kdyzxxgzvgiffluyjjxu` ACTIVE_HEALTHY; URL oficial https://kdyzxxgzvgiffluyjjxu.supabase.co .
- Main integrou front `3c220c3` (merge `0dd5051`), backend `258b4ae` e revisão SQL `b8ce041` (merge `af81b4f`). README atualizado em `c0fe3cc`. Algumas integrações posteriores a c0fe3cc aguardam push junto deste checkpoint.
- Orquestrador confirmou build/typecheck front, 10 testes unitários e 12 testes Playwright. Backend build e 10 testes passaram. Não confundir com mídia real.
- Migrations `initial_schema` (001 revisada b8ce041) e `canonical_maps` (002) aplicadas no projeto dedicado. **Não reescrever/reaplicar 001**; correções futuras precisam novas migrations coordenadas.
- Teste real `docs/verification/database-smoke.sql` passou com papéis anon/viewer/admin e fluxo de estados, usando transação com rollback de todos os usuários/fixtures. Verificação posterior: 3 mapas e zero grenadas, mídias e administradores. Primeiro teste foi ajustado porque trigger nega INSERT viewer antes da política RLS, com erro específico esperado.
- Advisors de segurança: somente INFO RLS sem política em private.administrators, intencional para negar acesso direto. Não há permissão de leitura cliente nessa tabela.
- Deploy front revisado `dpl_9FPJDnA2s3ZWSDUv9usgfjG2SbZ6`, commit c0fe3cc, READY em https://pcdnades.vercel.app . Continua DEMO. Outro deploy de docs 17ae50b foi iniciado antes do push da integração; foi sucedido pelo deploy correto c0fe3cc.
- API Vercel projeto separado `pcdnades-api`, ID `prj_XN83T2MeneH8LokYpKbn6iRa93C4`, root backend, framework fastify, node24. Ainda sem deploy. Env produção/preview configuradas: URL e chave PUBLICÁVEL Supabase, FRONTEND_URL, CORS e teto20s. Nenhuma chave privada obtida/configurada.
- Backend prepara entrada Fastify compatível Vercel e disponibilidade separada de leitura pública sem service key. Front implementa adaptador API/auth/mídia e deve confirmar nomes env. Não ativar modo API no site antes de API responder.
- Usuário recebeu pergunta assíncrona sobre e-mail da conta administrativa; resposta pendente. Chave servidor e DATABASE_URL exigem configuração segura pelo responsável no host, não pelo chat.
- Próxima ação: consultar entregas dos dois chats/checkpoints, revisar e testar, integrar e publicar API de leitura; depois integrar frontend real. Mídia continua dependente de service key/worker FFmpeg/configuração de conta. A hospedagem do worker permanece pendente.

Os registros abaixo preservam o contexto anterior; em caso de divergência de estado, prevalece este checkpoint e a conferência do Git/serviços.

## Objetivo e pedido atual

Coordenar os chats de frontend/backend do pcdNades. Pedido atual: continuar após interrupção por créditos. Checkpoints lidos, Git limpo na retomada e responsáveis acionados para continuação.

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

- Retomada 29/10: main em `d8c643b`; remoto frontend em `f124ac6`, porém branch local contém `3c220c3` com revisão/testes/SPA/20s ainda sem push no momento da inspeção. Solicitei ao front concluir/push e atualizar checkpoint antes da integração.
- Próximo incremento atribuído ao front: adaptador HTTP, auth Supabase e fluxo remoto de mídia configuráveis, mantendo demo explícita. Sem provisionamento ou alegação de E2E real.
- Backend remoto em `00c97cb`, código `c50a3f2`; solicitado seed canônico e revisão concreta de idempotência/lease/estados/transferência/saída do pipeline. Divergência de tipo `coordinateVersion` identificada para resolver em contrato.
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
