# Piloto TikTok30s — implementação local,31/10/2026

## Estado e decisão

Piloto implementado na dev, base87814b3, com mudanças exclusivamente locais. Não houve push, merge, deploy, Supabase remoto, migration remota, alteração Vercel ou contratação. Preservadosf7bdbba/32ac6b3/3da729a/87814b3. Não habilitado em produção.

A escolha do usuário foi piloto síncrono na Vercel Hobby, sem worker nesta etapa. Resultado é candidato a preview isolado, não aprovação da Vercel nem promessa de importar todas as fontes. E2E original com download TikTok real está em IMPORT-LOCAL-E2E.md; aqui não repetimos download externo.

## Política efetiva

| Item | Piloto TikTok |
|---|---|
| Fonte | Até50.000.000bytes; duração até7200s; pode exceder30s. Fonte longa também precisa caber no prazo. |
| Seleção | 0,1–30s, início/fim em qualquer posição válida; precisão0,001s. |
| Saída | Até50.000.000bytes; MP4/H.264/yuv420p/AAC ou sem áudio, probe+decode completo antes de Storage/ready. |
| Encoder temporary | superfast,CRF23,uma thread,faststart,até30fps; proporção/orientação preservadas, sem upscale, máximo1920×1080 ou1080×1920. |
| Rede | Reextração:8MB/16conexões; sessão nativa:60MB/32conexões de tráfego TLS bidirecional, separados do teto de arquivo50MB. |
| Publicação | Somente MP4 final privado, somente apósready; URL assinada pela API existente. |
| Ativação | MEDIA_TIKTOK_IMPORT_ENABLED=false por padrão; temporary permanece opt-in. Não mudar defaults nesta entrega. |

O teto de importação é min(30,MEDIA_MAX_DURATION_SECONDS); teto de saída min(50MB,MEDIA_MAX_BYTES). Upload independente mantém sua política existente90s/50MB e fonte de recorte180s. Não definir a variável global como30 para limitar apenasTikTok. Caso ambiente antigo esteja em20s, piloto também anunciará20s; conferir apenas no futuro ambiente de teste autorizado. Nenhuma env privada lida para relatório ou modificada.

Schema/RPC históricos90s foram mantidos; não precisa migration. API impede novas seleções>30. Complete de ready antigo é idempotente e não reprocessa. Queued histórico>30 retorna IMPORT_PILOT_LIMIT antes de claim/escrita, inclusive com configuração global20s: mantém seleção, status, tentativas, objeto e possibilidade de atendimento futuro. Processing com lease válido segue observado até expirar. Não converter histórico emfailed só porque o piloto diminuiu o teto.

Fonte conhecida>50MB é recusada na seleção do formato. yt-dlp recebe max-filesize50MB; quando tamanho não é anunciado, guard do arquivo nativo mede crescimento a cada50ms, aborta downloader/proxy ao detectar excesso e stat final bloqueia publicação. O arquivo pode ultrapassar transitoriamente o teto entre amostras; orçamento de rede60MB limita esse overshoot, não equivale a cota de disco exata50MB. Fonte temporária nunca é enviada ao Storage. LimitesSSRF/DNS/redirects/hosts/permissões/admin continuam existentes; sem cookies privados/login/proxy de evasão/serviços novos.

O reconhecedor de formatos TikTok continua limitado aos formatos progressivos já admitidos, com dimensões até1920 por eixo e H.264/HEVC+AAC. Não ampliar para4K silenciosamente; o teste separado do arquivo CS2 de1440p foi do encoder, não prova de admissão desse formato pela seleção TikTok.

## Deadline desde a entrada

onRequest registra performance.now antes do Auth. Auth/is_admin têm espera conjunta limitada5s; consulta inicial do complete e consultas do pipeline têm5s e AbortSignal. Inspeção é operação separada: Auth5s+pipeline25s+cleanup; RPCs5s. Cliente de inspeção passa a40s para acomodar Auth/cleanup, sem aumentar orçamento do servidor.

Complete TikTok usa referência da entrada da rota:

1. Processamento/download/encode/probe/decode precisam concluir até75s.
2. Storage usa restante até90s; isso deixa pelo menos15s quando processamento termina no teto.
3. Finalização fenced tem5s próprios; remoção segura de objeto2s e release de slot2s; limpeza local aguarda somente até110s desde entrada.
4. Lease/slot continuam120s e duas tentativas, sem heartbeat nem aumento de timeout. Function observada120s; há folga de10s em relação à última espera local, mas coldstart/plataforma/rede precisam ser medidos no preview.

Subtetos de extração24s, download40s, probe fonte10s, encoder40s, probe/decode final20s cada permanecem; não são parcelas cumulativas garantidas. Orçamento75s pode interromper antes desses tetos. O percurso lento de uma fonte30s pode falhar claramente em vez de ultrapassar a Function.

Além do timer, checagem de tempo monotônico e sinais depois do process e antes/após Storage impede publicar retorno tardio ou de processamento abortado. Teste RED→GREEN comprovou a falha anterior de dependência abortada que ainda retornava metadados. Deadline já expirado continua observando rejeições tardias, evitando unhandled rejection. active local é mantido até cleanup, não liberado antes.

Finalização usaCAS de tentativa+locked_until e lease ainda válido. Resultado ambíguo/ready não autoriza remover objeto; preservadas proteções originais. Clientecomplete150s, monitorGET3,5s,poll3s até300iterações continuam; cancelar UI pausa acompanhamento e não promete cancelar job durável no servidor. Estados reais e retomada continuam; novo stage transcoding antes do encoder temporário. SDKAuth e assinatura/removalStorage sem API direta de AbortSignal têm espera limitada; requisição subjacente pode terminar depois, mas resposta tardia não inicia publicação. Verificar sockets/coldstart em preview, sem declarar cancelamento físico integral dessas chamadas.

## Validação automatizada

- BackendWindows:102testes PASS, typecheck/build PASS; FFmpeg b6.1.1 e ffprobe empacotados. Builddefault não baixa/habilitaTikTok; verificação opt-in local do yt-dlp2026.08.19 confirmou SHA256 do binário já existente, sem download.
- BackendLinux1CPU/2GiB:102testes PASS,tsc PASS; FFmpeg/probe reais no ensaiooffline. Rodada final release-candidate102PASS emLinux eWindows inclui preservação de histórico com configuração20s e guard de aborto tardio. Não repetir benchmarks já válidos sem mudanças relevantes.
- Frontend55unitários PASS,typecheck/build PASS.
- Playwright64PASS após limites30;12casosTikTokdesktop/mobile PASS novamente após alterações finais do cliente de inspeção. São APIs/Auth controlados, não CDN/Supabase real.
- Sintaxe dos scripts e gitdiffcheck PASS.
- Cobertura inclui fonte conhecida acima/igual50MB, crescimento de arquivo sem tamanho anunciado (limite escalado de teste), limites de seleção/saída, expiração, abort tardio, Auth parado, falha de Storage, concorrência/idempotência, tentativas, CAS ambíguo e preservação histórica. Não chamar arquivo de teste local de download real da plataforma.

Comandos:

```powershell
npm --prefix backend test
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:browser
npm --prefix frontend run test:browser -- --grep TikTok
```

Smoke offline adicional, com backend compilado/binários adequados, entrada autorizada já existente e diretório NOVO:

```sh
node backend/scripts/import-pilot-encoding-smoke.mjs /input/authorized.mp4 /results/new-directory
```

## Linux offline e recursos

Imagem oficialnode:24-bookworm-slim,1vCPU/2GiB,pids256,rootreadonly,tmpfs512MiB,networknone,dependências em volume anterior readonly. Código/resultados próprios em backend/vendor/pilot-20261031 (ignorado). Entrada principal autorizada anterior10s1080×1920/H264/30fps, repetida para fonte40s offline. Não houve nova extração/download. Isso testa recorte/validação, não custo da rede nem novoHEVCoriginal.

| Intervalo | Encode final | Encode+validação final | Saída | Resolução |
|---|---:|---:|---:|---|
| 0–30s |17,177s|20,808s|13.826.544B|1080×1920|
| 5–15s |8,254s|9,776s|4.597.779B|1080×1920|
| 29–39s |7,374s|8,928s|4.817.056B|1080×1920|

Repetição corrigida anterior:30s encode16,453s,total20,025s; os demais6,102s/5,811s. Uma amostra por rodada, sem p95. FPS final<=30 verificado porffprobe; fixture24fps permaneceu24fps, sem elevar para30. Probe/decode completos PASS. Primeira expressão de escala estava errada em retrato(606×1080); descoberta no ensaio, corrigida, resultado original retido em pilot-encoding, excluído de recomendações. `pilot-encoding-r2` e `pilot-encoding-final` são resultados corretos.

CS2offline fornecido anteriormente:testeTapete.mp4,29.117.025B,HEVC2560×1440/60fps/19,8s/sem áudio. EncoderLinux gerou1920×1080/30fps/H264,14.058.759B,encode24,507s,total27,221s,CPUuser24,114s,RSS204.980KiB(~200MiB). Frame aos6s manteve mira e referências visíveis; semHUD/textos completos nesse conteúdo, não certificar legibilidade universal. Essa fonte1440p não é admitida pelo seletor TikTok atual; teste isolado de qualidade/escala/decodificação. Não extrapolar esse tempo para30s/4K.

Dados locais desta etapa ocupavam ~231MB em arquivos no piloto antes do encerramento(sem volume de dependências compartilhado). Nenhum OOM nos containers de ensaio. Memória amostrada dos5serviçosSupabase~461MiB no marco final; FFmpeg200MiB não representa pico total daFunction. Dados de memória/tmp completos do perfil anterior continuam em IMPORT-CAPACITY.md. A fonte dos ensaios foi montada fora do tmpfs: ainda falta medir máximo combinado de download+tmp+Storage/memória em hospedagem.

## Supabase local real + frontend real

Docker Desktop foi aberto pelo usuário. Verificados5serviços saudáveis da stack isoladapcdnades-e2e-20261031-a7f4,API127.0.0.1:55421/DB55422. Configurações/chaves existentes somente lidas em memória por harness privado, sem sobrescrever.env/state antigo. Nenhuma migration necessária/nem remota. Administrador local autenticado viaAuth e is_admin.

Harness criou somente fixtures novas no ambiente local, reutilizando fonte autorizada offline40s. `completeImport` real + FFmpeg real selecionaram10–40s,probe/decode,PUT real em bucket privado eCASready. Repetição do complete foi idempotente. Lista do prefixo novo contém somenteimport-1.mp4, semsource.mp4; diretório temporário removido.

API real criou smoke nova; endpointplayback assinou objeto local; bytes reproduzidos correspondem ao objeto armazenado. FrontendReact real, em127.0.0.1:55433, abriu smoke, reproduziu30s1080×1920 e fez seek20s, com requests externos bloqueados. Hash e referência do vídeo originalmente publicado permaneceram iguais. APIs de teste em55432 e frontend55433 encerrados pelo harness; sem novos serviços em background.

Primeiras tentativas de browser falharam por configuração do harness(CORS e FRONTEND_URL ausentes/mapa selecionado). Storage/ready já haviam passado; corrigido SOMENTEharness, retomado o mesmo objeto/smoke sem reupload/novos fixtures. Evidências de falha preservadas. Não é correção de bug do site nem falha do downloader. Relatório privado final:storage-e2e.private.json. Não versionar/mostrar URLs assinadas, tokens ou credenciais.

Falhas reais/SIGKILL/leases/órfãos da investigação anterior em IMPORT-CAPACITY.md continuam preservadas; nesta etapa, falhas de Storage/cancelamento/concorrência também passaram nas regressões automatizadas. Não reaplicar SQL de expiração aos objetos publicados. Novo E2E não fez download TikTok: admissão real da fonte+download protegido foi comprovada na sessão anterior, dentro do seu escopo. Exigir teste real controlado na hospedagem antes de aprovação.

## Docker final e preservação

Cinco containers próprios do piloto retidos:pcdnades-pilot-20261031,pcdnades-pilot-r2-20261031,pcdnades-pilot-cs2-20261031,pcdnades-pilot-final-20261031,pcdnades-pilot-regression-20261031. Benchmarks encerraramexit0; não removidos. StackSupabase5serviços permaneceu ligada/saudável após usuário abrirDocker, disponível para continuidade. Containers/volumes antigos e outros projetos não modificados/removidos. Nenhum prune/comando global de limpeza. Novos órfãos de evidência e resultados continuam apenas localmente, foraGit.

## Viabilidade Vercel e checklist de preview

Configuração observada anteriormente:Hobby/Fluid/1vCPU/2GB/120s/Node24/iad1. Documentação oficial:[limites](https://vercel.com/docs/functions/limitations),[duração](https://vercel.com/docs/functions/configuring-functions/duration),[custos](https://vercel.com/docs/functions/usage-and-pricing). Hobby admite300s, mas projeto observado está120; nenhum aumento solicitado/aplicado. Bundle padrão250MB; trace Linux anterior203.951.326B/9warnings é evidência anterior, não bundle atual de preview. Dependências não mudaram nesta etapa; revisarwarnings e artefato real obrigatório. Limite4,5MB daFunction exige manter upload diretoStorage. tmpfs512MiB foi escolha local, não espaço contratado/confirmado naFunction.

Estimativa:30s1080p30superfast cabe no encoder40s nas amostras, com ~20s paraencode+validação. Isso deixa espaço para rede/Storage no orçamento75/90; não garante fontes50MB em rede lenta,CDN403,coldstart ouvários usuários. A concorrência global continua1. Não contratarworker nem subirtimeout nesta etapa.

Antes de preview, em ordem:

1. Revisar este commit local, limites/anúncios30s, qualidadeCS2 e risco de rede; manterproduçãooff.
2. Pedir autorização específica de preview eSupabase de teste remoto isolado. PreviewVercel não alcança127.0.0.1 destePC. Nenhuma credencial/bucket/tabela de produção.
3. Auditar bundleLinux/binários/hash/permissões/warnings e limite250MB. Confirmar CPU/RAM/tmp/duração efetiva do artefato, não só defaults do dashboard. Nunca enviar `.env`/vendorprivado/mídia de teste.
4. Em ambiente autorizado apenas: migrations históricas em ordem, buckets privados/RLS/admin de teste,MEDIA_TIKTOK_IMPORT_ENABLED=true eMEDIA_TIKTOK_DOWNLOAD_MODE=temporary; conferir uploadglobal90/50MB versuscapTikTok30/50MB. Previews automáticos continuam desativados; só umdeploy manual autorizado, semmain.
5. Teste de fonte explicitamente autorizada em rede real/coldstart:metadata→download→seleção30s em posição tardia→Storage só final→ready→smoke→player/seek/renovação. Medir tempo total,CPU/RSS/tmp/tamanho; várias amostrasincluindoHEVC30/60fps e fontes perto50MB/semContent-Length. Não reutilizarcookies privados nem contornar403.
6. Faults no host:SDK lento,deadline real75/90/110,Storage indisponível/resposta perdida,shutdown/cancelamento,expiração natural120s,duasinstâncias/concorrência,arquivoexcessivo,limpeza de órfãos sem tocar objetos publicados/ambíguos. Cancelar cliente não deve dar falsa promessa de cancelamento do servidor.
7. Somente depois apresentar resultados e pedir decisão separada para produção. Preview/local aprovados não autorizam publicação.

## Retomada recomendada

“Continue na dev lendo IMPORT-PILOT-30.md e docs/continuity/orchestrator.md. Preserve commits e recursos locais. Revise o piloto30s/50MB e prepare auditoria de bundleLinux e plano de preview isolado. Não faça push/deploy/Vercel/Supabase remoto nem habilite flags sem autorização específica. Não repita downloads/benchmarks já concluídos sem necessidade.”
