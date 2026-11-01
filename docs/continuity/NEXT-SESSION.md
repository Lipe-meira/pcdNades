# Prioridade vigente: auditoria pré-preview concluída

Leia backend/IMPORT-PREVIEW-AUDIT.md e IMPORT-PREVIEW-ARTIFACT.json, depois checkpoint do orquestrador. Base7b621a9,dev; entrega de auditoria em commit local próprio. ZIP oficialLinux204126812B/641arquivos,Node24/120s,binários755 executadosAL2023; /tmpnoexec impede yt-dlp, /tmp executável passou no ensaio. Confirmar condição real naVercel, sembypass.

Nenhum deploy/push/remoto autorizado/executado nesta auditoria. Próxima ação:conferirGit,lerplano e aguardar autorização explícita de preview gratuito/recursos novos; não iniciar cloud automaticamente. Não copiarcredenciaisprodução nemvendorprivado. Evidências/containers/volumes preservados. Preparar instrumentação segura de preview localmente antes do deploy autorizado; não repetirbenchmarks/downloads já válidos.

---

# Situação vigente — piloto TikTok30s implementado localmente

Leia primeiro backend/IMPORT-PILOT-30.md e o checkpoint do orquestrador. Usuário escolheu piloto síncrono30s/50MB, semworker. Windows/Linux102backendPASS;front55+64Playwright(+12TikTokfinal)PASS;recorteLinux eStorage/Reactplayer locais reais passaram com fixture autorizada já retida. Sem novo downloadTikTok/Vercelreal. Limites/upload/histórico/flags e evidências detalhados no relatório.

Primeira ação:conferirGit/log/status,lerrelatório e preparar auditoria de bundle/checklist de preview. NÃO publicar/push/merge/deploy/env/Supabase remoto/infra sem autorização específica. Docker está ativo,5serviços próprios locais saudáveis;5containerspiloto encerrados/retidos,privados/vendor ignorados preservados. Não repetir ensaios concluídos sem necessidade.

---

# Prioridade atual — investigação de capacidade concluída em31/10/2026

Leia primeiro `backend/IMPORT-CAPACITY.md` e `backend/IMPORT-CAPACITY-RESULTS.csv`, depois checkpoint do orquestrador. Os13benchmarks já terminaram: nenhum perfil90s coube no encoder40s/1vCPU. Proposta:worker para90s;API30s apenas candidata a piloto. Não alterar timeout/flag sem plano de orçamento e validação. Nenhum runtime mudou, nenhuma publicação autorizada.

Docker daemon estava indisponível ao retomar; estado individual atual não reconfirmado. Não recriar/remover recursos nem repetir downloads/matriz. Dados privados/evidências/órfãos ficaram preservados em vendor ignorado. Recuperação local real com MP4 retido preservou vídeo publicado; detalhe no relatório. Próxima ação:conferirGit e decidir arquitetura conforme checklist do relatório. Sem push/deploy/Supabase remoto/infra paga.

---
# Retomada do importador TikTok — dev

Atualizado em31/10/2026, America/Sao_Paulo. Este é o resumo vigente para uma nova sessão; checkpoints abaixo dos marcos atuais contêm histórico superado.

## Conferir antes de agir

Worktree: `C:\Users\felip\.codex\worktrees\pcdnades-dev\nadesCs2`. Repositório/origin: `https://github.com/Lipe-meira/pcdNades.git`, branch `dev`.

```powershell
git status --short
git remote -v
git branch --show-current
git fetch origin
git rev-list --left-right --count origin/dev...dev
git log -5 --oneline
```

Não descartar alterações ou incorporar branches automaticamente. Na entrega de continuidade, dev partia deorigin/dev=`b290e43` e tinha somente estes três commits locais, sem commits remotos exclusivos:

- `f7bdbba`: implementação revisada e proteção do Storage.
- `32ac6b3`: documentação/checkpoint.
- `3da729a`: evidência E2E com Supabase local real.

Um commit específico de documentação acompanha esses três na publicação autorizada. Obter seu SHA com `git log -1`; verificar HEAD/origin/dev antes de retomar. Nenhum código mudou após os testes registrados.

## Arquitetura vigente

1. Administrador consulta `/api/v1/media/imports/inspect`. Auth real eRPCis_admin protegem a operação. O servidor usa yt-dlp fixado/verificado, proxyCONNECTlocal, DNS/IP/hostnames/portas validados, limites de rede/tempo e registra uma sessão privada com snapshot.
2. Frontend seleciona início/fim e envia `{sourceId, clip}` para `/api/v1/media/imports`. Sessão/seleção imutáveis e criação idempotente retornam o mesmo mediaId na repetição.
3. `/api/v1/media/:id/complete` reivindica lease/CAS e slot global; GETstatus apenas observa. Estadosqueued/processing/ready/failed; prazo global110s, finalização5s, lease120s, atéduas tentativas.
4. `MEDIA_TIKTOK_DOWNLOAD_MODE=temporary` revalida o snapshot e executa **extração+download na mesma chamada yt-dlp**, pelo proxy protegido, no formato exato escolhido. Sem cookies/config de contas ou intervenção manual em challenge. Isso funcionou no exemplo autorizado; URL/headers separados pelo relay receberam403.
5. Fonte fica somente no diretório temporário do job. ID, tamanho, duração, codec e dimensões são verificados. FFmpeg lê arquivo local, recorta, gera MP4H264/yuv420p/AAC; probe/decode validam a saída. Só `clip.mp4` validado é enviado ao Storage privado; fonte e temporários são removidos nofinally.
6. `ready` é gravado após o Storage, por CAS. Granada só aceita mídiaready por trigger. Playback assina a chave armazenada; não consulta TikTok. O frontend renova a URL e preserva posição/player compacto ou amplo.

Limites: saída até90s/50MB ou política menor configurada; fonteTikTok até7200s dentro de100MB/32conexões de mídia. Não se garante obtenção de qualquer arquivo de2h. UploadMP4 mantém política própria de fonte180s/50MB e saída90s. YouTube/Instagram seguem desativados.

Default de disponibilidade continua `MEDIA_TIKTOK_IMPORT_ENABLED=false`; default de modo é `range`. Para reproduzir o caminho que passou, usar explicitamente `temporary` **somente no processo/ambiente local aprovado**. Não existe fallback automático depois403.

## Evidência válida, sem repetir testes de rede à toa

- Supabase local real: login pelo frontend → TikTok autorizado7701782883760983303 → trecho10–20 → Storage → ready → smoke → reprodução no Chromium, sem mocks no fluxo principal.
- Saída10,000s/H264/AAC/1080×1920/2.761.164bytes. Inicialmente um único objeto final, sem fonte inteira. Playback funcionou com hosts externos bloqueados, seek e renovação real de URL.
- Falhas: Storage interrompido, transferência abortada, consulta cancelada, slot concorrente, repetição e resposta deready perdida. Alguns casos reutilizaram o MP4 já validado em etapa de processamento controlada; banco/RPC/Storage permaneceram reais. Não chamar esses casos de novas importações completas da plataforma.
- Linux: build/typecheck,92 testes, bootstrap, binários/hash/permissões, smokes e NFT passaram. Trace203.951.326bytes,9avisos,sem.env. Windows também tinha92 testes/build aprovados.
- Frontend55 testes/build aprovados.64 testesPlaywright com APIcontrolada passaram na etapa anterior; a etapa mais recente acrescentou browser com serviços reais. Não houve mudança de código depois dessas verificações.
- Banco local/PostgreSQLWASM também teve34 verificações de schema/RLS/RPC/triggers; essa evidência é separada do Supabase real.

Comandos locais da raiz, com dependências e binários preparados:

```powershell
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:browser -- --workers=1
& backend/node_modules/.bin/tsx.cmd backend/scripts/import-temporary-smoke.ts
& backend/node_modules/.bin/tsx.cmd backend/scripts/import-relay-smoke.ts
node backend/scripts/import-sql-smoke.mjs
git diff --check
```

PGlite/NFT são ferramentas isoladas; instalação e caminhos em `backend/IMPORT-VALIDATION.md`. Os smokes acima são fixtures locais, não downloads TikTok reais. Não executar scripts de plataforma sem confirmar autorização/objetivo.

## Estado local preservado

- Stack própria `pcdnades-e2e-20261031-a7f4`: DB55422,Auth/REST/Storage55421,backend55430,frontend55431, todos127.0.0.1.
- Seus seis containers estão parados; os três volumesDB/Storage/node_modulesLinux foram preservados. Nenhum recurso preexistente foi removido/limpo. Não assumir que endpoints continuam disponíveis.
- `backend/vendor/local-integration-20261031/` não é rastreado e continua ignorado: configurações, scripts operacionais, imagens de evidência, MP4s de teste, logs e credenciais locais ficam **somente neste computador**. VolumesDocker também não são publicados peloGit. Uma nova máquina não receberá esses dados.
- Não imprimir/versionar `state.private.json`, `status.private.json` ou logs privados. Não sobrescrever.env. Para retomar a stack, conferir manifesto/portas, iniciar só seus containers e usar `serve.mjs`; `browser-playback.mjs` reutiliza a smoke existente sem novo TikTok. Procedimento detalhado em `backend/IMPORT-LOCAL-E2E.md`.
- Banco final:3ready,2failed,1queued de fixture; nenhumprocessing/slot retido. Três objetos finais,8.283.492bytes, sem fonte inteira. A fixturequeued não tem worker executando.
- DB foi reiniciado e consultado após encerramento; dadosready/metadados preservados. Relatório registra códigos de saída e encerramento forçado inicial, sem esconder as limitações desse ensaio.

## Próximas tarefas, nesta ordem

1. **Orçamento de encoding90s:** benchmarkLinux2vCPU/2GiB levou57,004s, picoFFmpeg≈263MiB, enquanto o encoder temporary tem40s. Corrigir/definir política com regressão local real; considerar download, probe, decode e Storage dentro dos110s globais. Não simplesmente aumentar tudo ou prometer90s/1080p prontos.
2. Validar fluxo90s completo com mídia autorizada e recuperação após timeout/kill; concorrência entre instâncias e órfãos. Preservar limpeza conservadora: remover só chave da tentativa apósfailed confirmado, nunca objeto deready ambíguo.
3. Melhorar erro de publicação com mídia inválida: o trigger protege os dados, mas o PATCH hoje retorna DATABASE_ERROR503 genérico.
4. Avaliar hospedagemVercel: bundle real, cold-start, CPU/RAM/disco, execução dos binários, rede e prazos. LinuxDocker passou, Vercel não foi validada. Caso umworker seja necessário, documentar arquitetura/custos e obter autorização antes de provisionar.
5. Só após revisão/testes e aprovação explícita: planejar migrations/configuração remotas, habilitação, integração na main e deploy. Publicação de código na dev não habilita produção.

## Segurança e leitura inicial

Sem force-push/rebase/merge automático, novas plataformas, cookies privados, login de terceiros, DRM, proxies de evasão ou remoção de recursos alheios. Nenhuma autorização de produção é inferida de testes ou checkpoints. A autorização de publicação atual é somente `git push origin dev` normal após revisão; não cobre deploy/flags/envVercel/SQLremoto.

Ler: `AGENTS.md`, `README.md`, este arquivo, `docs/continuity/orchestrator.md`, `backend/IMPORT-LOCAL-E2E.md`, `backend/IMPORT-AUDIT.md` e o código dos módulosimport-runtime/import-network/import-processing/clip-storage. `TIKTOK-IMPLEMENTATION.md` conserva o contrato inicial; seu trecho de relay deve ser lido como histórico diante do modo temporário vigente.

Prompt curto para próxima sessão:

> Continue pcdNades na dev deste worktree. Leia AGENTS.md e docs/continuity/NEXT-SESSION.md, confira Git e preserve dados/commits. O E2E real local de10s passou; priorize o orçamento de encoding90s(57s medidos versus40s atuais), com teste local e sem reescrever o downloader sem regressão. Não faça deploy, push, merge, alteraçãoVercel ou escritaSupabaseremota sem nova autorização.
