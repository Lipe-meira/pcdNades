## Entrega final — painel de filtros e carrossel juntos (30/10/2026)

- Painel concluído e testado sobre4d9a87b na feat/frontend; commit desta entrega feat(frontend): organiza filtros em painel com contagens. Worktree C:/Users/felip/.codex/worktrees/pcdnades-frontend/nadesCs2. Push apenas branch própria após checks; root coordena integração completa com carrossel antes mainpush.
- LibraryFilters apresenta Todas/Smoke/Molotov/Flashbang: ícone existente+nome+contagem à direita, aria-pressed e fundo selecionado; segmentoAmbos/CT/T. aria-label mantém nome simples e aria-describedby anuncia número de granadas. Nada deHE,combinações,favoritos,recomendados ou assets externos.
- Contagem usa filterLineups com mapa+lado e typeall; selecionar tipo não apaga outras contagens. Zero é visível e clicável; seleção continua válida com0 e mostra vazio. Painel só renderiza após dadoscarregados; loading/error/semmapas não exibem contagensfalsas.
- Desktop: painel190px/radar/lista;tablet901..1199 lista abaixo do radar;mobile tipos2colunas+ladohorizontal,altura~228..232px. Referência https://csnades.gg/nuke consultada e screenshot0809692b inspecionado,adaptados às fontes/paleta/ícones pcdNades. Sem cópia de assets.
- Validação FINAL: npm --prefix frontend run build(typecheck)PASS; npm --prefix frontend test39/39PASS; npm --prefix frontend run test:browser38/38PASS(34,2s). Inclui regressões carrossel/API/demo/CRUD/admin/upload/clip e novoscontagensmapa+lado+tipo/zeros/Space/Enter,loading/error/semmapas. git diff --check final antes commit. Nenhum teste remoto ou deploy.
- Render real inspecionado1440/1024/390/320,sem overflowglobal. SetePNG originais main lidos em memória via gitshow/interceptação local; dados demonstrativos existentes servidos comoAPIcontrolada para contagens4/2/1/1 eCT2/1/1/0. Não são conteúdo real nem E2E produção.
- Capturas foraGit: C:/Users/felip/.codex/visualizations/2026/10/29/01a1853b-6e1e-79b3-8505-70e2d76056fe/filters-real-1440.png,filters-real-1024.png,filters-real-390.png,filters-real-320.png,filters-real-ct-390.png. Carrossel e painel aparecem juntos com7radares atuais.
- Arquivos: novo frontend/src/features/library/LibraryFilters.tsx; Library.tsx,styles.css,tests/browser/{flows,api}.spec.ts,docs/map-carousel.md; estecheckpoint. Sem mudar catálogo/radares/backend/env/deps/raiz. Admin select e form intactos. Root mantém correçãoSVG→PNG daexpectativaAncient na main.
- Próximaação: commit/push sófeat/frontend,confirmarremoto/árvorelimpa,enviarSHA+capturas ao root. Root integra/testaENTREGACOMPLETA antesmainpush. Semmelhoriasextras/deploymanual/preview; políticas anteriores vigentes. Registros abaixo históricos.
## Em andamento — painel de tipos e lado (30/10/2026)

- Novo steering antes pushmain: painel inspirado CSNADES Nuke, screenshot0809692b inspecionado e página consultada. Direção explícita sem nova aprovação. Base4d9a87b,branchfeat/frontend limpa ao iniciar; carrossel integrado root7ee23e3 ainda semmainpush.
- Implementar LibraryFilters: Todas/Smoke/Molotov/Flashbang com ícone+nome+contagem e selecionado; segmentoAmbos/CT/T. Contagem deriva mapa+lado, ignora tipo para preservar comparação entre alternativas;0visível. Nada deHE/favoritos/recomendados,sem backend/assetsnovos. Library renderiza após dadoscarregados; loading/error não mostram contagem0falsa.
- Em andamento: componente e layout lateraldesktop/compactomobile; próximos testes contagensmapa/lado/tipo/zero,teclado,loading/error,regressão34browser+39unit/build,screenshots com7PNGmain via leitura/interceptação,checkpoint/commitseparado/pushbranch. PreservarcatálogoSVGbranch ePNGmain,admin/recorte/carrossel.
- Política segue main apenas pendênciainteiraFINALIZADA/TESTADA pelo root,semdeploymanual/preview. Novo painel será agrupado comcarrossel antes publicação. Não alterar backend/raiz/env.
## Entrega final — carrossel de mapas (30/10/2026)

- Implementação concluída na feat/frontend, base a2db01a, worktree C:/Users/felip/.codex/worktrees/pcdnades-frontend/nadesCs2. Entrega funcional eef2b02 enviada para origin/feat/frontend; checks concluídos.
- MapCarousel deriva lista de maps/API, sem IDs/quantidade fixos, thumb radarUrl48x32 inteiras e fallback iniciais, botão48px, aria-current, foco visível. Tab/Enter/Espaço nativos; setas/Home/End movem foco sem ativar. Rolagem nativa/manual com overscrollcontain, sem autoplay/animação. Reveal scrollBy somente horizontal da faixa; ResizeObserver mantém selecionado visível ao redimensionar. Admin select e lógica CRUD/recorte/filtros preservados.
- Arquivos: frontend/src/components/MapCarousel.tsx,features/library/Library.tsx,styles.css,tests/browser/{api,flows}.spec.ts,docs/map-carousel.md; este checkpoint. Sem novas dependências/assets/fontes/env/backend/raiz. Radares/demoData intocados.
- Verificações: build/typecheck e39unitários verdes;34/34 browser PC/mobile verdes no fullrun final, incluindo resize320. git diff --check limpo. Novos casos demo teclado/filtros/limpeza de detalhes e API7 dinâmicos/fallback/seleção/scrolllocal/resize320. Primeira tentativa API falhou por acento corrompido na asserção gerada; corrigido; não era defeito da UI.
- Render real inspecionado desktop1440/mobile390/320 com7PNG originais de origin/main lidos por git show em memória e servidos via interceptação local. Nenhum arquivo de catálogo/assets foi copiado/editado no ramo. Todos7 carregaram1024 e nenhum overflowglobal. Screenshots: C:/Users/felip/.codex/visualizations/2026/10/29/01a1853b-6e1e-79b3-8505-70e2d76056fe/carousel-real-1440.png,carousel-real-390.png,carousel-real-320.png,carousel-real-selected-320.png. API controlada vazia e assets reais; não E2E produção. Script inicial de captura omitiu capabilities e precisou correção; capturas finais carregaram corretamente.
- Referência multiAPP commit20df99f6232ab66012f18b3f5c4d850f02d6a24b repassada pelo root e screenshot original inspecionado. Design compacto descrito em frontend/docs/map-carousel.md; sem assets externos.
- Integração PENDENTE/root: branch3SVG mantida, main7PNG3b06bbc/a8aa9ee preservada. flows altera somente seleção via nav/button + teste novo; manter correção mainb554c2c /maps/valve/ancient.png ao integrar (nesta branch expectativaSVG legada inalterada).
- Política vigente: main recebe apenas pendência finalizada/testada, sem pushes isolados de checkpoint; branches próprias podem commit/push. Previews Vercel desativados segundo root, nenhum preview/manual/deploy nesta tarefa. Produção45d0693 informada pelo root30/10; não validada aqui. Sem E2E remoto novo.
- Próxima ação: enviar SHA/capturas/checkpoint ao orquestrador; root integra/testa7PNG. HEAD remoto confirmado e árvore limpa após push funcional; checkpoint final em commit de documentação separado. Sem melhorias extras. Registros abaixo históricos.
## Tarefa atual — faixa de mapas (30/10/2026)

- Base a2db01a, branch feat/frontend, worktree exclusivo; Git limpo ao iniciar. Implementar faixa horizontal compacta inspirada no multiAPP, substituindo somente seletor da biblioteca. Fonte: maps API/demo, miniaturas dos próprios radares, sem catálogo hardcoded ou novos assets.
- Direção recebida já concreta/autorizada: 48px, miniatura+nome, selecionado areia/azul, foco e teclado, swipe manual, selecionado visível; sem autoplay. Admin/CRUD/recorte/filtros preservados.
- Em andamento: MapCarousel + ligação Library; próximos passos testes API7mapas/demo/teclado/fallback, build/unit/browser e screenshots desktop/mobile; commit/push apenas feat/frontend quando finalizado/testado.
- Política: main apenas integração completa/testada pelo orquestrador; checkpoints na branch própria. Previews automáticos desativados nos dois projetos segundo root; nenhum preview/manual/deploy nesta tarefa. Produção45d0693 informada pelo root30/10, não verificada aqui.
- Main contém7PNG3b06bbc/a8aa9ee, branch ainda3SVG; não editar catálogo/radares nem fazer merge. Testes controlados cobrirão lista7 dinâmica; root preserva PNG ao integrar. Importers3disabled/90s permanecem.

## Marco mais recente — identidade visual pronta para integração (29/10/2026)

- Core recorte90 entregue e enviado em ddda8de (origin/feat/frontend). Identidade visual em commit separado nesta entrega; consultar git log para SHA.
- Implementado: emote original inteiro no cabeçalho, wordmark, favicon pN simples, Barlow Condensed Bold em títulos e Barlow em texto, grafite/azul/areia, superfícies mais diretas, navegação mobile em segunda linha.
- Original copiado para frontend/public/brand/pcd-sas-emote.png: 1.881.198 bytes; SHA256 5AD234022C9FA73CBD568D59444387EAAF307EF4098D32B1B2E6DECA9AF1FE39, idêntico ao anexo. Sem edição ou geração. ATTRIBUTION.md registra origem/autorização.
- Fontes locais: Barlow regular82.624B, semibold85.876B, Condensed bold87.120B (total255.620B), OFL1.1 e fontes das URLs em public/fonts/ATTRIBUTION.md; nenhum runtime GoogleFonts.
- Verificações finais: build/typecheck verdes;39 testes unitários/controlados verdes;30/30 Playwright PC/mobile verdes;git diff --check limpo. Primeira revisão encontrou resíduo sintático CSS e overflow de cabeçalho, ambos corrigidos antes do fullrun final.
- Revisão render real: logo carregado(naturalWidth1254), fontes carregadas;320/390/768/1024/1440 sem overflow. Screenshots desktop/mobile e formulário/recorte inspecionados. Foco visível, labels, teclado e restauração de foco preservados/testados; contraste principal texto claro em grafite, botões areia com texto escuro. Não equivale a auditoria WCAG completa.
- Screenshots fora do Git: C:/Users/felip/.codex/visualizations/2026/10/29/01a1853b-6e1e-79b3-8505-70e2d76056fe/identity-1440.png,identity-390.png,identity-320.png,identity-clip-desktop.png,identity-clip-mobile.png. Biblioteca usa demonstração local; recorte usa API controlada/sintético, não prova produção.
- Catálogo/demoData e assets maps intocados; sete PNG do usuário devem ser preservados pelo integrador. Não alterado flows.spec.ts: root ajustará expectativa ancient.svg para ancient.png na main após integrar.
- Orquestrador informa core integrado main3120565,migration003 aplicada e env90/trimmingtrue preparados. Deploy API bloqueado por cota Vercel402 diária, sem upgrade. Nenhum deploy próprio ou validação remota de recorte nesta entrega. Importers continuam dependentes das capabilities.
- Próximo passo: revisar git status/diff,commit visual+checkpoint,push apenas feat/frontend,informar SHA ao orquestrador para integração. Não fazer melhorias extras nem editar backend/main/radares. Registros abaixo anteriores a este marco são históricos.
# Checkpoint — frontend

Atualizado em: 29/10/2026 18:10, America/Sao_Paulo
Estado: core recorte90 concluído/controlado; próxima etapa autorizada é identidade visual com emote original

## Objetivo e pedido atual

Dois objetivos vigentes: (1) seletor início/fim com prévia MP4 local, saída<=90s,contrato clip/capabilities e semrecorte preservado; (2) emote original como logo e estética de timeCS com tipografia condensada, grafite/azul/areia,menos painéis genéricos. Não abandonar recorte ao trabalhar estética. Sem backend/main/deploy/env/migrations remotas.

## Localização do trabalho

- Worktree C:/Users/felip/.codex/worktrees/pcdnades-frontend/nadesCs2; branch feat/frontend; base desta retomada7e0490b, último código anteriora3033c8.
- Core atual será commitado/enviado com este checkpoint; conferir SHA/local/remoto depois do push. Sem identidade visual nova no core ainda.
- Arquivos core: src/domain/{clip,videoSource,types,validation}.ts; src/features/admin/{ClipSelector,LocalVideoPreview,MediaInput,LineupForm}.tsx; src/services/{apiClient,apiContracts,apiService,lineupService}.ts; src/styles.css; tests/{clip,mediaClip,admin,api}.test.ts; tests/browser/{api,flows}.spec.ts; tests/fixtures/source-91s.mp4; README e docs/verification.md (todos em frontend/),mais estecheckpoint.
- Main do usuário tem7PNG em3b06bbc/a8aa9ee. Não alterei frontend/public/maps nem src/services/demoData.ts; diff desses caminhos vazio. Não fazer merge/trocar branch para copiar catálogo.

## Feito

- Contrato90 final recebido do orquestrador e implementado. Saída90s/50MB; semclip origem<=90s; comclip origem<=180s/50MB; intervalo0,1..90s,0<=início<fim<=duração,precisão0,001(até3decimais).
- Capabilities.trimming opcional com enabled/reasonCode,maxSourceDurationSeconds,maxSourceBytes,maxDurationSeconds,minDurationSeconds,timePrecisionSeconds. Ausência/disabled não habilita recorte. Limites antigos menores continuam respeitados.
- Prévia real delimitada no original local (sem gerar/cortar arquivo no browser), início/fim em números/sliders e botão Reproduzir trecho. Impede intervalos inválidos. Vídeo inteiro sem seleção continua disponível.
- Clip só entra na sessão uploads/imports habilitados; complete apenas ID. Retomada exige MediaRecord.clip equivalente ao solicitado; mudança de arquivo/trecho limpa ID para impedir publicação de seleção antiga.
- YouTube/TikTok/Instagram reconhecidos por host/path exatos; estados/reasons disabled apresentados, sem embed/download/prévia remota fictícia. Três importers continuam indisponíveis quando capabilities não habilita.
-39testes unitários/controlados verdes,build/typecheck verdes,30browserPC/mobile verdes. Primeiro fullrun tinha2asserções de texto antigo; atualizadas e novo fullrun30/30 passou. Radares/CRUD/reseleção/retomada/semclip cobertos.
- Emote fornecido inspecionado com view_image, ainda não copiado para repo. Original C:/Users/felip/AppData/Local/Temp/codex-clipboard-62b4321f-b530-4238-b01e-160df37bf2f7.png,1881198bytes,CTSAScadeirante contorno branco; usar original sem gerar substituto.

## Em andamento

- Commit/push do core recorte90 e checkpoint.
- Em seguida estética em commit separado: copiar original para frontend/public/brand; header legível com wordmarkpcdNades, favicon simples sem esmagar emote; fonteBarlowCondensed para títulos eBarlow para texto; grafite/azul/areia extraídos do logo. Preservar UI/radar/teclado/mobile.

## Retomar daqui

1. Conferir AGENTS/checkpoints/Git,branch/log e mensagem do orquestrador; preservar alterações. Npm em frontend/ ou --prefix frontend.
2. Conferir commit/push core e informar SHA ao orquestrador.
3. Copiar asset original antes que Temp expire; verificar hash idêntico. Fontes escolhidas têm OFL1.1 verificada nos repositórios GoogleFonts; baixar arquivos locais+licença, não depender de font externa em runtime.
4. Simplificar estética sem mudar lógica/catálogo. Usar skills brainstorming/no-ai-design-slop já lidas; direção concreta já autorizada, sem aprovação extra.
5. Verificar render real desktop/mobile e screenshots,logo/header/filtros/formulário/recorte; rodar suites pertinentes/build/typecheck;commit/push visual e checkpoint por marco. Sem deploy próprio.

## Decisões e contrato

- POSTuploads{clip?:{startSeconds,endSeconds}},POSTimports{sourceUrl,clip?} só se enabled. Complete não recebe clip. MediaRecord.clip null|obj; metadata.durationSeconds final.
- Final90 substitui20/40. Source comclip180é limite operacional backend. min0,1 e precision0,001 sem presumir fps.
- Trimming flag defaultfalse até revisão/runtime;3importersdisabled,sem anunciar corte/download operacional. Demo trimmingfalse para não fingir arquivo cortado.
- Timeouts preservados:complete150s,demais30s;confirminglocal retémID,GETawaiting→retrycomplete sembytes,409reconciliaGET,failed/nova seleção limpam sessão. Só publicar com ready e seleção correspondente.
- Identidade adicional: usar emote original do usuário, títulos condensados/marcantes,texto legível,azul/areia/grafite,radar como foco,poucas caixas; não gerar arte substituta ou favicon ilegível.

## Validação

- Executado core: npm test39/39; npm run build(typecheck); npm run test:browser30/30. Sem mutação/serviço remoto nesta etapa.
- Casos novos:90/91,precisão,minintervalo,início/fim inválido,origem maior que saída,preview pára em91 após iniciar90,1,disabled,semclip,reseleção,clip imutável e futuro link apenas quando explicitamente enabled (transporte controlado).
- E2E real ffmpeg/Vercel/Storage/links/corte não validado. Screenshots de test-results mostram renderer real com API controlada; não prova operação remota.
- Estética ainda NÃO implementada/testada; próximo marco.

## Bloqueios e dependências

- Nenhum bloqueio de frontend para estética. Backend/runtime/flagtrim e integração/publicação são do orquestrador.
- Não editar backend/main/radares7PNG/checkpoint alheio. Não criar credenciais/serviços/workflows.

## Histórico curto

- Atéa3033c8:API/inline,timeouts/erros e30unit+26browser;7e0490b pausa.
- Nova autorização:coreclip90+prévia concluído39unit/30browser; direção estética adicional recebida e assetinspecionado. Registro por marco antes da identidade visual.
