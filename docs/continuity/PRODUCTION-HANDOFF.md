# Continuidade: integração privada e backup — 31/10/2026

## Estado verificado

Branch dev, worktree `C:\Users\felip\.codex\worktrees\pcdnades-dev\nadesCs2`, base `ad39a0b95556274b02473ac7522797260e4cb91d`. Consultar `git status -sb`, `git log -3 --oneline`, `git fetch origin` e `git rev-list --left-right --count dev...origin/dev` ao retomar. `origin/main` estava em `f4aa7229c027ef045338e523eec28971f7c79d51`; revalidar antes de agir. SHA deste registro por `git log -1` e remoto por `git ls-remote origin refs/heads/dev`; não é possível embutir no próprio commit seu SHA final. Nenhuma alteração de produção nesta etapa.

Supabase local: projeto `pcdnades-e2e-20261031-a7f4`, DB loopback 127.0.0.1:55422, Auth/REST/Storage 127.0.0.1:55421; cinco containers locais ativos no início. As evidências privadas e credenciais descartáveis ficam em `backend/vendor/local-integration-20261031/` e `backend/vendor/pilot-20261031/`, ignorados. A validação criou uma mídia local não publicada e um segundo admin descartável local; foram preservados, sem excluir outros dados. Não versionar vendor, mídia, tokens ou URLs assinadas.

A integração real local de `ad39a0b` passou: FFmpeg recortou 5s de fixture autorizada offline, salvou apenas o MP4 final no Storage privado real, status ready, nenhum cadastro de granada criado, rota pública de playback 404, segundo admin autenticado 403, usuário anônimo 401, admin autorizado recebeu URL privada e bytes coincidiram, hash da mídia existente preservado. Chromium realmente reproduziu o MP4 de 5s da URL assinada local. Inspeção TikTok/rede externa não foi testada; a mídia de origem foi fixture já existente. Não foi testada renovação automática da URL. Restrições de vínculo do segundo admin foram validadas com o Supabase local real.

Comandos desta validação, somente com stack local acima ligada, arquivos privados intactos e Docker disponível:

```powershell
npm --prefix backend run build
node backend/vendor/pilot-20261031/admin-private-integration.mjs
node backend/vendor/pilot-20261031/admin-private-browser.mjs
```

A primeira execução cria dados e um novo usuário ADMIN apenas na stack local; não executar repetidamente sem necessidade. Scripts fazem assert explícito dos endereços, mas antes verifique Docker e portas. São evidências locais ignoradas, disponíveis somente neste computador, não portáteis por Git. Os testes unitários/navegador anteriores: backend 108, frontend 55 e 14 Playwright TikTok com fixtures; não substituem integração real com Vercel/TikTok.

Vercel: projetos existentes `pcdnades` e `pcdnades-api` permanecem em produção com TikTok desativado; as IDs de deploy anteriores e plano em `backend/IMPORT-PRODUCTION-AUDIT.md` devem ser verificadas novamente. Projeto separado `pcdnades-preview-api` ficou disponível do preflight anterior; não foi alterado nesta etapa. Supabase remoto: migration TikTok ainda não aplicada segundo auditoria anterior; não foram feitas leituras ou escritas remotas nesta etapa. Reconfirmar situação atual antes de qualquer ação.

## Backup e restauração: preparação, não executada

O plano Free não oferece backup diário automático segundo a documentação atual. Os comandos oficiais Supabase CLI exportam schema, dados e roles separadamente; `auth`, `storage`, histórico de migrations, configurações e objetos podem exigir tratamento específico. Um dump de banco não inclui bytes de Storage. Não divulgar credenciais nem gravar dumps de dados reais no Git, repositório, logs ou serviços de terceiros.

1. **Requer autorização específica antes de acessar/exportar produção**: verificar acesso de leitura, versão Postgres, esquema/roles, necessidade de capturar Auth/histórico/storage e inventário de objetos, espaço, destino local seguro e cronograma de retenção. Criar diretório privado fora do repositório e plano para dados pessoais. Não passar senha em argumentos, shell history ou relatório. Usar documentação oficial e `supabase db dump --help`; não executar comandos que imprimam credenciais. Planejar janela de consistência, pois dumps separados não garantem snapshot único entre si e Storage.
2. Depois da autorização e confirmação do destino seguro, executar o fluxo oficial para `roles.sql` (`--role-only`), `schema.sql` e `data.sql` (`--data-only --use-copy`), e tratar explicitamente histórico e alterações gerenciadas necessárias. Registrar somente SHA-256, tamanho e hora, sem conteúdo. Verificar quais esquemas e dados estão presentes; um exit 0 não garante backup completo. Backup separado de objetos Storage exige aprovação explícita, limites e preservação de bytes/metadados.
3. **Restauração escreve dados em destino:** preparar NOVA instância descartável local com containers/volumes próprios, rede isolada e sem conexões de produção. Nunca usar a stack local preservada como destino. Seguir a documentação oficial de restore para Postgres/Supabase e versões compatíveis; verificar roles, schema, RLS, grants, triggers, contagens e integridade referencial; comparar inventário e hashes sem exibir dados. Separadamente comprovar Auth e objetos de Storage quando aplicável. Não executar restore no banco de produção. Arquivo real não foi obtido, restauração e integridade não foram comprovadas; ensaio de restore de fixture também ficou pendente nesta sessão. Não chamar procedimento de backup verificado.
4. Se uma restauração equivalente não puder ser comprovada, **NO-GO para migration**. Não contratar serviço sem autorização. Documentação: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore e https://supabase.com/docs/guides/platform/backups .

## Publicação futura — todas as operações remotas abaixo exigem aprovação específica

1. Depois do backup verificado e nova auditoria de drift, aplicar `backend/migrations/20261030124528_tiktok_import_sessions.sql` somente com autorização específica; é transacional, altera tabelas/constraints/RLS/funções e pode causar locks. Conferir versão de migration, permissões, bucket e saúde da versão antiga. Não editar migrations antigas.
2. Após autorização para publicação, atualizar refs e conferir que não houve divergência. Em worktree próprio da main e com árvore limpa, executar merge normal de `origin/dev` e `git push origin main` sem force; isso dispara deploys de produção. Confirmar ambos deployments e testar login, biblioteca, player e upload MP4. Manter flag TikTok ausente/false.
3. Após aprovação separada, definir no projeto API Production `MEDIA_TIKTOK_ADMIN_USER_ID` como UUID do administrador designado, `MEDIA_TIKTOK_DOWNLOAD_MODE=temporary` e `MEDIA_TIKTOK_IMPORT_ENABLED=true`; rebuild/deploy necessário porque o yt-dlp só é empacotado com flag no build. Testar só vídeo autorizado pelo botão de teste privado, que não cria smoke. Botão normal publica. A restrição a um único admin é temporária: desenhar e testar migração posterior para todos os admins autorizados antes de ampliar.
4. Se falhar: interromper testes; rollback Vercel para deployment de produção anterior elegível e/ou `git revert -m 1 <merge>` (confirmar parent e histórico) seguido de push normal apenas com autorização apropriada. No Hobby rollback imediato só para o anterior; pode interromper auto-assignment de domínio e usa configuração do deployment antigo. Flags de projeto não são revertidas por rollback; desativar flag e reconstruir quando necessário, também exige autorização. Banco/Storage não voltam com código: manter schema aditivo; qualquer migration compensatória exige inventário, backup e aprovação específica. Não remover objetos publicados ou ambíguos.

## Próxima ação

Verificar commit/push remoto e saúde da stack local; obter autorização específica para exportar backup de produção e destino privado. Preparar antes um ensaio isolado usando apenas dados locais fictícios, sem tocar volumes existentes; depois, mediante aprovação e somente se adequado, exportar produção e comprovar restauração isolada. NO-GO para migration e ativação sem backup restaurável e aprovações.
