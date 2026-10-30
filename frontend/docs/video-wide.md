# Vídeo em modo compacto e amplo

Pedido30/10/2026: manter o player pequeno e oferecer visão maior dentro do pcdNades, inspirada na composição do screenshot CSNADES fornecido. Não é FullScreenAPI nem um segundo player. Só exibir título, tipo, lado e instruções existentes.

Library mantém a mesma árvore de detalhes/VideoPlayer e alterna classes CSS. Visão ampla de página: toolbarVoltar, player à esquerda e informações à direita; em telas menores as informações ficam abaixo. Video usa object-fit:contain e proporção natural com limite pela altura da viewport, preservando o quadro completo inclusive em vídeos verticais. Header e navegação normais continuam disponíveis; não é modal e não prende foco.

Abrir guarda scroll, move foco ao botãoVoltar e rola ao início. Voltar/Escape restaura o botãoAmpliar e scroll; Escape não troca modo quando document.fullscreenElement existe. Nenhum requestFullscreen é chamado. Alternância não altera src/key nem recria o video: tempo, pausa/reprodução, volume e mute nativos permanecem. Renew/erros/retry/cleanup continuam no VideoPlayer existente. Seleção de outra granada volta ao compacto e troca o player quando muda o vídeo; listeners de Escape são removidos ao sair do modo.

Validação automatizada com APIcontrolada e vídeo sintético: identidade DOM única, paused/playing/seek/volume/mute, número de leases sem aumento pela alternância, foco/scroll, trocar granada,320px/landscape, renew no amplo, erro de arquivo e erroAPI explícitos/retry, timer cancelado ao fechar detalhes. Não representa E2E de Supabase/Storage ou vídeo de gameplay real.
