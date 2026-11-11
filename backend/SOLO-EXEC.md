# Solo Exec — implementação em desenvolvimento

Solo Exec representa um vídeo, uma origem e 1–12 destinos tipados (`smoke`, `flashbang`, `molotov` ou `he`). O primeiro destino também é mantido em `target` para compatibilidade. O radar mostra os destinos e ligações à origem; o formulário permite acrescentar, selecionar, alterar tipo e remover destinos. Trocar o mapa limpa todos os pontos e seleção ativa. Granadas normais conservam o esquema anterior.

A migration `20261101152756_solo_exec_destinations.sql` é nova e não foi aplicada no Supabase remoto. Inclui validação de tipo, coordenadas, origem e consistência com target; preserva linhas existentes. A migration e inserção/edição local com papel authenticated foram verificadas dentro de transação revertida no Supabase local preservado; não é prova de integração completa HTTP/Auth/Storage em um banco migrado. Pré-requisito de produção: plano de backup/rollback atualizado, autorização específica e verificar ordem banco/frontend/backend; o frontend antigo não entende o tipo novo.

Validação: backend 110 testes, frontend 55 testes, builds Windows, 70 Playwright desktop/mobile com API controlada. Reexecutar backend após integração do Instagram. Os testes do navegador simulam Auth/Storage/API; não afirmar upload ou publicação reais. O teste da migration local em `backend/vendor/local-integration-20261031/solo-migration-check.mjs` usa credenciais exclusivamente locais e não deve ser versionado; alterações são revertidas.

Pendências: integração com o trabalho de Reels/prévia, validação combinada e acesso completo com Supabase local, revisão de edição/conversão em condições reais e autorização antes de operações remotas. Não publicar em produção ainda.
