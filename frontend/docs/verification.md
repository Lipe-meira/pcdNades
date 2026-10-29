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
