# Radares de Counter-Strike 2 (`maps/valve`)

Radares 1024×1024 usados pela biblioteca (um PNG por mapa, mais `nuke_lower.png` para o andar inferior da Nuke).
Servidos localmente; nenhum hotlink ou download em runtime.

## Origem e licença — o que se sabe e o que não se sabe

- Os arquivos entraram no repositório nos commits `3b06bbc` (Ancient, Inferno, Mirage) e `a8aa9ee` (Anubis, Cache, Dust II,
  Nuke e `nuke_lower`), de 29/10/2026, descritos como "radares oficiais do CS2". **A URL de origem exata e a licença não
  foram registradas naquele momento.** São imagens do jogo Counter-Strike 2, propriedade da Valve Corporation; este projeto
  não atribui licença MIT/CC nem autoria própria a elas e não declara afiliação ou endosso da Valve.
- O andar inferior da Nuke (`nuke_lower.png`) tem a mesma origem, tamanho e calibração do `nuke.png` (mesmos 1024×1024, mesmo
  sistema de coordenadas): um ponto normalizado (x, y) cai no mesmo lugar nos dois arquivos. Por isso as granadas gravam
  apenas qual andar é usado, sem duplicar nem recalcular coordenadas.
- Os arquivos não foram editados. O recorte exibido na interface é só de apresentação (ver `domain/mapLevels.ts`).
- Os radares podem estar defasados em relação a atualizações recentes da Nuke. **Antes de divulgar amplamente, confirme com
  o jogo atual** e, se houver mudança de enquadramento, as coordenadas existentes precisam de revisão.

## Alternativas verificadas

- setpos.gg (CC BY 4.0, já usado para Mirage/Inferno/Ancient em `../ATTRIBUTION.md`): o `maps.json` do snapshot
  `ba5f793` registra a Nuke como "Upper level only; no lower-level drawing is included". **Não há desenho licenciado do
  andar inferior**, então ela não substitui o par de radares acima.
- CSNADES: apenas a funcionalidade (botões 1 e 2 para alternar andares) serviu de referência. Nenhum asset, imagem ou
  código do CSNADES foi copiado ou usado.
- Caminho legítimo para atualizar os radares: extrair os overviews do próprio jogo instalado (arquivos de Valve, mesmo
  status acima) ou obter autorização/licença de um autor com os dois andares.

## Arquivos

| Arquivo | Bytes | SHA256 |
| --- | ---: | --- |
| nuke.png | 80130 | 6230346d3ce969006062fbd02220b083245f621ef366ce26a42dc27a80120bd0 |
| nuke_lower.png | 80046 | 040c958f141d0365ca9125388bc20228b0df0ac6abd1fe78d743ecfa1be4bb64 |

Counter-Strike 2 é marca da Valve Corporation.
