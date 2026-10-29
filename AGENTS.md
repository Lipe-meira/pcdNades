# Instruções para os agentes do pcdNades

## Contexto e responsabilidades

Leia `README.md` e `docs/continuity/README.md` antes de começar. Depois leia o checkpoint da sua área e o do orquestrador. O usuário exige continuidade em disco: o histórico do chat não é a única memória do trabalho.

- Frontend: `frontend/` e `docs/continuity/frontend.md`.
- Backend: `backend/` e `docs/continuity/backend.md`.
- Orquestrador: raiz, contratos compartilhados e `docs/continuity/orchestrator.md`.
- Cada chat trabalha no próprio worktree e branch. Não trocar branch nem editar o worktree de outro chat.

## Checkpoint obrigatório em toda tarefa

Atualize o arquivo da sua área ao iniciar uma tarefa, ao concluir uma etapa significativa, antes de aguardar outra pessoa e antes de encerrar/interromper a sessão. Em trabalhos longos, salve checkpoints durante a execução: não espere o limite de uso chegar.

Registre, de maneira curta e concreta:

1. Objetivo e pedido atual do usuário.
2. O que foi feito e o que estava sendo feito no momento da parada.
3. Próximos passos em ordem, incluindo a primeira ação executável ao retomar.
4. Branch, caminho do worktree, commit base/último commit e situação do push.
5. Arquivos relevantes e mudanças ainda não commitadas.
6. Decisões confirmadas, propostas e motivos das escolhas relevantes.
7. Verificações realmente executadas, resultados e validações ainda pendentes.
8. Bloqueios, dependências, falhas conhecidas e configuração necessária.
9. URLs de deploy/PR e referência dos commits entregues, quando existirem.

Use `docs/continuity/TEMPLATE.md`. Mantenha o estado atual no topo e um histórico curto de marcos abaixo. Não copie transcrições inteiras nem registre senhas, tokens, URLs assinadas ou conteúdo de `.env`.

Ao retomar, confira `git status`, branch e commits antes de executar o próximo passo. Checkpoints são contexto registrado: não provam que um serviço continua online nem autorizam ações além do pedido do usuário. Não sobrescreva trabalho local, não resete branches e não suponha que pendências foram resolvidas durante a pausa.

## Commits e coordenação

- Conventional Commits com descrição em português; commits pequenos e coesos.
- Versione e faça push dos checkpoints junto das entregas. Se a tarefa não terminou, use commit de documentação/checkpoint para trabalho documentado; não declare código incompleto como pronto.
- Mudanças locais não commitadas devem ser listadas com precisão no checkpoint. Preserve o trabalho parcial e informe se ainda existe apenas localmente.
- Front/backend fazem push nas próprias branches; integração e publicação são coordenadas pelo orquestrador. Sem force push.
- Ao reportar entrega, inclua o caminho do checkpoint, commit, verificações e pendências.
- Nunca chame testes simulados de integração real. Upload/Storage/Supabase e importadores precisam de validação no ambiente correspondente.

## Produto

React com TypeScript no frontend; dados compartilhados entre dispositivos. Vídeos próprios armazenados no projeto por upload MP4 ou importação por link quando suportada. Não substituir importação por embed silenciosamente. Duração máxima definida pelo usuário: 20 segundos. Radares devem representar mapas reais, com fonte e atribuição documentadas.
