# Continuidade entre sessões

O objetivo é permitir que qualquer chat retome uma tarefa no dia seguinte, mesmo sem o histórico completo. Esta rotina foi solicitada pelo usuário usando o [REA](https://github.com/morluto/rea) como referência. É uma adaptação para o pcdNades, não uma reprodução declarada do workflow do REA.

## Ordem de leitura

1. `AGENTS.md` e `README.md` na raiz.
2. `docs/continuity/orchestrator.md` para a situação geral.
3. `docs/continuity/frontend.md` ou `backend.md` para a tarefa específica.
4. Contratos, código e commits apontados no checkpoint.

Cada responsável mantém seu arquivo. Os checkpoints de frontend/backend serão criados pelos respectivos chats a partir do template, com o estado real que apenas eles conhecem. Confira a branch remota correspondente: checkpoints ainda não integrados podem existir somente em `feat/frontend` ou `feat/backend`.

Checkpoints devem cobrir também tarefas em andamento e tentativas que falharam. Atualize durante o trabalho, não apenas ao finalizar. Um encerramento abrupto pode perder mudanças posteriores ao último checkpoint; salve os marcos com frequência e faça push em cada entrega.

Use datas com fuso de São Paulo e referências de commits para situar o registro. Não inclua segredos. Diferencie sempre **feito**, **em andamento**, **planejado**, **bloqueado** e **não validado**.
