# Faixa de seleção de mapas

Referência de interação: multiAPP, commit20df99f6232ab66012f18b3f5c4d850f02d6a24b, featured-cities.tsx e city-exploration.css (repositório do usuário). Direção já autorizada pelo orquestrador30/10. Adaptado à identidade pcdNades, sem NextImage, assets externos ou dependências novas.

Uma faixa manual compacta substitui o select da biblioteca; manter o select seria redundante e cards grandes tirariam o foco do radar. Cada botão48px mostra nome e radar inteiro reduzido como miniatura; usa radarUrl existente com atribuição do mapa preservada abaixo do radar principal. Nome continua disponível se a imagem falhar, com iniciais como fallback.

Catálogo vem de props maps/API: nenhum ID, nome ou quantidade fixo no componente. clique/Enter/Espaço selecionam; Tab navega nativamente, setas/Home/End movem foco sem seleção automática. Seleção e foco tornam o item visível rolando apenas a faixa, sem animação ou salto vertical. Swipe/scrollbar usam rolagem nativa. aria-current identifica seleção; nenhuma dependência só de cor. Admin mantém seu select. Estados gerais loading/error/empty permanecem no App.

Testar demo/API com7mapas, teclado, scrollmobile, fallback e preservação de filtros/detalhes/CRUD/recorte. Sem deploy; main apenas após entrega finalizada e testada, com integração pelo orquestrador.

## Painel de filtros

Referência adicional: https://csnades.gg/nuke e screenshot do usuário, consultados em30/10/2026. Adaptação da composição tipos/contagens e lado; ícones existentes do pcdNades, sem copiar assets ou opções não suportadas. Painel lateral no desktop; tipos em duas colunas e lado em segmento no celular. Contagens usam mapa+lado e ignoram o tipo selecionado, mantendo alternativas e zeros visíveis; não representam recomendações. O painel só existe quando Library recebe dados carregados, sem zeros fictícios em loading/error. Testes cobrem mapa, lado, seleção por teclado, filtros combinados e estados indisponíveis.
