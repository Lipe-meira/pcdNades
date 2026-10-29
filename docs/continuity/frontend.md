# Checkpoint — frontend

Atualizado em: 29/10/2026, America/Sao_Paulo
Estado: primeira prévia concluída; iniciando integração opcional com API

## Objetivo e pedido atual

O usuário autorizou retomar e integrar o frontend com o contrato real: serviço HTTP opcional por env, autenticação Supabase de administrador, capabilities, upload assinado/complete/polling e playback com renovação. Não provisionar serviços, não inventar credenciais nem alegar E2E real com mocks. Primeiro enviar a entrega demonstrativa já concluída.

## Localização do trabalho

- Worktree: C:/Users/felip/.codex/worktrees/pcdnades-frontend/nadesCs2.
- Branch: feat/frontend; base e889e3b. Último código: 3c220c3; checkpoint anterior f124ac6.
- Ação de agora: commit deste checkpoint e push de feat/frontend, incluindo 3c220c3. Conferir log/remoto após o push; hash do próprio checkpoint deve ser obtido no Git.
- Git estava limpo ao retomar; somente este checkpoint está sendo atualizado. Nenhum código da integração opcional foi escrito ainda.
- AGENTS/guia/template e checkpoint do orquestrador lidos de origin/main d8c643b; não foram incorporados por merge nesta branch. Não alterar raiz/main/worktrees alheios.

## Feito

- Commits 056eea8 biblioteca/radar; e3b66c0 plantas reais licenciadas; 953a2ad CRUD/MP4 demo; f124ac6 checkpoint; 3c220c3 testes, responsividade, teto de 20s, SPA e documentação.
- 3c220c3 contém frontend/README.md, docs/verification.md, Playwright e fixture MP4 sintética de dois segundos (sem gameplay), vercel.json; código formatado.
- Prévia React/TS/Vite em memória explicitamente identificada. Sem localStorage de cadastros, sem senha simulada, sem upload/download remoto.
- Plantas vetoriais Mirage/Inferno/Ancient de setpos.gg, licença de artwork CC BY 4.0, snapshot ba5f793883e1ce13076dd6919aa1601099c247cf de 23/10/2026. Não são texturas extraídas oficiais e podem ficar defasadas. Crédito/versão/licença junto ao radar e em public/maps/ATTRIBUTION.md.
- CRUD/MP4 local, assinatura/MIME/tamanho/duração, player play/pause/seek, agrupamento de destinos sobrepostos e alternativa de coordenadas pelo teclado.
- Link indisponível não publica a granada nem substitui vídeo anterior. Teto 20s confirmado e testado.
- Screenshot desktop/mobile/formulário revisado com view_image. Arquivos fora do Git: C:/Users/felip/.codex/visualizations/2026/10/29/01a1853b-6e1e-79b3-8505-70e2d76056fe/frontend-{desktop,mobile,form}.png.

## Em andamento

- Enviar 3c220c3 e este checkpoint; comunicar catálogo canônico ao orquestrador.
- Relendo contrato concreto backend e preparando arquitetura/testes do adaptador HTTP/auth/mídia. Sem serviços provisionados ou credenciais.

## Retomar daqui

1. Conferir git status/branch/log, ler AGENTS/guia/checkpoints na main remota e este arquivo.
2. Confirmar push de 3c220c3 e do checkpoint; informar ao orquestrador antes de iniciar código de integração.
3. Ler backend/README.md e modelo/capabilities na origin/feat/backend, sem editar worktree alheio; confirmar ambiguidades via orquestrador.
4. Implementar/testar seleção explícita de runtime demo/API, cliente HTTP e adapter com respostas controladas. Nunca fallback silencioso para demo após erro remoto.
5. Integrar autenticação/admin, capabilities e pipeline de mídia por etapas com commits/checkpoints. Validar controladamente; ambiente remoto ainda é pendência.

## Decisões e contrato

- React+TS, português, limite 20s, mapas reais licenciados, banco compartilhado como fonte principal, sem embed.
- IDs canônicos: mirage/inferno/ancient. Imagens /maps/mirage.svg, /maps/inferno.svg, /maps/ancient.svg; 1024×1024. coordinateVersion setpos-mirage-ba5f793 / setpos-inferno-ba5f793 / setpos-ancient-ba5f793. Preservar imagem inteira/orientação. Descartar ou migrar coordenadas se trocar enquadramento.
- API /api/v1; mapas {data:[{id,name,radar:{imageUrl,width,height,coordinateVersion}}]}; granadas {data,pagination}; Bearer Supabase; POST/PATCH videoId somente ready.
- POST /media/uploads retorna sessão supabase-signed; uploadToSignedUrl; complete; polling 3s; capacidades/limites pelo GET capabilities. Playback apenas após publicação, com URL expirada renovável. Importadores inicialmente PLATFORM_UNSUPPORTED.
- Sem decisão de privacidade nova; leitura pública e admin seguem contrato provisório coordenado.
- Referências: frontend/README.md e docs/verification.md; contrato backend na branch feat/backend. Integração real acaba de ser autorizada em 29/10.

## Validação

- Última execução pré-pausa, sem mudanças de código depois: npm test 10/10; npm run build (inclui typecheck) passou; npm run test:browser 12/12; npm audit zero vulnerabilidades; git diff --check sem erros.
- Browser integrado usado na revisão visual primária; Playwright fez testes repetíveis em 1440×1000/390×844, mais overflow 320/390/768/1440px. Corrigidos overflow de 4px e label do seletor.
- Comandos npm precisam rodar em frontend/ ou usar npm --prefix frontend. Tentativas na raiz retornaram ENOENT e foram refeitas corretamente.
- Não validado: API/Supabase, auth/RLS, upload/Storage/worker real, playback assinado, persistência em dois dispositivos, Safari/iOS. Não existe .env nem segredo de produção.

## Bloqueios e dependências

- Sem bloqueio para escrever/testar adaptador com respostas controladas.
- E2E real depende de Supabase/API/worker/seed e coordenação; não provisionar nem inserir credenciais.
- Publicação e integração main são do orquestrador. Não alterar main nem efetuar deploy.

## Entrega e histórico curto

- 28/10: demo até 953a2ad integrada/publicada pelo orquestrador em https://pcdnades.vercel.app (reportado por ele; não é integração remota do frontend com backend).
- 28/10: f124ac6 checkpoint enviado; 3c220c3 validado e commitado, aguardava push.
- 29/10: retomada autorizada, Git limpo confirmado e novo incremento API autorizado. Atualizando checkpoint antes de push/início.
