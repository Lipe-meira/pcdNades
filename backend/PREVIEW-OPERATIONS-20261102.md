# Operação da prévia TikTok — 02/11/2026

## Resultado e escopo

NO-GO para ativar sourcePreview: falta host aprovado, supervisão efetiva, observador externo com destinatário de alerta e validação Auth/Storage. Templates são preparação inativa. Nenhuma infraestrutura remota, flag, credencial, migration, produção ou deploy foi alterado nesta tarefa. Base publicada 7443dc8; oito migrations já aplicadas segundo Gate B do orquestrador, sem reaplicação. TikTok 30s/50MB e upload MP4 90s são o estado reportado pelo Gate B; checkpoints anteriores são históricos.

Branch codex/tiktok-preview-backend-20261102; worktree C:/Users/felip/.codex/worktrees/pcdnades-tiktok-preview-backend-20261102/nadesCs2. Contrato compartilhado e frontend não foram editados.

## Correção e evidência

SIGTERM durante a espera do coletor deixava o arquivo de saúde como healthy. Teste novo falhou antes da correção e passou depois: runner registra stopped também nesse caminho. Commit 472f3c3. Não muda downloader, cadência, TTL ou endpoints.

39 testes passaram em maintenance-runner, source-preview, preview-api, preview-cancellation, import-api, inline e preview-sweep-failures; npm run typecheck passou. Os cinco novos testes de sweep usam adaptadores simulados: falha Storage, falha CAS, lote parcial de 50, cancelamento e conclusão integral. Não constituem integração real Supabase. Nenhum vídeo externo foi baixado. Build nativo não repetido; templates systemd apenas revisados, sem parser Linux ou instalação executados.

## Contrato preservado

POST /api/v1/media/imports/:sourceId/preview com {} e Bearer administrativo proprietário retorna 200 após preparar a prévia. GET renova somente URL, sem download ou extensão da sessão. Resposta data: sourceId, status ready, url, expiresAt, sourceExpiresAt e mimeType video/mp4. Sem 202, embed ou publicação de granada/mídia final. Frontend usa capability sourcePreview; false mantém seleção manual.

Sessão 15 minutos, URL no máximo 60 segundos e margem de assinatura 11 segundos. 401/403, 404 SOURCE_NOT_FOUND para outro proprietário, 410 SOURCE_EXPIRED, 503 PROCESSOR_BUSY/PREVIEW_UNAVAILABLE; incompatibilidade 422 PREVIEW_UNAVAILABLE. Bucket privado import-previews separado de videos-staging. Sweep completo com heartbeat máximo 8 minutos, ciclo 3 minutos; capacidade fecha na ausência/expiração/futuro do heartbeat. Remover objeto antes de liberar registro; leases e backlog impedem heartbeat falso. PG direto ou pooler SESSION para advisory lock, não transaction pooler.

## Agendamento e custo

| Opção | Avaliação |
| --- | --- |
| Vercel Hobby | Cron diário e imprecisão de até 59 minutos não atendem cadence de até 5 minutos. Além disso exigiria endpoint HTTP operacional. |
| GitHub Actions | Agenda pode atrasar ou perder execuções; repositório público pode desativar agenda após 60 dias sem atividade. Não garante limpeza em 5 minutos; nenhum workflow foi criado. |
| Supabase Cron/Edge | Cron suporta intervalo necessário, mas ativar extensões/jobs/Vault é configuração remota pendente. Edge exige novo endpoint autenticado. SQL que apaga metadados Storage não apaga bytes: exige Storage API e desenho de ACK, leases, retries e recuperação. Não substituído às cegas. |
| Host privado já existente | Runner Node e templates systemd reaproveitam core sem nova taxa de serviço se houver host disponível. Energia, rede, disponibilidade e observador externo permanecem dependências reais. Probe no mesmo host não detecta sozinho a queda desse host. |

Fontes oficiais consultadas nesta tarefa: [Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Supabase Cron](https://supabase.com/docs/guides/cron), [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart), [exclusão Storage](https://supabase.com/docs/guides/storage/management/delete-objects), [preços Supabase](https://supabase.com/pricing). Free possui quotas, não armazenamento/egress ilimitados nem garantia operacional gratuita; projetos inativos podem pausar. Não configurar keepalive artificial.

ops/systemd contém runner, health oneshot e timer por minuto. ops/source-preview.env.example contém apenas nomes e valores vazios. Instalação depende de revisão de caminhos, usuário, permissões e host autorizado; arquivo real fora do Git, 0600. Probe detecta tentativa antiga (>240s), sucesso antigo (>480s), degraded e arquivo ausente; saída não zero ainda precisa de entrega externa do alerta.

## Laboratório real e limite da tentativa

Diretório privado novo C:/Users/felip/AppData/Local/pcdnades-preview-ops-20261102-5491784d, com ACL restrita e logs preservados. Projeto CLI novo, portas pretendidas 56721/56722/56731; signup desativado. CLI não conseguiu conectar PG por 127.0.0.1:56722 e encerrou seus containers novos antes de Auth/Storage. Nenhuma sessão, usuário, granada ou objeto foi criado por este ensaio.

Diagnóstico controlado: servidor HTTP novo na rede Docker internal e bind explícito 127.0.0.1:56721 falhou no acesso pelo Windows; cliente novo dentro da mesma rede recebeu HTTP 200 e fixture correta. Isso comprova limitação host→rede desta tentativa, não impossibilidade de E2E interno Linux. Não relaxamos isolamento nem tocamos stacks anteriores.

Inventário retido: redes internas pcdnades-preview-ops-20261102-private e pcdnades-preview-ops-20261102-loopback; containers pcdnades-preview-ops-http-diag-5491784d (parado via docker stop, exit137) e pcdnades-preview-ops-client-diag-5491784d (exit0). Nenhum volume correspondente novo foi observado após CLI stop. Evidência privada preservada; não copiar diretório inteiro ao Git.

Rechecagem sem alterar estado: docker inspect pcdnades-preview-ops-http-diag-5491784d; docker logs pcdnades-preview-ops-client-diag-5491784d; docker network inspect pcdnades-preview-ops-20261102-loopback. Reiniciar fixture ou montar Auth/Storage é trabalho posterior coordenado, não executado neste fechamento.

## Desbloqueio concreto proposto

Primeira ação verificável: ler o bootstrap histórico e inventariar imagens/configurações necessárias, sem executá-lo, separando dependências do bind Windows. Verificar se uma CLI Linux em container na rede interna consegue alcançar um PG NOVO por DNS interno com IDs novos e portas não publicadas. Reaproveitar apenas trechos pequenos revisados; nunca apontar para volumes antigos. O diagnóstico interno HTTP já demonstra conectividade entre containers.

Após CLI stop não há stack nova Auth/Storage operacional. Para E2E faltam PG+migrations, Auth, REST, Storage, gateway e backend/runner; frontend e cliente Playwright podem rodar dentro da rede Linux. Confirmar compatibilidade da CLI/bootstrap com hostname interno antes de criar stack completa. Se exigir Docker socket ou mudanças amplas de bootstrap, apresentar plano limitado ao orquestrador antes de executar. Usar somente credenciais efêmeras novas e fixture sintética. Verificar proprietário, expiração, renovação, download do objeto privado, cancelamento, sweep real e ausência de escrita no bucket final. Sem download TikTok externo sem autorização específica nova.

Mesmo E2E local aprovado não comprova produção operacional. Ativação depende separadamente de host/supervisor/observador aprovados, credenciais por canal privado e verificação no ambiente correspondente. Não aumentar TTL para esconder falta de limpeza.
