# Prévia TikTok — revisão da integração em 02/11/2026

## Resultado e limites da evidência

Preparação de código validada localmente; **GO para revisão em PR Draft, NO-GO para ativação**. O player e o pipeline privado já existiam na main `7443dc8`. Esta entrega corrige lacunas comprovadas e prepara a operação do coletor. Não habilita prévia, Instagram ou YouTube, não altera migrations nem publica em produção.

Os chats especializados existentes receberam tarefas separadas e trabalharam em novas branches a partir da mesma main. O orquestrador revisou as alterações e integrou o frontend localmente, sem editar a implementação especializada. Worktrees antigas, backups e laboratórios anteriores foram preservados.

## Frontend integrado

- `ad9cf6e`: posição atual acessível, aviso de prévia não importada/publicada, tratamento de `SOURCE_EXPIRED` antecipado pelo servidor, tanto no preparo quanto na renovação.
- `aa27824`: sincronização do indicador após erro/recarregamento, com reprodução RED anterior em desktop e celular; a renovação continua retomando posição e estado.
- `730e9ab`: documentação da limitação do laboratório, sem alteração adicional de código.
- Relatório especializado: `frontend/docs/TIKTOK-PREVIEW-20261102.md`.

A seleção manual, limite TikTok de 30 segundos, upload MP4, Solo Exec, player existente e contratos foram preservados. A prévia não cadastra smoke nem cria mídia final; a importação confirmada segue o fluxo já existente.

## Backend integrado

- `472f3c3`: registra `stopped` ao receber encerramento durante a espera entre ciclos; teste reproduziu o estado incorreto `healthy` antes do fix. Cadência, TTL, downloader e contrato permanecem iguais.
- `5adb870` e `e4b7ed1`: cinco testes adicionais de falhas do sweep, templates systemd inativos, exemplo de configuração sem valores e documentação/checkpoint.
- Relatório especializado: `backend/PREVIEW-OPERATIONS-20261102.md`. Backend reportou 39/39 testes direcionados e TypeScript; o orquestrador executou também a suíte completa integrada descrita abaixo.
- Templates foram revisados, mas não passaram por parser systemd nem instalação Linux. Não há host, serviço, alerta ou scheduler implantado por estes arquivos.

## Validação do orquestrador

Executada no novo worktree de integração, Node 24.21.0:

```powershell
Set-Location 'C:\Users\felip\.codex\worktrees\pcdnades-tiktok-preview-integration-20261102\nadesCs2\frontend'
npm ci --no-audit --no-fund
npm run build
npm test
$env:CI = '1'
npm run test:browser
```

- Build/TypeScript: PASS.
- Unitários: **58/58 PASS**.
- Playwright completo: **88/88 PASS**, 1,6 minuto, desktop e celular, dois workers. `CI=1` evita reutilizar servidores já existentes; portas 5174/5175 estavam livres antes da execução.
- A suíte de navegador usa fixtures controladas para API/Auth/Storage. Ela demonstra interação, fallback, expiração, renovação, limites, preservação do formulário e regressões visuais/funcionais; **não comprova integração real com Supabase**.
- Nenhum download externo de TikTok/Reels nem teste com escrita em produção nesta tarefa.

Backend integrado:

```powershell
Set-Location 'C:\Users\felip\.codex\worktrees\pcdnades-tiktok-preview-integration-20261102\nadesCs2\backend'
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
```

Build/TypeScript/empacotamento local Windows: PASS; **142/142 testes PASS**, zero falhas/skip, aproximadamente 7,5s. O build sem flags não empacotou yt-dlp, conforme guarda existente; isso não comprova o bundle Linux com importador habilitado nem a execução cloud. Os testes de sweep usam adaptadores controlados e não acessam o Supabase real.

## Laboratório real pendente

Novo laboratório privado planejado em `C:/Users/felip/AppData/Local/pcdnades-preview-ops-20261102-5491784d`, rede Docker interna, portas exclusivamente loopback 56721/56722/56731. A tentativa de bootstrap não disponibilizou Auth/Storage/API para o navegador. O backend comprovou que uma nova fixture HTTP responde 200 a um cliente na mesma rede Docker, enquanto o cliente Windows não alcança o bind loopback correspondente.

Isso identifica uma limitação de conectividade da tentativa atual; não demonstra defeito do pipeline nem impossibilidade de um laboratório Linux com os clientes dentro da rede. Não foi relaxado o isolamento. Falta validar preparo, Range, renovação, proprietário, expiração, recorte final e limpeza com Auth/Storage reais nesta entrega. Não substituir essa evidência por mocks.

Inventário novo preservado, segundo entrega backend: redes internas `pcdnades-preview-ops-20261102-private` e `pcdnades-preview-ops-20261102-loopback`; containers diagnósticos `pcdnades-preview-ops-http-diag-5491784d` e `pcdnades-preview-ops-client-diag-5491784d`, ambos parados. Nenhum novo volume correspondente observado após a parada automática da CLI. Logs privados não entram no Git. Ausência de serviços ativos não equivale a laboratório restaurável validado.

Próximo caminho a avaliar: executar os clientes e o navegador de teste dentro da rede Linux isolada, com bootstrap pequeno e revisado dos serviços novos. Antes de qualquer escrita, verificar novamente IDs, portas, URLs, inexistência de credenciais de produção e ausência de egress. Não executar scripts antigos com guardas de portas antigas ou importadores adicionais habilitados.

## Contrato e operação

`docs/preview-contract.md` permanece a referência. POST autenticado aguarda preparo e retorna 200 ready; GET renova apenas a assinatura. Bucket privado `import-previews`, assinatura até 60s, sessão imutável de 15min, sem embed/CDN. O heartbeat exige sweep completo e vale oito minutos; alvo de limpeza até cinco minutos. Falhas e sweep parcial não renovam saúde.

O runner e um health probe existem no código. Templates de supervisor não equivalem a serviço instalado; probe no mesmo host não detecta sozinho perda do host inteiro. A escolha de scheduler, observador independente e destino de alerta ainda precisa ser comprovada e aprovada antes da ativação. Não aumentar TTL para ocultar ausência de coletor.

## Segurança da preparação do PR

Inspeção somente leitura da Vercel em 02/11 confirmou Preview Branch Tracking OFF em `pcdnades` e `pcdnades-api`; Production Branch Tracking corresponde somente a `main`. Os dois deployments conhecidos da release continuam READY segundo o conector. Nenhum Save, alteração de variável ou deploy foi executado.

O workflow versionado `backend-linux.yml` executa verificações no PR e em push main; não implanta serviço nem usa segredos de Supabase. Revisão do diff não encontrou novos vídeos, arquivos de credenciais, cookies ou dados privados: `.env` de exemplo novo contém somente nomes vazios. As duas fixtures MP4 já versionadas anteriormente não foram alteradas. Configurações Vercel, workflows existentes e migrations não mudaram. Main, dev e branches dos agentes não serão sobrescritas.

## Critérios para prosseguir

1. Revisar e integrar a entrega final backend, executar testes afetados e build no conjunto.
2. Resolver o laboratório e demonstrar o caminho real Auth/Storage/FFmpeg/player/recorte, incluindo preservação e limpeza, sem publicação automática. Rotular a fonte externa fixture quando utilizada.
3. Escolher infraestrutura de coletor e monitoramento compatível com os recursos aprovados; demonstrar parada/atraso, heartbeat vencido, alerta e recuperação. Preparação de arquivos não basta.
4. Revisar Linux, dependências de runtime, limites e evidências; obter revisão do PR. Não habilitar novos importadores.
5. Solicitar separadamente autorização para infraestrutura remota, publicação e eventual flag de prévia. Nenhuma dessas operações está autorizada por esta entrega.

Até cumprir os itens operacionais e a integração real, manter `MEDIA_SOURCE_PREVIEW_ENABLED` desligado. A seleção por horários continua sendo o fallback existente.
