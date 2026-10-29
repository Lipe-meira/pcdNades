# Checkpoint — backend

Atualizado em: 28/10/2026, America/Sao_Paulo.
Estado: aguardando alinhamento de ambiente; implementação inicial entregue, integração real não validada.

## Objetivo e pedido atual

Manter backend pcdNades em TypeScript/Fastify/PostgreSQL/Supabase. Pedido atual: registrar continuidade obrigatória em disco, seguindo AGENTS.md e template lidos em origin/main (d8c643b). Atualizar este checkpoint ao iniciar, concluir marcos, aguardar ou encerrar tarefas futuras.

## Localização do trabalho

- Branch: feat/backend.
- Worktree: C:\Users\felip\.codex\worktrees\pcdnades-backend\nadesCs2.
- Base: e889e3b36604b57bfa6a7412df57eb9b2c93a494, origin/docs/visao-projeto.
- Último commit de implementação: c50a3f2 (teto de 20 segundos).
- Push: c50a3f2 confirmado em origin/feat/backend; checkpoint será enviado em commit docs próprio (obter SHA pelo Git para evitar autorreferência).
- Mudanças sem commit ao escrever: somente docs/continuity/backend.md, criado nesta tarefa; nenhum código pendente localmente.
- Propriedade autorizada: backend/ e este checkpoint. Não alterar frontend, raiz ou checkpoint de outro chat. AGENTS/template lidos via git show origin/main, sem merge ou troca de branch.

## Feito

- Estrutura API em backend/src/app.ts, modelos/validação em model.ts e servidor em server.ts.
- API de mapas e CRUD granadas com filtros e target x/y normalizados [0,1]. Auth via token Supabase e RPC is_admin; leitura pública provisória.
- Migration backend/migrations/001_initial.sql com tabelas mapas, granadas, mídia, administradores privados, constraints e RLS. Não aplicada em serviço real.
- Sessão de upload privado assinado, status administrativo, fila persistida e playback assinado para vídeo ready publicado.
- Worker batch em backend/src/worker.ts: claim SKIP LOCKED/lease, ffprobe/FFmpeg, armazenamento de saída e erro de processamento. Exige scheduler e ambiente próprio.
- Importadores em backend/src/importers.ts são interfaces/adaptadores indisponíveis; POST imports retorna PLATFORM_UNSUPPORTED. Não baixam arquivos e não substituem por embed.
- Configuração única em backend/src/config.ts; capabilities/upload/worker compartilham limites validados. Duração default e teto absoluto: 20s. Tamanho default: 50.000.000 bytes.
- backend/.env.example sem segredos e contrato/execução em backend/README.md.

## Em andamento

- Nenhuma alteração de produto em execução. Registrando checkpoint para retomar com estado real.
- Supabase/Storage e FFmpeg não provisionados/testados. Não declarar upload, processamento ou persistência entre dispositivos operacionais.

## Retomar daqui

1. Ler AGENTS.md, docs/continuity/README.md, checkpoint do orquestrador e este; quando ausentes nesta branch, usar git show origin/main:<caminho>. Executar git status --short --branch e git log -5 --oneline, confirmar remoto sem sobrescrever trabalho.
2. Confirmar próxima tarefa com orquestrador e atualizar este checkpoint antes de editar. Sem provisionamento autorizado atualmente.
3. Obter catálogo de mapas/radares canônicos do frontend (setposgg, CC BY 4.0) e alinhar seed/IDs/caminhos; não semear URLs arbitrárias.
4. Revisar backend antes de integração real: ampliar testes de autenticação/CRUD/worker, recuperação e idempotência; reconciliar órfãos e quotas. Testes atuais são locais, não cobertura integral.
5. Quando ambiente for autorizado/configurado, aplicar migration em Supabase descartável e testar RLS anônimo/usuário/admin, MP4 real, worker FFmpeg, playback/seek/renovação PC/mobile e persistência em dois clientes.

## Decisões e contrato

- Confirmado: stack TS/Fastify/Postgres/Supabase; MP4 armazenado; duração máxima 20 segundos definida pelo usuário; apenas branches próprias com commits convencionais PT-BR.
- Provisório: leitura pública e escrita administrativa; privacidade ainda depende de confirmação.
- Contrato v1 alinhado com orquestrador: /api/v1; {data}, listas com pagination; escrita videoId ready, leitura video aninhado; mapas com radar imageUrl,width,height,coordinateVersion.
- Playback {data:{url,expiresAt,mimeType}}; URLs assinadas não são referências permanentes. Arquivos nunca no Git.
- Importação Shorts/TikTok desejada, mas não validada nem funcional; depende de método permitido e evidência no host.
- MEDIA_MAX_BYTES e MEDIA_MAX_DURATION_SECONDS devem coincidir em API/worker; env não altera limite do bucket/plano Supabase. Duração acima de 20 impede startup.

## Validação

- No c50a3f2: npm --prefix backend run typecheck, npm --prefix backend test (8 testes), npm --prefix backend run build, git diff --check: passaram.
- Testes verificam configuração/defaults/env inválida/teto 20, capabilities, coordenadas/campos inválidos e falha fechada sem credenciais. Não demonstram CRUD/RLS reais.
- Nesta tarefa docs: Git/fetch/status e leitura de instruções; verificar diff antes do commit. Nenhum teste de código repetido pois só checkpoint mudou.
- Não executado: migrations/RLS e mídia reais, integração frontend/backend, FFmpeg, recuperação, quotas, seek/mobile.

## Bloqueios e dependências

- Sem credenciais/ambiente Supabase; não solicitar tokens em texto nem versionar .env.
- Worker requer FFmpeg/ffprobe e hospedagem/scheduler; frontend Vercel não hospeda esse processo.
- Bucket inicial 50MB precisa alinhamento operacional se limite de tamanho mudar.
- Falhas conhecidas/limites da primeira versão: limpeza/reconciliação de órfãos ainda pendente; testes de concorrência/lease e idempotência insuficientes; jobs com tentativas esgotadas precisam revisão; API ainda precisa testes de autorização/CRUD reais e catálogo seed.
- Nenhum deploy backend ou PR criado por este chat. Deploy demo frontend é responsabilidade do orquestrador; não comprova integração.

## Entrega e histórico curto

- 25b5741: estrutura e migration com autorização.
- 7500079: API e pipeline inicial de mídia.
- 8904118 e f5e26f6: adaptadores/CORS/testes e formatação.
- 68d01d4: limites únicos configuráveis/validados.
- c50a3f2: teto de vídeo 20s, 8 testes locais passaram; push confirmado.
- 28/10/2026: checkpoint criado seguindo regra de continuidade de origin/main; somente docs/continuity/backend.md alterado nesta tarefa.
