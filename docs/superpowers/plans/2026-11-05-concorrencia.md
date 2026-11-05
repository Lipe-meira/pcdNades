# Controle otimista de edições

Base: PR #8 (`05cbc5a`). O PATCH atual atualiza por ID; `updated_at` usa `now()` e não é uma versão confiável em transações com várias alterações.

1. Migration aditiva: coluna `revision` inteira com valor inicial 1 e trigger BEFORE INSERT/UPDATE que impõe 1 na criação e incrementa a revisão antiga em toda atualização. Nenhum dado de mídia ou registro existente é removido. Requer aprovação específica e rollout coordenado antes de produção.
2. Contrato: PATCH exige `expectedRevision`; um único UPDATE com predicados de ID e revisão garante comparação atômica. Divergência retorna 409; versão ausente retorna 428. GET/POST retornam revision. Clientes antigos que fazem PATCH sem versão deixarão de funcionar; implantação precisa ser coordenada.
3. Frontend transmite a revisão recebida ao abrir a edição; não altera fluxo de mídia. Conflito preserva formulário e eventual mídia processada, sem repetir o PATCH automaticamente. Comunicar ao usuário para atualizar e revisar.
4. Testar conflitos reais em PostgreSQL local isolado, além de testes de API e frontend controlados. Não aplicar nada em ambientes remotos.

## Evidência local — 05/11/2026

Banco PostgreSQL 17 Alpine temporário em container `pcdnades-concurrency-lab-20261105`, rede `none` e dados em tmpfs próprio; fixture sintética com FK de vídeo, origem e destinos. Aplicada exclusivamente a migration nova nesse banco mínimo. Duas sessões concorrentes disputaram `revision=1`: primeira retornou revision 2 / UPDATE 1; segunda, UPDATE 0. Resultado manteve video_id, origem e destinos. Na mesma transação, duas atualizações avançaram 2→3→4; rollback preservou revisão 2. Esta evidência valida CAS e trigger reais em PostgreSQL, mas não é E2E real de Auth/PostgREST/Storage nem réplica completa do schema de produção.

Contrato novo: PATCH exige inteiro positivo `expectedRevision` (428 ausente, 400 inválido, 409 GRENADE_VERSION_CONFLICT se linha mudou; 404 se ausente). Respostas de granadas incluem `revision`. Cliente recusa editar sem revisão antes de iniciar upload e conserva o formulário em conflito. Uma mídia já processada pode permanecer pronta após conflito e seu identificador é mantido na sessão atual; não há exclusão automática. Não há migração aplicada remotamente.

Para implantação futura: preservar backup, pausar edições, aplicar migration aprovada, publicar backend e frontend de forma coordenada, validar 409 e retomada sem sobrescrever dados; clientes antigos recebem 428. O frontend novo requer revision nas respostas, portanto não é compatível com o backend antigo. Sem PR8 integrado, esta branch deve ser avaliada como empilhada sobre seu HEAD 05cbc5a.

## Controle de acesso e limitações

A migration revoga UPDATE de `PUBLIC`, `anon` e `authenticated` em `public.grenades` e concede SELECT/UPDATE a `service_role`. A rota PATCH primeiro verifica JWT e `is_admin` com cliente do usuário, depois executa a comparação/atualização usando o cliente de serviço. Isso evita que administradores contornem o contrato chamando UPDATE direto pela Data API, desde que não existam grants por coluna, memberships ou funções adicionais que concedam escrita; esses pontos exigem preflight de produção e não foram consultados nesta tarefa. A revogação altera permissões e interrompe PATCH pelo backend antigo, exigindo janela coordenada. Não usar o serviço em outras rotas sem autorização própria.

O teste `pwsh -File backend/tests/sql/concurrency-real.ps1` cria container PostgreSQL 17 Alpine de nome aleatório, com rede none e tmpfs próprio, testa migration e privilégios de tabela, disputa concorrente e duas mudanças na mesma transação, e remove somente o container criado por ele. A fixture usa schema reduzido; não comprova Auth/PostgREST reais, grants por coluna em produção ou integração com Storage. O laboratório manual anterior `pcdnades-concurrency-lab-20261105` permanece preservado para análise; não serve para validar os novos grants pois foi criado antes desse ajuste.
