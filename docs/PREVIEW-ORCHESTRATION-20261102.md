# Orquestração — prévia visual TikTok

Pedido humano: concluir fluxo operacional de assistir/selecionar/importar trecho TikTok, coordenando os chats existentes; não assumir implementação especializada no orquestrador. Autorizados análise, trabalho local, testes isolados, integração em branch própria e preparação de PR. Não autorizados merge na main, deploy, infra remota/configurações/flags ou escrita em produção.

## Base e preservação

Main de partida `7443dc8ee53f266f90c0568bb4976c95a5034bfb`, publicada após PR3. GateA já deixou8migrations; não reaplicar. TikTok/MP4 ativos no estado conhecido da release, Instagram/prévia/YouTube OFF. Não reabrir backup/provisionamento antigo por checkpoints históricos.

Novas worktrees criadas pelo orquestrador, todas da mesma main, sem trocar branches dos chats antigos:

| Responsável/chat | Branch | Worktree |
|---|---|---|
|backend CS2|codex/tiktok-preview-backend-20261102|C:/Users/felip/.codex/worktrees/pcdnades-tiktok-preview-backend-20261102/nadesCs2|
|frontEnd CS2|codex/tiktok-preview-frontend-20261102|C:/Users/felip/.codex/worktrees/pcdnades-tiktok-preview-frontend-20261102/nadesCs2|
|Orquestrador|codex/tiktok-preview-integration-20261102|C:/Users/felip/.codex/worktrees/pcdnades-tiktok-preview-integration-20261102/nadesCs2|

Worktrees antigos backend28e10b4/frontend63729fa estavam limpos e foram preservados. Releasea29b6cb conserva documentos posteriores locais; não movê-los ou incluí-los em massa. A implementação parcial antiga em pcdnades-preview não será sobreposta/incorporada.

## Delegações efetivamente enviadas

Ferramenta send_message_to_thread confirmou envio aos chats existentes:

- Backend:01a1853b-dc21-73c1-ac42-d997b4b7c794/hostlocal. Responsável exclusivo backend/ e checkpointbackend; workflowsnovos source-preview-* somente como proposta inativa. Diagnosticar gaps reais do coletor/runner/monitor e preparar solução gratuita sem provisioná-la.
- Frontend:01a1853b-6e1e-79b3-8505-70e2d76056fe/hostlocal. Responsável exclusivo frontend/ e checkpointfrontend. Reaproveitar player; UX/expiração/renovação/limites/fallback/responsividade.
- Orquestrador:contrato docs/preview-contract.md, este plano, checkpointorchestrator, revisão de entregas/integração/testes combinados. Não editar arquivos dos agentes em paralelo.

Ambos receberam pedido humano integral por caminho, contexto da release e proibição de usar produção. Commits locais pequenos em português; sem push inicialmente. Relatórios serão lidos no próprio chat e em disco. Não arquivar chats ou criar novos sem pedido.

Diagnóstico inicial frontend recebido: player/POST/GET e seleção já existem; lacunas no tempo atual visível, aviso de prévia não publicada e SOURCE_EXPIRED antecipado pelo servidor. Ajustes pontuais alinhados; nenhuma alteração de contrato requerida. Backend investigando runner e scheduler.

## Contrato compartilhado inicial — preservar

Referência: docs/preview-contract.md, protocolo já existente na main:

- POST/api/v1/media/imports/:sourceId/preview,{},Beareradmin autorizado/proprietário,aguarda preparo limitado e retorna200ready; não202/jobbackground.
- GETmesma rota renova assinatura sem novo download nem estender a sessão.
- Ready:{data:{sourceId,status:"ready",url,expiresAt,sourceExpiresAt,mimeType:"video/mp4"}}.
- URLStorageprivado import-previews<=60s, sessão15min imutável/margem contratada; nuncaCDN/embed.
- Erros401UNAUTHORIZED,403FORBIDDEN,404SOURCE_NOT_FOUND,410SOURCE_EXPIRED,503PROCESSOR_BUSY,503PREVIEW_UNAVAILABLE;422PREVIEW_UNAVAILABLEincompatível.
- Capabilityimporters.tiktok.sourcePreviewboolean. Flagoff/providerinativo/heartbeatstale→false/fallbackmanual, nunca playerfake.
- Trecho finalTikTok<=30s/50MB; MP490s/histórico preservados. Prévia não cria grenade/media final nem publica automaticamente.
- Sweepcompletoalvo5min,heartbeatválido8min; timeout/falha/limpeza parcial não renovam heartbeat. Não aumentarTTLpara esconder atraso. Bucket/finais distintos; CAS/lease/graças/órfãos conforme contrato.

Mudanças de contrato exigem proposta e alinhamento entre chats antes de implementação. O orquestrador mantém o documento compartilhado; frontend/backend propõem em relatórios de suas áreas, evitando edição concorrente.

## Marcos e critérios

1. Diagnóstico separado e confirmações de escopo/branches. Não reimplementar o já validado.
2. Backend identifica scheduler realista nas condições atuais e entrega runner/monitor testáveis localmente. Não presumir continuidade serverless ou garantia de cadência em GitHubActions. Verificar documentação oficial de planos/limites, sem serviço pago ou provisionamento remoto.
3. Frontend conclui gaps e testes controladosPC/mobile, preservando contrato.
4. Backend prepara plano de NOVO laboratório/ports/labels próprios e configuração privada local. Coordenar antes de iniciarE2E: um processoAPI/um coletor/um navegador por vez. Não tocar stacks/evidências/volumes anteriores.
5. Integração realAuth/Storage/player/cleanup em ambiente isolado, incluindoexpiração,renovação,Range,marcação de tempos,importação<=30s,preservação de mídia/cadastro e nenhuma publicação. Identificar explicitamente qual trecho usa fixture e qual foi real; não chamar mocks de E2E completo.
6. Downloads reais somente de mídia autorizada confirmada/coordenada; evitar repetição desnecessária e gravação de tokens/URLsassinadas.
7. Revisar commits/árvores/diff/sigilo. Integrar localmente em branch própria e executar testes/builds necessários de ambos. Se entrega tiver apenas testes/docs, não inventar diff funcional.
8. Preparar PRDraftpara main após revisar integração e segurança de push/previewbranches. Não fazer merge/deploy/ativação. Docs/checkpoints acompanham entrega; não publicar segredos/fixtures privadas.

## Ativação futura — separada

NO-GO para ativarprévia enquanto não houver coletor/scheduler realmente operacional e monitorado, heartbeat comprovado, limpeza segura validada, UX e integração testadas. Código/configuração preparada não prova cron real. Execução manual local não prova scheduler remoto.

Implantar scheduler/configurar credenciais/flags ou executar testes com escrita de produção exige autorização específica. Mesmo serviço gratuito é infraestrutura remota e não será criado automaticamente. Reels e YouTube permanecem OFF; não misturar pinNodefrontend ou outras pendências nesta feature.
