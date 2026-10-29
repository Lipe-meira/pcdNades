# Checkpoint — frontend

Atualizado em: 29/10/2026 13:15, America/Sao_Paulo
Estado: incremento de validação inline concluído e testado controladamente; envio para revisão do orquestrador

## Objetivo e pedido atual

Adaptar frontend ao MVP sem novo host de worker: backend valida MP4 original inline com ffprobe, sem transcodificar. Frontend deve exibir formatos via capabilities, dar150s somente ao complete, manter30s nos outros endpoints, preservar retomada sem reupload e orientar erros. Não publicar, habilitar upload, criar serviços/segredos/workflows nem alterar backend/main.

## Localização do trabalho

- Worktree: C:/Users/felip/.codex/worktrees/pcdnades-frontend/nadesCs2; branch feat/frontend.
- Base desta tarefa: e65ea71, remoto já enviado. Código anterior API: fa80ccf e28085f8; checkpoints018af5a/5104c55/e65ea71.
- Este incremento será commitado com o checkpoint e enviado na operação de fechamento; obter SHA pelo Git e conferir origin/feat/frontend antes da entrega.
- Arquivos deste incremento: frontend/src/services/{apiClient,apiContracts,apiService}.ts, frontend/src/components/Dialog.tsx, frontend/src/features/admin/{LineupForm,MediaInput}.tsx, frontend/tests/{api,pipeline}.test.ts, frontend/tests/browser/api.spec.ts, frontend/README.md, frontend/docs/verification.md e este arquivo. Nenhuma mudança parcial fora desses arquivos; depois do commit/push conferir status limpo.
- AGENTS e checkpoint do orquestrador da main remota foram relidos. Nenhum merge/troca de branch ou alteração em checkout alheio.

## Feito

- RequestOptions.timeoutMs implementado com default30000. Apenas POST /media/:id/complete passa150000; demais métodos mantêm30s. REQUEST_TIMEOUT e cancelamento permanecem preservados.
- capabilities.upload.processingMode opcional aceita inline-original|worker-transcode; ausência não presume modo. UI inline orienta MP4 original, vídeo H.264/yuv420p, áudio AAC ou sem áudio, sem conversão automática. Limites seguem servidor/teto20s.
- Após bytes enviados, progresso LOCAL confirming informa Confirmando envio sem fingir status do servidor e retém mediaId. Timeout/perda da confirmação permite novo Salvar consultar mídia e repetir apenas complete no mesmoID se awaiting_upload; queued/processing acompanha; ready publica; failed orienta nova escolha.409 reconcilia por GET, sem reupload automático.
- Erros UNSUPPORTED_CODEC,INVALID_MEDIA,DURATION_EXCEEDED,FILE_TOO_LARGE,PROCESSING_TIMEOUT têm mensagens locais compreensíveis e seguras. Stack/caminhos do servidor não aparecem. Validação falha preserva cadastro anterior; nova seleção reinicia sessão.
- Corrigido cancel propagado pelo seletor de arquivo que fechava Dialog ao reselecionar mesmo arquivo. Agora somente cancel do próprio diálogo fecha a janela; Escape antigo continua testado.
- Testes:30unitários/serviço e26browser verdes, build/typecheck verdes, audit zero, diff check sem erros. Nenhuma validação ffprobe/Storage/Vercel real nesta tarefa.

## Em andamento

- Commit/push deste incremento e comunicação ao orquestrador. Implementação e QA controlado encerrados; sem novos recursos em andamento.

## Retomar daqui

1. Ler AGENTS/guia/checkpoints; conferir Git/branch/log/remotos e este arquivo. Usar npm na pasta frontend/ ou --prefix frontend.
2. Conferir SHA/push deste incremento em feat/frontend e status limpo; informar ao orquestrador. Não assumir que ele integrou/publicou.
3. Aguardar revisão e backend com contrato inline implementado. Não habilitar flag de upload ou publicar por este chat.
4. Com ambiente e autorização coordenados, validar MP4 real compatível/incompatível,20s/50MB,timeout/retomada,publicação/playback/consulta em outro dispositivo. Separar esses resultados dos controlados. Importadores permanecem desabilitados.

## Decisões e contrato

- processingMode é opcional e está dentro de capabilities.upload: inline-original|worker-transcode. NÃO validationMode.
- Inline usa original MP4 H.264/yuv420p com áudio AAC ou sem áudio. Sem conversão automática. Max20s/tamanho por capabilities.
- Complete200 contém media ready/failed;202 indica operação em curso. Backend claim muda awaiting_upload→queued→processing com lease antes de validar; prazo servidor120s, cliente150s apenas para complete.
- ID retido depois de upload bem-sucedido e localconfirming. Awaiting_upload nessa retomada pode repetir complete idempotente;409 consulta GET para reconciliação. UPLOAD_FAILED/UPLOAD_INCOMPLETE reais limpam vínculo e permitem nova sessão. Failed terminal e troca de arquivo também limpam.
- Demais contratos permanecem /api/v1,data/pagination,Bearer Supabase,videoIdready para publicar,playback só publicado com URL renovável. Sem fallback API→demo ou embed.
- Runtime VITE_DATA_MODE demo|api; VITE_API_URL incluindo/api/v1,VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY sb_publishable_. Nenhuma credencial real/.env neste worktree.
- Catálogo mirage/inferno/ancient,/maps/{id}.svg,1024×1024,coordinateVersion setpos-{id}-ba5f793; artworkCCBY4.0 com atribuição e snapshot documentados.

## Validação

- Executado nesta tarefa: npm test30/30; npm run build(inclui typecheck); npm run test:browser26/26; npm auditzero; git diff --check sem erros.
- Testes configuram sinais de prazo em vez de esperar150s; verificam150s somente complete e30s nos demais. Timeout de complete é simulado com AbortSignal expirado, depois GETawaiting/retrycomplete sem reupload.409 concorrente reconciliado por GETready também coberto.
- Browser PC/celular: perda de confirmação→mesma sessão/sem bytes extras; codec inválido→orientação sem stack; seleção de arquivo reexportado→segunda sessão; cancel de filepicker não fecha formulário. Suites anteriores demo/API/auth/permissões/renovação continuam verdes.
- Falhas observadas antes dos fixes: prazo permanecia30s; cinco códigos eram genéricos; confirming/resume ausente; cancel do filepicker fechava form. Corrigidas e cobertas por regressões.
- Não executado: qualquer login/mutação/upload remoto ou ffprobe/Vercel real. Não chamar resultados controlados de E2E real.

## Bloqueios e dependências

- Nenhum bloqueio de frontend para revisão. Backend inline e eventual flag MEDIA_UPLOAD_ENABLED=false até QA são responsabilidade dele/orquestrador.
- Usuário escolheu GitHub gratuito, mas orquestrador corrigiu a proposta: Actions não será host produtivo. Nenhum workflow criado por este chat. Worker Docker fica futuro.
- Conta administrativa e execução real dependem da coordenação; não solicitar senha em texto ou inserir segredos.

## Entrega e histórico curto

- Primeira prévia:056eea8,e3b66c0,953a2ad,3c220c3. API:fa80ccf,28085f8; checkpoints018af5a,5104c55,e65ea71.
- Produção anterior atribuída ao orquestrador: https://pcdnades.vercel.app modoAPI commit1b2416c, consulta dos3mapas/vazio/login vistos por IAB; APIe6731f5 comuploadfalse. Não revalidada nesta tarefa.
-29/10: contrato inline/timeout/retomada alinhado explicitamente,30unit+26browser passaram. Incremento e este checkpoint aguardam commit/push de fechamento.
