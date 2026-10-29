# Plano de implementação do frontend

Escopo autorizado pelo orquestrador: demonstração React + TypeScript + Vite, exclusivamente em frontend/. Referência de produto: ../README.md na raiz do repositório, base e889e3b. Nenhum serviço externo, API definitiva, login real ou importador será implementado nesta etapa.

## Estrutura

- src/domain: tipos provisórios, filtragem, validação e coordenadas normalizadas.
- src/services: interface assíncrona substituível e repositório demonstrativo em memória.
- src/components: radar reutilizável, ícones e diálogo acessível.
- src/features: biblioteca, detalhes, administração e formulário/mídia.
- src/app: navegação e ligação dos fluxos.
- tests: testes de domínio e interação de navegador.

## Etapas

1. Escrever testes de filtros/coordenadas; observar falha; implementar domínio. Construir base navegável, radar esquemático autoral (explicitamente identificado), lista acessível, filtros e seleção sincronizada. Verificar tipos, testes e build; commit coeso.
2. Escrever testes de validação/serviço; observar falha; implementar cadastro, edição e exclusão em memória. Formulário permite MP4 local ou pedido de importação identificado como indisponível. Estados de mídia refletem apenas condições reais da demo; não simular transferência/processamento do servidor. Player HTML nativo usa URL de objeto de MP4 local. Administração é demonstração explícita, sem coletar senha. Verificar; commit coeso.
3. Testar PC e celular: filtros, mapa vazio, pontos sobrepostos, detalhes, fechar/voltar/foco, CRUD temporário, arquivo/link, reload sem persistência, limites e erros. Revisar screenshot, acessibilidade básica, console e overflow. Documentar resultados e pendências; commit e push da feat/frontend.

## Direção visual

Ferramenta escura de treino: grafite, verde sálvia para ações/seleção, lista com divisórias, radar como foco. Texto em português, marca própria, sem fotos nem assets de jogos. Controles de pelo menos 44px no toque; cor reforçada por ícone e texto. Layout PC em colunas, celular empilhado. Todo conteúdo fictício é rotulado e não contém instruções reais de lançamento.

## Verificações essenciais

- Clique/toque sobre a imagem usa apenas o retângulo efetivo da imagem, sem padding.
- Normalização inclui bordas 0/1; pontos não mudam com tamanho da imagem.
- Filtros combinados podem retornar vazio sem erro; seleção não aponta para item oculto.
- Excluir o item aberto fecha o detalhe; erro não remove dados.
- URL externa nunca vira embed nem download no navegador; MP4 permanece só nesta sessão.
- Formulário não perde dados ao falhar e não anuncia compartilhamento/persistência.

## Pendências de integração

Contrato final, autenticação/permissões no servidor, upload/storage/jobs, limites reais, assets canônicos dos radares, publicação e validação em dispositivos distintos. Estados do modelo de mídia são provisórios e ficam na fronteira do serviço.
