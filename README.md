# pcdNades

Biblioteca compartilhada de granadas de Counter-Strike 2 para ajudar um time a aprender e treinar lineups.

- Repositório: https://github.com/Lipe-meira/pcdNades
- Chat orquestrador: **Criar site de lineups para CS2**
- Chat de frontend: **frontEnd CS2**
- Chat de backend: **backend CS2**

Este documento é a referência inicial de produto e coordenação. As propostas técnicas abaixo ainda não representam um contrato de API aprovado nem autorização para provisionar serviços. Atualizado em 28/10/2026.

## Objetivo

O responsável cadastra uma smoke, flashbang ou molotov, marca no radar onde ela cai e associa um vídeo demonstrando a execução. Um amigo abre o site em outro dispositivo e encontra o mesmo conteúdo salvo.

A necessidade chamada inicialmente de “salvar sessão” significa **persistência compartilhada dos cadastros**. Não exige sala ao vivo, transmissão da tela, cursores compartilhados ou sincronização instantânea do mapa selecionado.

Exemplo de uso: cadastrar “Smoke janela — Mirage”, marcar o destino na janela e adicionar o vídeo. Depois, outro integrante abre Mirage, filtra por smoke e toca no ponto para assistir e treinar.

## Requisitos confirmados pelo usuário

- Frontend em **React com TypeScript**, por familiaridade do usuário.
- Biblioteca para o time treinar granadas de CS2.
- Cadastro de smokes, flashbangs e molotovs com vídeo curto demonstrativo.
- Upload de vídeo `.mp4` e fluxo desejado de importação por link do YouTube Shorts ou TikTok: baixar e armazenar uma cópia no projeto, em vez de apenas incorporar o player externo. O suporte de importação por plataforma depende de validação técnica.
- Marcação do destino da granada no mapa.
- Conteúdo salvo disponível para outras pessoas que abrirem o site, inclusive em outro dispositivo.
- Chats separados para frontend e backend, coordenados pelo orquestrador.
- Cada chat deve fazer commits e pushes do seu trabalho, usando Conventional Commits com descrição em português.
- Planejamento de táticas fica para uma fase futura e deve ser ignorado nesta versão.

## Proposta de primeira versão

Os itens desta seção detalham a proposta para o MVP; a política de acesso e a viabilidade dos importadores ainda precisam do alinhamento indicado adiante.

### Consulta

1. Selecionar um mapa.
2. Visualizar seu radar e os destinos das granadas cadastradas.
3. Filtrar por smoke, flashbang ou molotov; filtro por lado T/CT também proposto.
4. Clicar ou tocar em um destino para abrir vídeo e instruções.
5. Consultar uma lista de granadas como alternativa aos pontos, inclusive quando houver destinos sobrepostos.

A interface deve ser em português e funcionar em PC e celular. O vídeo precisa preservar a visibilidade da mira e dos detalhes de execução. A lista e os marcadores devem permitir navegação acessível, sem depender apenas de cor.

### Administração

- Cadastrar, editar e excluir lineups.
- Informar título, mapa, tipo de granada, lado T/CT, instruções e vídeo.
- Selecionar o destino clicando ou tocando no radar.
- Validar os dados e mostrar os erros de forma compreensível.

### Persistência

O banco compartilhado é a fonte dos cadastros. Salvar apenas no navegador de quem cadastrou não atende ao requisito. Estado local pode ser usado para filtros, formulários e cache, mas não como armazenamento principal da biblioteca.

Não precisamos de WebSockets para atender ao caso inicial: abrir ou atualizar a consulta deve buscar o conteúdo persistido no backend.

### Vídeos: upload e importação por link

O usuário escolheu **baixar e guardar**. O objetivo é assistir pelo player do pcdNades a um arquivo persistido no armazenamento do projeto. Um embed do YouTube ou TikTok não substitui esse requisito.

- Permitir upload direto de `.mp4`.
- No fluxo de importação, receber um link de Shorts ou TikTok e criar uma tarefa de processamento no servidor.
- Mostrar estados de espera, processamento, sucesso e falha; só disponibilizar o vídeo como pronto após armazenar e validar o arquivo.
- Guardar referência ao arquivo e metadados no banco; guardar o vídeo em armazenamento de objetos, fora do Git.
- Preservar a URL de origem para referência. Não depender dela para reproduzir uma importação concluída.
- Antes de assumir suporte a uma plataforma, validar a forma de obtenção, as permissões aplicáveis e as limitações operacionais. Não prometer importação universal nem contornar login, conteúdo privado, DRM ou bloqueios.
- Se uma importação não puder ser concluída, informar o motivo e oferecer upload direto; não trocar silenciosamente por embed.

Proposta técnica: processamento fora da requisição HTTP, com limites de tamanho/duração/tempo, limpeza de arquivos temporários e proteção contra URLs que apontem para serviços internos. Ferramentas, hospedagem, limites e contrato das tarefas ainda serão definidos.

Referências oficiais para a investigação: [políticas da API do YouTube](https://developers.google.com/youtube/terms/developer-policies), [embed do TikTok](https://developers.tiktok.com/doc/embed-videos/). O YouTube restringe download/armazenamento de conteúdo pela API sem aprovação prévia. A documentação de embed não constitui uma API de download. Essas limitações devem ser consideradas na proposta de importação.

## Referências

As referências servem para estudar organização, navegação e consulta de lineups. O produto terá identidade própria; não presumir autorização para copiar vídeos, imagens, radares, marcas ou outros assets desses serviços.

| Referência | Link | O que estudar |
| --- | --- | --- |
| CSNADES.gg | https://csnades.gg/ | Organização da biblioteca por mapas e tipos de granada. Principal referência indicada pelo usuário. |
| CSNADES.gg — Mirage | https://csnades.gg/mirage | Radar, destinos, filtros por granada e lado, consulta das lineups. |
| CSNades.app | https://csnades.app/ | Combinação de vídeo com imagens de posicionamento e mira para consulta rápida; coleções de granadas. |
| NadeIQ | https://nadeiq.app/ | Apresentação de execução e resultado; agrupamentos por origem ou destino e apoio ao treinamento. |
| nadeguide | https://www.nadeguide.com/ | Consulta direta por mapas e lineups, com foco em encontrar rapidamente o conteúdo. |

As páginas foram consultadas durante a pesquisa inicial. Recursos desses sites são inspiração, não requisitos automáticos do pcdNades.

## Fora do escopo inicial

- Criação e execução de táticas.
- Salas e colaboração em tempo real.
- Análise ou extração automática de demos de partidas.
- Estatísticas competitivas, rankings ou monetização.
- Copiar ou importar automaticamente a biblioteca dos sites de referência.

Favoritos, coleções de treino, marcação de origem e comandos de prática podem ser avaliados depois; não devem bloquear a primeira entrega.

## Decisões pendentes

1. **Acesso:** a proposta é consulta pública pelo link e escrita restrita a administrador. O usuário ainda não confirmou se a leitura deve ser restrita ao time.
2. **Importadores de vídeo:** upload de MP4 e a intenção de baixar/guardar por link estão confirmados. Validar quais plataformas podem ser suportadas e definir processamento, armazenamento, limites e tratamento de falhas. Embed não é a solução escolhida.
3. **Backend e infraestrutura:** TypeScript é preferência proposta para o backend. Fastify com PostgreSQL e autenticação no Supabase foi sugerido pelo chat de backend, mas ainda não foi aprovado.
4. **Mapas e assets:** definir os mapas iniciais, a origem permitida das imagens e um radar canônico para cada mapa.
5. **Publicação:** definir hospedagem, ambientes, credenciais e conta administrativa. Não inserir segredos no Git.

## Alinhamento técnico proposto

### Estrutura e responsabilidades

```text
frontend/    React + TypeScript; responsabilidade do chat de frontend
backend/     API e persistência; responsabilidade do chat de backend
docs/        Especificações e contrato de integração; coordenação do orquestrador
README.md    Contexto geral; coordenação do orquestrador
```

Arquivos de raiz e configurações compartilhadas devem ser coordenados pelo orquestrador para evitar mudanças conflitantes. Não há aplicação implementada neste momento.

### Dados de uma lineup

Modelo de discussão, sujeito ao contrato final:

| Campo | Finalidade |
| --- | --- |
| `id` | Identificador gerado pelo servidor. |
| `title` | Nome reconhecível, como “Smoke janela — Mirage”. |
| `mapId` | Mapa ao qual pertence. |
| `type` | `smoke`, `flashbang` ou `molotov`. |
| `side` | `T` ou `CT`, conforme proposta inicial. |
| `instructions` | Orientações para executar a granada. |
| `video` | Referência ao arquivo armazenado, estado de processamento e metadados; formato a definir no contrato. |
| `sourceUrl` | URL de origem, quando o vídeo for importado por link. |
| `target` | Destino no radar, com coordenadas `x` e `y`. |
| `createdAt`, `updatedAt` | Datas geradas pelo servidor. |

O mapa deve fornecer identificador, nome, URL do radar, dimensões e uma referência de versão da imagem. Endpoints, envelopes de resposta, validações e autenticação serão definidos em um contrato próprio antes da integração.

### Coordenadas do radar

Alinhamento técnico proposto pelos dois chats:

- `x` e `y` normalizados entre `0` e `1`, inclusive.
- Origem no canto superior esquerdo da imagem; `x` cresce para a direita e `y` para baixo.
- Calcular a posição relativa à imagem efetivamente exibida, excluindo padding e faixas vazias de `object-fit`.
- Renderizar o marcador proporcionalmente, para preservar a posição no celular e no desktop.
- Não trocar enquadramento ou orientação de um radar existente sem avaliar a migração dos pontos cadastrados.

## Fluxo de trabalho dos chats

1. Ler este documento e inspecionar o repositório.
2. Alinhar escopo, contrato e decisões pendentes com o orquestrador.
3. Trabalhar em worktree próprio, fornecido ou combinado com o orquestrador, antes de editar ou trocar branches.
4. Branches previstas: `feat/frontend` e `feat/backend`. O orquestrador deve confirmar os caminhos e a base antes do início.
5. Fazer commits pequenos e coesos, incluindo apenas arquivos sob sua responsabilidade.
6. Executar as verificações pertinentes e registrar seus resultados.
7. Fazer push para a própria branch e informar branch, commits, verificações e pendências ao entregar.

Não fazer push direto na `main`, merge ou force push. Não assumir que branches diferentes tornam seguro trabalhar simultaneamente no mesmo diretório: cada chat precisa de seu worktree.

### Conventional Commits

Tipo convencional em inglês, descrição em português. Exemplos:

```text
feat(frontend): adiciona seleção de mapas
feat(backend): implementa cadastro de granadas
fix(frontend): corrige posição dos pontos no radar
docs: documenta escopo e referências do projeto
```

## Critérios de aceite da primeira versão

- Uma granada cadastrada permanece disponível após fechar e reabrir o site.
- Outra pessoa, em outro dispositivo, consegue consultar o mesmo cadastro conforme a política de acesso definida.
- O destino permanece na posição correta em tamanhos de tela diferentes.
- Selecionar a granada abre o vídeo correspondente e suas instruções.
- Os filtros mostram os resultados esperados e há tratamento de carregamento, erro e lista vazia.
- Apenas usuários autorizados conseguem criar, editar ou excluir dados; a restrição deve existir no backend/banco.
- Frontend e backend passam nas verificações pertinentes e a integração é exercitada com dados reais de teste.

## Situação atual

Repositório recém-criado e sem código de aplicação. Os chats apresentaram propostas e aguardam contrato, decisões de produto e organização dos worktrees. Este README registra o contexto para evitar suposições divergentes entre as equipes.
