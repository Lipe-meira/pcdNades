# Verificação da primeira prévia

28/10/2026, America/Sao_Paulo. Trabalho exclusivo em frontend/, worktree gerenciado pcdnades-frontend, branch feat/frontend. Base e889e3b.

- Verificação visual primária feita no navegador integrado: biblioteca, detalhes, planta de Mirage e indicação de demo. Playwright complementa com testes repetíveis de interação e responsividade.
- 12 fluxos Chromium: seis cenários repetidos em 1440×1000 e 390×844, incluindo filtros, vazio, agrupamento de destinos, diálogo/foco, importação indisponível, MP4 sintético, play/pause/seek, edição e exclusão.
- Verificação de overflow adicional em 320, 390, 768 e 1440px. Corrigido grupo de filtros que excedia a largura em 320px.
- Foco restaurado ao fechar formulário por Escape; alternativa pelo teclado para coordenadas; seleção do radar comparada com retângulo da imagem, com tolerância de um pixel para arredondamento de clique do navegador.
- Os testes de domínio/serviço cobrem normalização, filtros combinados, URLs inválidas, arquivo inválido, duração de 20s inclusiva, CRUD isolado por instância e preservação do vídeo após importação não suportada.
- O primeiro run de testes falhou antes da criação das funções de domínio/validação. Nos testes de navegador, falhas adicionais revelaram overflow de 4px e nome acessível do seletor; ambos corrigidos. A exigência do teste de clique foi ajustada para tolerância subpixel sem mudar a normalização.

## Comparação visual

Conceito inicial gerado com Image Gen (prévia, não asset de produto): C:/Users/felip/.codex/generated_images/01a1853b-6e1e-79b3-8505-70e2d76056fe/exec-520ae976-e20e-4a10-a1dd-ead7e9b9ca66.png.

Foram preservados: tema grafite/sálvia, radar como foco, filtros por tipo/lado, hierarquia de título/mapa, lista lateral com seleção e detalhes de arquivo. Desvios deliberados: desenho de mapa do conceito rejeitado pelo usuário foi substituído por plantas licenciadas; busca e tema claro inventados pelo conceito não foram implementados; avisos de demo são permanentes; nome e orientações de cada exemplo continuam fictícios; no celular a lista e os detalhes ficam abaixo do radar.

Não há alegação de correspondência perfeita ao conceito rejeitado nem de integração com serviços remotos. O refinamento visual foi revisado no browser, incluindo cinco aspectos: proporções radar/lista, tipografia e espaçamento, cores/contraste, hierarquia dos filtros e estado selecionado. Licença e versão dos mapas ficam visíveis. O texto acima da dobra foi ajustado para refletir o modo demonstração e a substituição do placeholder.

## Pendências

API real, autenticação/permissões, capabilities, transferência e processamento, URLs assinadas renováveis, seed de mapas com o backend, testes entre dispositivos reais e Safari/iOS. Não foram criados serviços ou segredos. A importação por link não é operacional.

## 29/10 — Integração opcional API/Auth/Mídia

- Modos demo/API separados por VITE_DATA_MODE. API incompleta, vazia ou indisponível não é substituída por fixtures.
- Executado: 20 testes unitários/contrato/pipeline; build/typecheck; 22 fluxos Chromium (12 demo + 10 API com respostas controladas), desktop/mobile. npm audit: zero vulnerabilidades. git diff --check: sem erros.
- Cenários API controlados: login/logout Supabase, capabilities desabilitando upload/importadores, consulta vazia/503/retry, escrita com Bearer, falha/reenvio de upload com nova sessão, pausa/retomada do job sem novo upload, publicação após ready, reload de dados remotos controlados, 403 sem apagar conteúdo e renovação de URL mantendo posição.
- Bug encontrado pelo navegador e corrigido: fetch nativo guardado como método de ApiClient recebia this incorreto e falhava antes de iniciar a rede. Default agora usa wrapper de chamada global. O cenário API vazio/retry falhou antes da correção e passou depois.
- Retomada de mídia guarda IDs apenas para queued/processing/ready. UPLOAD_FAILED, UPLOAD_INCOMPLETE, awaiting_upload e troca de mídia limpam o vínculo. QA verificou nova sessão após upload falhar e retomada sem reupload quando já processando.
- O mock inicial de MP4 ignorava Range e não permitia seek. A fixture passou a ser servida pelo HTTP local do Vite, com suporte a Range. O teste de renovação usa contador de base para não confundir as duas montagens de StrictMode com renovação real, aguarda a nova solicitação agendada e verifica posição depois da troca de URL.
- Screenshots API desktop/formulário e mobile/login revisados com view_image. Foram gerados por respostas controladas de Auth/API, sem credenciais reais.
- Consulta HTTP real, somente leitura, feita em https://pcdnades-api.vercel.app: /health, /api/v1/maps, /api/v1/grenades?limit=100&offset=0 e /api/v1/media/capabilities retornaram200. CORS retornou https://pcdnades.vercel.app para essa Origin. Três mapas canônicos, biblioteca vazia, upload anunciado disponível,20s e importadoresfalse. Isso não valida login/upload/worker reais nem o frontend publicado.
- Pendências reais: conta admin autorizada, upload/Storage/worker hospedado, processamento e reprodução assinada/renovação entre dispositivos e Safari/iOS. Publicação e ativação VITE_DATA_MODE=api pertencem ao orquestrador.

## 29/10 — Validação inline do MP4 original

- Contrato alinhado com orquestrador: capabilities.upload.processingMode opcional inline-original|worker-transcode. Ausência não presume modo. Inline exibe MP4 H.264/yuv420p e AAC ou sem áudio, limites de capabilities (teto20s), sem conversão automática.
- ApiClient aceita timeout por requisição e preserva REQUEST_TIMEOUT. Default30s permanece; somente POST /media/:id/complete usa150s, tanto no primeiro envio quanto na retomada. Testes conferem os prazos efetivamente usados sem esperar150s.
- Depois de enviar bytes, progresso local confirming retém mediaId e informa espera de confirmação. Em timeout/perda de conexão, novo Salvar consulta GET media; awaiting_upload repete apenas complete no mesmo ID; queued/processing acompanha; ready publica; failed orienta nova escolha.409 reconcilia por GET. Nenhum reupload automático de arquivo já enviado.
- Mensagens locais seguras para UNSUPPORTED_CODEC,INVALID_MEDIA,DURATION_EXCEEDED,FILE_TOO_LARGE e PROCESSING_TIMEOUT; stack/caminho do servidor não é mostrado. Falha de validação preserva registro anterior e troca de arquivo reinicia sessão.
- Bug exposto pela regressão: o evento cancel do seletor de arquivo propagava até Dialog e fechava o formulário ao selecionar o mesmo arquivo. Dialog agora trata apenas cancel disparado pelo próprio diálogo; Escape continua coberto pela suite anterior. O teste escolhe arquivo reexportado e comprova segunda sessão após erro de codec.
- Resultado: npm test30/30; npm run build/typecheck; npm run test:browser26/26 (demo e API controlada em PC/celular); npm auditzero; git diff --check sem erros.
- As regressões de prazo, erros e retomada falharam antes da implementação; cenários browser inline de perda da confirmação e erro/novo arquivo passaram após correções. Testes são controlados e não validam ffprobe/Vercel/Storage reais.
- Sem publicação, segredos, workflow ou alteração de backend. Flag upload continua dependente da liberação e QA remoto coordenados pelo orquestrador.
