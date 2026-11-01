# Auditoria pré-preview do backend TikTok

Data: 31/10/2026, America/Sao_Paulo. Branch `dev`, base `7b621a9`.

## Parecer

O backend é candidato a um preview isolado, com condições de validação ainda abertas. O payload local empacotado cabe no limite padrão, os binários executaram em Amazon Linux 2023/Node24 e a duração foi fixada em120s no artefato. Isso não comprova deploy, cold start, rede/CDN ou permissões do filesystem da Vercel.

Principal condição nova: o executável Linux do yt-dlp precisa carregar bibliotecas temporárias em uma montagem que permita execução. Com `/tmp noexec` ele falhou; com `/tmp` executável passou. Não alterar proteções do provedor nem contornar um bloqueio: se esse requisito não for atendido no preview, parar a importação e reavaliar a distribuição/runtime antes de habilitar.

Nenhuma API de conta Vercel/Supabase foi utilizada. Nenhum push, deploy, link/pull Vercel, migration remota, env remota, contratação ou escrita em Supabase local foi realizado. Foram usados documentação pública, pacotes npm públicos, Docker local e imagem oficial AWS. Recursos anteriores preservados.

## Artefato Linux efetivamente empacotado

Metadados sanitizados versionados: `IMPORT-PREVIEW-ARTIFACT.json`. O ZIP foi produzido pelo builder oficial de Fastify, não apenas estimado por NFT.

| Medida | Resultado |
|---|---:|
| Arquivos do ZIP |641|
| Descompactado |204.126.812 bytes (204,13 MB /194,67 MiB)|
| ZIP |100.995.069 bytes|
| Folga para teto conservador de250.000.000 bytes |45.873.188 bytes|
| Runtime |nodejs24.x|
| Node do build/teste |24.22.2|
| maxDuration emitido |120s|
| Framework |Fastify5.12.7|
| Builder Fastify / Node |24.0.1 /29.0.1|

O SHA256 do ZIP está no JSON. Repetição usando `scripts/audit-vercel-artifact.mjs` gerou ZIP bit a bit igual ao submetido ao ensaio AL2023. CRC de todos os membros passou; os641conteúdos descompactados conferem com os objetos usados pelo builder. Não há symlinks, `.env`, mídias, credenciais ou diretórios privados de ensaio no pacote.

A documentação limita o tamanho descompactado padrão a250MB, incluindo layers do runtime. Nosso payload local fica abaixo desse valor; launcher/layers finais e validação do artefato servido continuam sendo responsabilidade da plataforma, ainda não testada. A pasta `index.func` materializada serve para inspeção local: não é um deploy `vercel build --prebuilt` validado nem substitui o output/roteamento gerado pelo CLI autorizado. Não enviar o ZIP manualmente como se fosse toda a configuração do deploy. [Limites oficiais](https://vercel.com/docs/functions/limitations).

### Procedimento de build

1. Exportação limpa do backend a partir do Git para uma pasta nova, sem os arquivos ignorados do worktree.
2. Imagem oficial `node:24-bookworm-slim`, Linuxx64; `npm ci --ignore-scripts` com lockfile. Dependências instaladas de novo; somente o binário FFmpeg já retido foi usado como cache e verificado pelo hash fixado. yt-dlp Linux retido também passou no hash fixado.
3. `MEDIA_TIKTOK_IMPORT_ENABLED=true npm run build`, apenas no processo local do build. Isso prepara o binário; não grava variável nem habilita produção.
4. Builder `@vercel/fastify`, que usa `@vercel/node`, com detecção real de `src/server.ts`, compilação TypeScript e rastreamento. Install do builder foi pulado porque o `npm ci` limpo já havia concluído; o build do usuário foi executado pelo próprio builder.
5. ZIP real via `Lambda.createZip()`, manifesto, contagem de bytes/modos/hashes, checagem CRC e execução do payload.

O build usou Debian12; o runtime foi adicionalmente testado na imagem oficial `public.ecr.aws/lambda/nodejs:24` (Amazon Linux2023). Isso reduz a diferença de ABI em relação ao alvo, mas não reproduz os serviços, sandbox, launcher ou infraestrutura proprietária da Vercel. [Build image Vercel](https://vercel.com/docs/builds/build-image), [imagem AWS Node24](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-image.html).

## Binários, versões e integridade

Todos incluídos, com modoUnix0755, executados como UID10001, rootfs readonly e rede desabilitada:

| Binário | Bytes | Versão observada |
|---|---:|---|
| FFmpeg |79.826.272|7.0.2-static|
| ffprobe |78.926.144|N-66595-gc2b38619c0-static|
| yt-dlp |40.446.224|2026.08.19|

Os três somam199.198.640bytes, aproximadamente97,6% do payload. Não há cópia redundante de `vendor/ffprobe` no ZIP. O pacote Windows do yt-dlp é menor e não serve de referência de tamanho/ABI para Linux.

FFmpeg e yt-dlp conferem com os SHA256 fixados pelo projeto. ffprobe veio do pacote Linux verificado pelo lockfile/npm ci e sua cópia no artefato confere com a origem instalada; o hash observado completo está no JSON. Nenhum binário foi atualizado ou substituído por outra versão nesta auditoria.

Correção de nomenclatura: `b6.1.1` é o identificador do asset/release usado pelo instalador, não a versão reportada pelo FFmpeg Linux desse asset. O log agora diz `FFmpeg release asset b6.1.1`; o binário observado é7.0.2. Evidências de performance anteriores continuam válidas para os hashes registrados, mas não devem chamar o binário Linux de FFmpeg6.1.1.

No AL2023 passaram: versões dos três, encode curto H.264/yuv420p+AAC, probe dos codecs, decode completo desse clipe curto, import do payload, `/health` e falha fechada de escrita sem configuração. Não houve extração/download TikTok, nem reexecução dos benchmarks30s/E2E já concluídos.

### `/tmp`: experimento controlado

Com a mesma imagem, usuário, payload e limites1vCPU/2GiB:

- Montagem padrão do tmpfs Docker: `rw,nosuid,nodev,noexec`; yt-dlp encerra127 com `libz.so.1: failed to map segment from shared object`.
- Apenas mudando a montagem LOCAL para permitir execução: versões, encode/decode e backend passaram. A alteração foi do ensaio A/B, não de Vercel ou de política de produção.

Essa é evidência de dependência do loader em execução/mapeamento de bibliotecas temporárias. Não prova que Vercel use `noexec`. Espaço e flags reais de `/tmp` continuam desconhecidos;512MiB foi orçamento escolhido no Docker. Antes de downloads no preview, verificar statfs/montagem e invocação curta dos binários no ambiente real. Se o provedor bloquear, não tentar remount, proxy ou bypass. O downloader funcional permanece intacto.

## Nove warnings de empacotamento

Capturados do próprio builder com `VERCEL_BUILDER_DEBUG=1`, sanitizados no JSON:

- Seis avisos de parse: cada ELF (FFmpeg,ffprobe,yt-dlp) foi tentado como script e módulo JavaScript. Os arquivos foram incluídos integralmente; hashes e execução real passaram. Não são erros de sintaxe do backend.
- Três dependências não encontradas: `yt-dlp.exe`, `ffmpeg.exe` e ffprobe `win32-x64`. São branches Windows; Linuxx64 usa os três ELF presentes. Não adicionar binários Windows para silenciar esses avisos e aumentar o ZIP.

Não houve warning de dependência Linux faltante nesse trace. Não ocultar warnings novos: o script os preserva para revisão. Pacotes de auditoria foram instalados em diretório isolado; não entraram em dependencies/lockfile do aplicativo.

## Correções locais comprovadas

- `package.json` e lockfile: Node fixado em`24.x`, antes`>=22`, que permitia mudança de major. O builder emitiu`nodejs24.x`. [Seleção de versão](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- `vercel.json`: comandos explícitos `npm ci --ignore-scripts` e `npm run build`; `functions.src/server.ts.maxDuration=120`.
- Entrypoint exporta `config.maxDuration=120`, confirmado no objeto Lambda real. Sem aumento dos timers75/90/110 ou do lease120. [Configuração de duração](https://vercel.com/docs/functions/configuring-functions/duration).
- `.vercelignore`: allowlist de package/lock/config/src e três scripts de preparação. Bloqueia vendor privado, `.env`, testes, mídias e diagnósticos no upload de fontes; binários são gerados pelo build. Há10caminhos permitidos e9bloqueados verificados em fixture Git-compatible. Isso não é prova de uploadCLI real, que só poderá acontecer após autorização. A fonte do futuro deploy deverá ser uma exportação limpa adicional. [Exclusões Vercel](https://vercel.com/docs/deployments/vercel-ignore).
- Novo script reutilizável `scripts/audit-vercel-artifact.mjs`: empacota e verifica runtime/duração/arquivos/binários, preserva warnings e recusa resultado existente ou credenciais de serviço herdadas. Não faz link/pull/deploy.

Typecheck/build/bootstrap locais passaram após as mudanças. Bootstrap capturou listen como esperado; runtimeAL2023 iniciou o payload real. As102regressõesbackend/55frontend/64browser(+12TikTok) de7b621a9 não foram repetidas: não houve mudança no pipeline, upload, contratos ou UI nesta auditoria. Não chamar esse reaproveitamento de nova rodada de testes.

## Infraestrutura e orçamentos

O estado remoto não foi consultado. A observação anterior era Hobby/Fluid/1vCPU/2GB/iad1/120s; as declarações locais agora fixam Node24 e120s. A documentação Hobby atual prevê1vCPU/2GB e duração máxima300s, mas não há razão para aumentá-la aqui. O artefato local de120s foi verificado; o deployment real deverá confirmar o mesmo valor.

-75s: processamento desde a entrada noFastify, incluindo custo anterior deAuth/consulta. Não inclui coldstart do launcher antes da requisição alcançar a aplicação.
-90s: prazo do trabalho/Storage desde a mesma referência. Se processamento usa75s, restam pelo menos15s até esse teto.
-110s: última espera da limpeza local; transiçõesfenced5s, cleanupStorage2s e releaseslot2s têm limites separados.
-120s: lease/slot e duração daFunction. Há folga nominal, não SLA; atraso do runtime, chamadasSDK subjacentes ou encerramento abrupto exigem teste real.

SDKAuth e assinatura/removalStorage podem concluir requisições subjacentes depois que a espera foi abortada. Guardas impedem começar publicação tardia; uma resposta perdida apósready continua sendo resultado ambíguo preservado, sem remoção perigosa. Clientecomplete150s permite receber/resumir estado; não amplia tempo do servidor. Cancelar UI pausa observação, não cancela um job durável.

Global slot limita a uma inspeção/importação por vez entre instâncias e active local serializa o processo. Isso não reserva uma CPU inteira: tráfego de consulta e invocaçõesFluid podem compartilhar recursos. Não aumentar concorrência no piloto. Lease perdido não deve permitir publicação por tentativa antiga.

Fonte50MB requer pelo menos~1,25MB/s para baixar em40s, sem contar extração, TLS e outros custos. Na prática o orçamento75s também precisa conter transcode/validação; não prometer todas as fontes de50MB ou2h. CDN403 em IP de datacenter ainda é risco, independentemente do teste residencial anterior. Sem cookies privados, evasão ou falsa conclusão.

Tmp precisa acomodar fonte, saída/faststart e arquivos do loader. Memória do PUT inclui leitura/cópia do MP4, além de Node e subprocessos.1CPU/2GiB passou nas amostras anteriores, mas a auditoria de ABI curta não mede pico do fluxo50MB. Interrupção total do processo pode deixar temporários/objetos órfãos; manter evidências e rechecagem de referências, nunca apagar objetos publicados ou resultado ambíguo.

### Duração20s e upload independente

Defaults do código e `.env.example`: upload90s/50MB; capabilityTikTok30s/50MB. Verificados pelo import do código empacotado no AL2023. Injetar configuração20s reduz TikTok a20s por desenho: portanto nenhuma conclusão sobre variável remota não consultada é possível. No novo preview usar explicitamente90 global e exigir capabilitiesupload90/TikTok30 antes de qualquer importação. Não usar global30 para limitar TikTok. Não alterar configuração dos projetos existentes.

## Plano proposto de preview — ainda NÃO autorizado

### Recursos novos e isolamento

1. Dois projetos Vercel NOVOS de teste, por exemplo`pcdnades-preview-api`(rootbackend) e`pcdnades-preview`(rootfrontend), sem conexãoGit/autodeploy. Nenhuma alteração nos projetospcdnades/pcdnades-api existentes, main, seus domínios, envs ou deploys.
2. Somente deploys targetPreview nesses projetos. Reservar dois aliases exclusivos de teste antes dos builds; isso permite configurarCORS eVITE_API_URL sem redeploy de ajuste. Se nomes estiverem ocupados, resolver nomes antes de enviar builds. Alias de teste não promove deployment de produção.
3. Um projeto Supabase NOVO e descartável de teste, por exemplo`pcdnades-preview`, separado do projeto real, na organização previamente indicada pelo usuário, SãoPaulo. APItesteiad1 para reproduzir a configuração observada; medir também latência entre regiões. Confirmar disponibilidade/custo antes de criar.
4. Não copiar envs dos projetos antigos nem dados de produção. Todas as chaves e o usuárioAuth pertencem exclusivamente ao novo projeto. O frontend recebe só URL/publishable; nunca secret/service_role.
5. Decidir acesso da API de preview antes do deploy: VercelAuthentication pode bloquearfetch entre domínios. Plano simples é liberar apenas essa API NOVA na camada Vercel, mantendo JWTadmin/RLS para escritas e só fixtures autorizadas nas leituras públicas previstas pelo produto. Registrar essa escolha na autorização; não colocar bypasssecret no frontend nem desativar proteção dos projetos reais.

### Banco, Storage e administrador

Após autorização, conferir projectref/organização/nome/teste e banco vazio antes de qualquer escrita. Aplicar exclusivamente nesse projeto, em ordem:

1.`001_initial.sql`;
2.`002_maps.sql`;
3.`003_media_import_sources_and_40_seconds.sql`(o conteúdo vigente amplia para90s);
4.`004_grenade_origin.sql`;
5.`20261030124528_tiktok_import_sessions.sql`.

Não editar migrations históricas nem aplicá-las no projeto real. Não há migration nova para o piloto30s. Verificar constraints, funções, triggers, RLS, grants de service_role nas tabelas públicas e grantsauthenticated de is_admin; conferir pelo catálogo antes de eventual bootstrap estreito de permissões no TESTE. Se estrutura inesperada já existir, parar, não sobrescrever.

Bucket`videos-staging`: privado, limite50.000.000bytes, MIMEvideo/mp4, conforme001. Não tornar público nem conceder escritaStorage anônima. Criar usuárioAuth descartável confirmado e associar seuUUID àprivate.administrators no TESTE; verificarpublic.is_admin porJWT real. Sem senha/token em relatório ouchat. Conferir sucesso deJWT anônimo/usuário comum/admin nas permissões esperadas. Registrar migrations e projectref só em estado operacional privado adequado.

### Variáveis necessárias

Todos os valores de URL/chave devem ser do ambiente NOVO, separados por projeto/targetPreview. Valores sensíveis não são reproduzidos aqui.

| Backend | Política planejada |
|---|---|
|SUPABASE_URL|URL do projeto de teste|
|SUPABASE_PUBLISHABLE_KEY|Publishable de teste|
|SUPABASE_SERVICE_ROLE_KEY|Secret/server key de teste; somente backend|
|CORS_ORIGINS|Apenas aliasfrontend de teste|
|FRONTEND_URL|Aliasfrontend de teste, para radares|
|MEDIA_UPLOAD_ENABLED|true no teste|
|MEDIA_TRIMMING_ENABLED|true no teste|
|MEDIA_PROCESSOR_MODE|inline-original|
|MEDIA_MAX_BYTES|50000000|
|MEDIA_MAX_DURATION_SECONDS|90; confirmar capabilityimport30|
|MEDIA_TIKTOK_DOWNLOAD_MODE|temporary|
|MEDIA_TIKTOK_IMPORT_ENABLED|SomentePreview autorizado; defaults/produçãofalse|

Frontend: `VITE_DATA_MODE=api`, `VITE_API_URL`(aliasAPI de teste+/api/v1), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` do teste. Sem outras chaves.

Não é necessário `DATABASE_URL` no backendAPI; só o worker legado usa essa variável. Não configurarworker. `STORAGE_BUCKET` não é consumido pela API atual; bucket usado é o nome fixovideos-staging. Não assumir que mudar essa env redireciona Storage. `PORT`/`HOST` são do runtime/entrypoint, não copiar portaslocalhost. Nenhuma variávelglobal de produção deve ser editada.

### Sequência de validação e medições

Antes de cloud: revisar commit/artefato/manifesto de fontes, preparar instrumentação temporária administrativa exclusiva do preview e validá-la localmente. Esta instrumentação real de host ainda é pendência, não uma rota já entregue no produto. Ela deve emitir sóversões,flags/tmp,tempo,bytes,CPU/RSS/disco e códigos, sem envs completos, argumentosURLs,stderr bruto,headersvalores ou cookies.

Após autorização:

1. Verificar cotas e custo; se qualquer operação exigir cobrança, parar. Criar recursos novos ealiases; provisionar/configurar somente teste. Garantir envs não herdadas.
2. Fazer um deploy controlado de API e um de frontend, ambosPreview e semautodeploy. Validar o artefato efetivo do CLI/plataforma, runtime24,duração120,binários/hash/mode,ausência de.env e mídias. Não enviar diretamente a pasta auditada como deployprebuilt completo.
3. Preflight real: `/tmp` flags/statfs, versões/binários, pequenoencode/decode, bootstrap/coldstart. Se yt-dlp não carregar normalmente, parar sem bypass. Testarcapabilitiesupload90/import30; falhar a validação se anunciar20/90 indevidamente.
4. Usar somente fonteTikTok com autorização confirmada. Primeiro o exemplo já autorizado de33s, com30s selecionados dentro dele. Para fonte significativamente mais longa e seleção tardia, obter link autorizado adicional com tamanho/duração apropriados antes do teste; não escolher tutorial aleatório de terceiro. Respeitar rate limits, semSQL para burlar contadores.
5. Validar0,1s/30s/>30s, início/fim tardios/fim fora da fonte, fontes perto50MB e tamanho não anunciado quando houver fixture autorizada. Fluxo realmetadata→download→recorte→probe/decode→Storageprivado só final→ready→smoke→player/seek/renovação, bloqueando plataforma original no playback. Falha nunca publica.
6. Medir separadamente: coldstart/módulo,Auth/DB,extração,download,probe,encode,decode,Storage,CAS/cleanup,total. Registrar HTTPstatus/código/estágio,bytesorigem/saída/tráfego,CPU e picoRSS/tmp. process.cpuUsage cobreNode, nãoFFmpeg: usar métricas do filho via/proc/cgroup quando permitidas ou parse numérico seguro de benchmark, nunca confundir comCPU total daFunction. Marcar indisponível se sandbox não expuser; não inventar zero.
7. Repetir amostrasfrias/quentes e conteúdoH264/HEVC,30/60fps,complexidadeCS2. Resultados locais17sencode/30s são baseline, não SLA; não aprovar com uma única amostra. Nenhum aumento de timeout para forçarPASS.
8. Faults no TESTE:Storage recusado/timeout,resposta perdidaapósready,cancelamento daobservação,dois pedidos concorrentes,duas instâncias quando viável,interrupção e expiração natural120s. Validar retomada/idempotência/tentativasfenced; guardar uma smokecontrole publicada e comparar referência/hash antes/depois. Não excluir objeto publicado ouambíguo. Logs/traces/signedURLs ficam privados e foraGit.
9. Parar após relatório: manterproduçãofalse e projetos reais intactos. Não promover/deploymain/push/habilitarprodução como consequência automática. Remoção posterior dos recursos descartáveis também deve seguir autorização própria; não limpar recursos preexistentes.

## Custos e condição de execução

Nenhum custo de serviço contratado nesta auditoria. Houve uso deCPU/disco/rede locais para npm/imagens públicas. A nova pasta de evidências ocupa aproximadamente1,37GB; imagens/cacheDocker são adicionais e preservados.

VercelHobby pode acomodar o preview dentro das franquias, mas uso/cotas da conta não foram consultados; não prometer saldo disponível nem ausência de rate limit. Referência oficial:4hCPUativa/mês,360GB-hmemória,1milhão de invocações. [Uso e preços](https://vercel.com/docs/functions/usage-and-pricing).

SupabaseFree oferece500MB de banco,1GBStorage,5GBegress e no máximo2projetos ativos; pausa após1semana sem uso. Não sabemos se há vaga gratuita na organização/conta. Pro começa emUS$25/mês, com projetos adicionais a partir deUS$10/mês; não está autorizado. Se não houver criação sem cobrança, interromper e apresentar alternativa/custo ao usuário, sem reutilizar projeto de outro produto ou ativar plano pago. [Preços Supabase](https://supabase.com/pricing).

## Continuidade e reprodução local

Evidências em `backend/vendor/audit-preview-20261031/`, ignoradas: fonteexportada,lockfile das ferramentas,ZIPs/manifestos,logs de trace e runtime,experimento noexec/exec efixture deignore. Nenhum dado/Supabase real foi copiado. Todos os containers desta auditoria terminaram; o exit1 do primeiroAL2023 é a falha esperada investigada de/tmpnoexec, nãoOOM. Containers/volumes anteriores,stackSupabase e outros projetos não foram modificados.

Script versionado, executável em containerLinux24 sem credenciais, com dependências/bináriosLinux já preparados e diretório de resultado novo:

```sh
node backend/scripts/audit-vercel-artifact.mjs BACKEND_EXPORT TOOLS_DIR NEW_OUTPUT_DIR
```

TOOLS_DIR precisa do builder oficial e utilitários; versões e lockfile deste ensaio estão registrados nas evidências. Não executarvercelbuild--yes/link/pull sobre projetos reais para reproduzir: isso pode buscar configurações/envs remotas. Somente após autorização usar CLI sobre os projetos NOVOS de teste. [CLIbuild](https://vercel.com/docs/cli/build),[Fastify](https://vercel.com/docs/frameworks/backend/fastify).

Próxima ação: conferirGit/status e este relatório; pedir autorização específica para o plano gratuito de preview, incluindo criação dos doisprojetosVercel,projetoSupabase isolado,migrations/admin/bucket de teste,envsPreview,aliases e umdeploy de cada. Se custos/permissões impedirem, parar antes de criar. Ainda falta prova de rede,filesystem e execução naVercel, não de novo benchmarkDocker.
