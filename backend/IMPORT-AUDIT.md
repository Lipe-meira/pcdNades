> Estado posterior,31/10/2026: [validação E2E com Supabase local real](IMPORT-LOCAL-E2E.md) concluída para o trecho10–20s, com Linux/Storage/player e falhas documentados. Produção continua sem autorização; há pendência de timeout para90s/1080p. O conteúdo anterior abaixo conserva o histórico de sua etapa.

# Auditoria local da importação TikTok — 31/10/2026

Estado: **parcial, não publicar nem habilitar**. Branch `dev`, base `b290e43`. Alterações desta auditoria apenas locais, sem commit/push/merge. Nenhum deploy, SQL remoto ou variável de produção foi alterado.

## Resultado real autorizado

O usuário autorizou teste externo e depois forneceu nova evidência para `https://vt.tiktok.com/ZSgs9BM9L/`, vídeo `7701782883760983303`. O comparativo desta sessão utilizou esse novo exemplo. Não repetimos também o exemplo antigo.

| Caminho, Windows/yt-dlp 2026.08.19 | Resultado observado |
| --- | --- |
| Inspeção protegida | 33s, `bytevc1_1080p_818654-1`, H265/AAC |
| Relay Node/FFmpeg, Range | HTTP403, `IMPORT_ACCESS_DENIED`, antes da validação final |
| yt-dlp nativo, info mínimo da inspeção, proxy CONNECT protegido | HTTP403, `IMPORT_ACCESS_DENIED`, antes do FFmpeg |
| yt-dlp direto, mesmo vídeo/formato, nova extração | Download concluído; MP4, 33.320635s, HEVC/AAC; decodificação integral passou |
| FFmpeg empacotado, arquivo direto, intervalo10..20 | MP4, H264/yuv420p/AAC, 10.000s; probe e decodificação integral passaram |
| yt-dlp nativo, extração+download na mesma execução, proxy protegido | Download e decode integral passaram; MP4 HEVC/AAC33.320635s; corte10..20 H264/AAC10s passou |
| `importSection` integrado, modo temporário novo, mesmo vídeo | Inspeção/resolução/download/validação passaram; seleção0..10 ->10.000s; probe/decode passaram |

Sem cookies de contas, login, proxies de evasão ou headers inventados. A execução direta é um diagnóstico local explicitamente autorizado, **não** um caminho exposto pela API. Os arquivos dos testes foram removidos ao encerrar. Não foram enviados ao Supabase nem reproduzidos no site. Compatibilidade por probe/decode não equivale a teste do player no navegador.

Os registros emitidos contêm somente estágio/modo, status/código, formato/codecs, duração, nomes de headers e indicadores de validação. Não contêm URL de CDN, query assinada, cookie, token ou stderr bruto. O script antigo foi corrigido para não imprimir metadados/proveniência completos.

## Causa comprovada e hipóteses

Comprovado: a falha protegida ocorre na obtenção da mídia, com resposta HTTP403; não é uma falha de seleção do intervalo ou do encoder. O mesmo FFmpeg recortou o arquivo obtido diretamente. A falha também ocorreu no downloader nativo protegido, sem a exigência206 do relay: retirar Range **não foi suficiente**.

Evidência operacional: o caminho separado falhou nas duas variantes testadas; extração+download na mesma execução nativa, mantendo proxy e limites, passou. Isso fundamenta a alternativa implementada neste caso, mas não demonstra causalidade de um componente isolado. Ainda não identificado: qual diferença exata explica a recusa do caminho separado. A comparação inicial mantém vídeo/formato, mas cada extração pode gerar um destino/contexto diferente; não prova igualdade da URL assinada, sessão, TLS ou rota. O usuário relatou challenge JavaScript/cookie público na execução direta. Não há evidência de que esse cookie seja necessário ao CDN, e ele não foi copiado para o importador.

Comparação offline Node/FFmpeg: caminho/query codificados, Range e valores dos headers herdados iguais; nomes adicionais diferentes `accept-encoding`/`icy-metadata`. Isso não estabelece causalidade externa. O relay força `Accept-Encoding: identity`, exige206, Content-Range/Length coerentes e total estável. O modo temporário permite corpo completo e não depende de Range. No relay, os headers são filtrados pela allowlist; na sessão nativa o próprio extrator fixado controla headers e seu contexto público transitório dentro do TLS. O proxy não inspeciona esses headers, portanto não se afirma que a mesma filtragem se aplica à sessão nativa. Nenhum cookie externo ou de conta é fornecido, importado ou exportado. Os caminhos separados falharam; a sessão nativa única pelo proxy passou. GitHub Actions não participou: os testes foram feitos no PC Windows.

Experimento adicional executado após o comparativo: extração/download na mesma chamada yt-dlp, ainda pelo proxy CONNECT com DNS pinado, orçamento100MB e formato idêntico. Download real e corte passaram. A integração foi então testada pelo próprio `importSection` e também passou. Isso permite remover a dependência do relay para o modo temporário, sem alegar que cookie, proxy ou Range isoladamente era a causa. Nenhum cookie/challenge solver foi adicionado manualmente; somente o funcionamento normal do extrator fixado, sem login/config/cookies externos.


## Alterações locais

- `tiktok.ts`, `import-api.ts`, `application.ts`: capacidades, inspeção e criação usam o limite efetivo configurado, até90s/50MB. Configuração20s agora anuncia20 e rejeita21 antes de criar job. Teste reproduziu90 vs20 antes da correção.
- `import-processing.ts`: seleção antiga acima do limite atual termina em `failed/DURATION_EXCEEDED`, em vez de ficar eternamente `queued`. Falhas continuam preservando cadastro e chave anterior; erro HTTP genérico tem código próprio.
- `import-temporary.ts`, `import-runtime.ts`: modo opt-in `MEDIA_TIKTOK_DOWNLOAD_MODE=temporary`; padrão `range`. Faz extração+download nativo na mesma execução pelo proxy, com formato exato previamente validado, sem plugins/config/cookies externos. Confere ID impresso após download, formato/codecs/dimensões e duração da fonte local (tolerância1s para arredondamento da duração anunciada). Arquivo inteiro fica temporário; somente o recorte passa ao pipeline de validação e `storeClip`. **A versão inicial com info JSON separado recebeu403; a versão final com sessão única passou no vídeo real autorizado.** Não há fallback automático após403.
- `import-network.ts`: diagnóstico seguro do estágio/status e nomes dos headers da requisição/resposta, sem valores. HTTP401/403 continua explicitamente negado.
- Frontend: mensagem explica que somente a saída final é salva, sem prometer que apenas esses bytes serão transferidos. Novo erro HTTP e tratamento de falhas de acesso; seleção início/fim existente preservada.
- Testes e scripts: regressões de limites, erro, concorrência, Storage simulado/limpeza, argumentos do modo temporário e diagnósticos; comparativo externo e fixture local real separados.

YouTube/Instagram, upload MP4, edição, contratos de playback e migrations históricas não foram ampliados. Nenhuma migration nova foi necessária para estas correções. A migration TikTok já existente continua pendente de aplicação remota autorizada.

## Segurança e recursos

Mantidos: autenticação administrativa nas rotas; URL/plataforma restritas; todos os A/AAAA públicos e conexão IPv4 pinada por CONNECT; TLS do hostname; bloqueio de portas/autoridades privadas; credencial aleatória apenas para o proxy loopback; sem plugins/config pessoal; binário com SHA256 fixado; idempotência, lease/CAS e slot global; publicação somente após `ready`.

Temporário: orçamento100MB/32 conexões de mídia, incluindo bytes observados no túnel; arquivo fonte até100MB, arquivo final até50MB ou limite menor configurado. O proxy aborta excesso de transferência; `--max-filesize` e stat são controles adicionais. Fonte até7200s não significa que qualquer vídeo de2h cabe nesse orçamento. FFmpeg aceita apenas arquivo MOV local, referências externas desabilitadas, saída H264/AAC e seleção explícita, sem encurtar automaticamente uma seleção inválida.

Timeouts: extração24s dentro de inspeção25s; modo temporário download40s + encode40s, subordinados ao prazo global110s do complete; finalização5s e lease120s. O probe da fonte temporária tem10s; probe final/decode têm seus próprios20s, sempre sujeitos ao abort global. Retries de rede/extrator zero; sem tentativa automática alternativa após recusa.

O arquivo fonte e a saída são criados no diretório privado do job e removidos no `finally` do processador, inclusive quando o Storage falha. Não se grava JSON com URL assinada no fluxo de produção; info JSON0600 existe somente na fixture local. Windows usa ACL herdada do diretório do usuário; não foi demonstrado isolamento contra outros processos do mesmo usuário. Nenhum segredo é persistido no banco ou checkpoint.

**Limitações de infraestrutura:** limites de bytes/arquivo, um slot, threads e deadlines não são quota rígida de RSS/disco/processos imposta pelo SO. Fonte+saída podem ocupar aproximadamente151MB, além do runtime PyInstaller/binários/buffers; `storeClip` lê a saída inteira em memória. Quota real de disco, pico de memória, encerramento forçado sem finally e recuperação/limpeza de objetos órfãos devem ser validados no host antes de ativação. Não foi criado serviço pago.

## Build, Supabase e produção

Node24.21.0/Windows x64 testado. yt-dlp2026.08.19 fixado/verificado pelo runtime; FFmpeg b6.1.1 e ffprobe empacotados. Build precisa das dependências de desenvolvimento e dos pacotes opcionais da plataforma. Com flagfalse, build informa que TikTok não foi incluído; para build experimental local, seguir `YTDLP-NOTICE.md`. Linux x64/Vercel requerem seus próprios binários, permissões executáveis e rastreamento de bundle; build Windows não demonstra isso.

Consulta **pública somente leitura** ao endpoint `/api/v1/media/capabilities`, em31/10, confirmou produção anunciando90s/50MB, upload/recorte habilitados, TikTok/YouTube/Instagram desabilitados. Não consultamos valores de variáveis secretas. O bug20/90 era reproduzível em configuração local20; não afirmamos que a produção estava20 nesta sessão.

Banco: migration TikTok cria sessões/RLS/RPCs service_role, snapshot e seleção imutáveis; análise local não comprova aplicação remota. Bucket `videos-staging` privado, limite50MB/MIME MP4; credencial service_role só no servidor. `storeClip` recebe somente saída aprovada, nunca `source.mp4`. Playback existente exige mídiaready associada a granada e emite URL assinada. Falta validar esse caminho contra Supabase Auth/PostgREST/Storage reais e depois no player do site. Não usar teste com dependências substituídas como prova de Storage.

## Testes desta sessão

- Backend: **83/83** testes unitários/HTTP em memória e testes de rede loopback; typecheck/build passaram. Cobrem seleção inválida, limites20/90, SSRF/DNS,403 sem fallback, orçamento/abort, falhas, idempotência e concorrência simulada. Storage/DB dos testes de processador são substituídos; teste de falha verifica limpeza real do diretório temporário.
- Frontend: **55/55** testes passaram; typecheck/build passaram. Fluxos browser completos não foram reexecutados nesta auditoria.
- `import-temporary-smoke.ts`: **yt-dlp e FFmpeg reais**, fonte gerada local30s, servidor HTTP200 sem suporte Range; download idêntico à fonte; intervalo10..20 ->10.000s/H264/AAC, decode integral e cancelamento prévio passaram. Não testa TikTok, proxy de saída real ou Supabase.
- `import-relay-smoke.ts`: **FFmpeg real**, fonte local7200s; intervalo1800..1810 ->10.000s, decode e frame vermelho confirmaram offset;2 requisições,1.191.936B recebidos. Fonte sem Range rejeitada. Variação de buffering não é quota física exata.
- `import-transport-smoke.ts`: comparação offline descrita acima passou, zero conexões externas.
- `import-comparison-smoke.ts`: comparação inicial real autorizada descrita na tabela. `import-native-session-smoke.ts`: sessão única protegida com decode integral e recorte10..20 reais. `import-protected-smoke.ts` com `MEDIA_TIKTOK_DOWNLOAD_MODE=temporary`: execução real do runtime integrado, seleção0..10, probe/decode passaram. Sem Storage/player/Supabase/Vercel.
- `git diff --check`: passou. Nenhum teste SQL local novo foi executado; resultados PGlite anteriores são históricos.

## Validação local e condição para produção

Dentro de `backend`: `npm test`, `npm run build`; com binário experimental local preparado, `npx --no-install tsx scripts/import-temporary-smoke.ts` e `npx --no-install tsx scripts/import-relay-smoke.ts`. Dentro de `frontend`: `npm test`, `npm run build`. Para testar o runtime temporário local depois de preparar o binário, definir apenas no processo local `MEDIA_TIKTOK_DOWNLOAD_MODE=temporary` e executar `scripts/import-protected-smoke.ts` com URL autorizada; o script não escreve no Supabase nem publica. A flag global de disponibilidade continua desabilitada por padrão. O comparativo externo só deve ser executado com URL explicitamente autorizada; não incluí-lo em CI ou retries.

Para validação completa, ainda é necessário executar no runtime Linux/host pretendido com orçamento e memória/disco medidos; usar Supabase de teste autorizado com migrations/regras/bucket revisados; importar seleção válida, verificar objeto final exclusivo, publicar granada somente apósready e reproduzir pelo endpoint/player com origem original indisponível. Testar também falha de Storage, expiração, cancelamento, tentativas concorrentes e preservação de cadastro existente nesse ambiente.

O critério ponta a ponta com Storage/player **não foi atingido**. Resultado concreto entregue: download direto e download protegido em sessão única com recorte real comprovados; correções de política/estados; modo temporário integrado ao processador, sem publicação nem habilitação. Storage e reprodução posterior ainda não foram validados.
