# Preview isolado — execução em 31/10/2026

Projeto novo: `pcdnades-preview-api` (`prj_ubCQuSm6ubSL6OrYahHV2ZmwdYyH`), sem conexão Git. Time Hobby Active confirmado, sem cartão/adicionais/upgrade. Recursos existentes não foram alterados. Nenhum Supabase de teste criado: depende do preflight nativo.

## Correções comprovadas

1. O primeiro envio falhou com `unused_function`: o glob `functions.src/server.ts` não corresponde ao empacotamento Fastify. Removido; a duração continua no export `config.maxDuration=120`. Builder Linux oficial confirmou Node24 e 120s sem o glob.
2. A API REST exige omitir `target` para Preview (`target:null` na resposta). O primeiro pedido com `target:preview` retornou Production/Error; não chegou a servir aplicação. Os pedidos seguintes omitem o campo e usam guarda de build que exige `VERCEL_ENV=preview`, sem forjar a variável. Nunca inicializar produção para destravar Preview.
3. Preview `dpl_BJV8PkaQRTDkxbmDfTG2PtjL9iV1` compilou mas devolveu HTTP500: runtime exigia default export HTTP. Adicionado adaptador Fastify que aguarda `ready`, emite request e não abre porta na Vercel. Execução local por `listen` preservada.

## Validação local desta correção

- Teste do adaptador falhou antes da implementação (export undefined) e passou depois, com HTTP real loopback `/health` 200 e sem bind automático.
- Backend: 106 testes passaram; typecheck e build Windows passaram.
- Guarda de build: Preview aceita; Production, Development e ambiente ausente recusam com exit42.
- Não são prova de funcionamento de TikTok na nuvem. O preflight testa integridade/execução dos três binários e encode/decode sintético de 0,2s, sem acessar TikTok ou Storage.

## Resultado real e bloqueio

Preview corrigido: `dpl_8FFKSRKDmPJWVQs3qYYQRr8PTmrr`, target null, URL https://pcdnades-preview-dthljtpoj-lipe-s-projects1.vercel.app . READY confirmado. Health200/configured=false. POST protegido200/pass: Node24.22.2/Linuxx64/uid993, tmp rw com538329088bytes disponíveis, hashes dos três binários PASS, yt-dlp2026.08.19, FFmpeg7.0.2-static e ffprobeN-66595. Encode/decodePASS em3375ms; CPU do processoNode2058163µs e RSS183037952bytes (não são consumo agregado dos subprocessos nem benchmarkTikTok30s). Sem bloqueio de execução observado, sem remount ou evasão.

Segredos/configuração de teste e logs privados permanecem exclusivamente em `backend/vendor/preview-live-20261031/`, ignorado. Nunca versionar o token, envs, vídeos ou evidências privadas. Nenhuma alteração em main ou flags de produção.

## Supabase e limites gratuitos

Organização `Lipe-meira''s Org` (`maalmxusvlnltyqhzjds`): conector confirmou plano Free e estimativa de projeto US$0/mês. A criação de `pcdnades-preview` em São Paulo foi recusada por `BadRequestException`: proprietário já tem dois projetos Free ativos. Nenhum projeto foi criado; não foram pausados, excluídos, atualizados ou migrados projetos existentes. Nenhuma chave Supabase foi copiada para o Preview. A estimativa0 não supera a restrição da conta.

Parada obrigatória antes de contornar limites ou tocar recursos existentes. Para retomar: usuário precisa disponibilizar um slot gratuito isolado (por ação/autorização específica, sem pausar automaticamente outros produtos), ou definir outra opção explicitamente. Não contratar plano pago. Depois: criar apenas projeto novo, aplicar migrations em ordem e configurar bucket privado/admin/envs Preview isolados, criar frontend de teste e executar E2E com vídeo autorizado. PreflightPASS não prova download TikTok pela rede Vercel nem Storage/player na nuvem.

## Git e segurança

Publicação somente `dev`, push normal autorizado, sem main/rebase/merge/force. Commits históricos preservados. Os dois projetos Vercel existentes têm produção vinculada a main; IDs de latestProductionDeployments permaneceram iguais após os pushes anteriores. O novo projeto não tem conexão Git e não faz deploy automático por push. O único job GitHub de backend revisado executa testes, sem deploy. Nenhuma flag de produção foi habilitada.

O servidor e buildguard foram enviados ao Preview a partir de ec0af61 com alterações locais identificadas; não corresponde a um checkout limpo desse SHA. A correção correspondente e este relatório são registrados no commit seguinte. Diretórios vendor/evidências, envs e tokens continuam ignorados; containers/volumes preservados. SHA final publicado deve ser consultado com git log e git ls-remote origin refs/heads/dev, evitando SHA circular no próprio commit.
