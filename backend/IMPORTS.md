# Vídeos e importação por link

Atualizado em30/10/2026. **Importação TikTok não está pronta para produção.** O usuário autorizou o experimento com yt-dlp. Há código de inspeção, sessões e processamento, mas o download do exemplo foi recusado pelo CDN com403 no caminho protegido. Capabilities continuam off por padrão. YouTube/Instagram permanecem desativados; sem embed como substituto.

## Upload existente

Final90s/50.000.000B. Com recorte explícito, fonte até180s/50MB; sem recorte, original até90s. Migrations003/004 aplicadas pelo orquestrador conforme seus checkpoints. Este chat não executou SQL remoto nesta entrega. Essa política não foi relaxada pelo limite separado do importador.

## TikTok experimental

Contrato fixo em [TIKTOK-IMPLEMENTATION.md](TIKTOK-IMPLEMENTATION.md); binários/licenças em [YTDLP-NOTICE.md](YTDLP-NOTICE.md). Migration local20261030124528_tiktok_import_sessions.sql deve ser revisada/aplicada sob coordenação depois de004; ainda não aplicada no Supabase.

1. Admin envia `{sourceUrl}` para `POST /api/v1/media/imports/inspect`. Se habilitado, recebe `sourceId` de15min, título, autor, duração e URL pública canônica. Não recebe CDN, thumbnail, cookie ou token. `preview:null` e `previewReasonCode:PREVIEW_UNAVAILABLE` deixam explícita a ausência de prévia visual.
2. Envia `{sourceId,clip:{startSeconds,endSeconds}}` para `POST /api/v1/media/imports`. Fonte finita até7200s, seleção0,1..90s em precisão0,001s; final50MB. Retorna mídia `queued`, `id` e `mediaId` iguais. Origem/seleção imutáveis. Mesmo sourceId/clip retorna mesma mídia; seleção diferente409. Expiração só bloqueia criação nova, não retomada de mídia criada.
3. Cliente chama `POST /api/v1/media/:id/complete {}`; GET só observa. Claim/lease/CAS e slot global; re-resolve fonte, compara ID/duração, recorta, faz probe/decode e armazena somente saída aprovada. Mídia ready usa playback existente. Granada só muda por cadastro/edição explícito com mídia pronta.

`MEDIA_TIKTOK_IMPORT_ENABLED=false` por padrão. True requer artefato fixado/verificado no build e runtime x64 suportado. Capability verifica SHA256/permissão do binário; isso não comprova operação na plataforma nem substitui autorização para publicação.

## Proteções e limites

yt-dlp2026.08.19 extrai somente metadados com argumentos fixos e sem shell, plugins, configuração pessoal, cookies, login, JS ou componentes remotos. Somente extractors IE_NAME `tiktok` e `vm.tiktok`, através de proxy CONNECT local. Todas as respostas A/AAAA são verificadas por conexão; qualquer IP privado/reservado nega. IPv6 global pode aparecer no DNS; conexão pinada em IPv4 público. TLS verifica hostname original. Destinos restritos à allowlist no código.

FFmpeg recebe apenas recurso loopback opaco, MOV fixo, referências externas desativadas e protocolos `http,tcp`. Relay valida destino/DNS/redirects por conexão, exige206/Content-Range/Content-Length coerentes e tamanho total estável até8GB. Sem manifests/HLS/DASH, URLs CDN do cliente ou fallback para arquivo inteiro. HTTP401/403 produz `IMPORT_ACCESS_DENIED`, sem cookies, login ou tentativa automática de contornar a recusa.

Metadados8MB/16 conexões; mídia100MB/32 requisições, até3 redirects por requisição. São bytes observados pela aplicação, **não quota física exata**: TLS/TCP e buffering aumentam o tráfego real. Teste de orçamento confirma abort/fechamento com overshoot de até um chunk observado. Duas tentativas por job, sem retries automáticos HTTP/extrator; até216MB de payload agregado, mais overhead/inflight. Nova inspeção tem orçamento próprio e rate limit10/h/admin e50/h/projeto.

Inspeção25s; processamento110s + finish5s; lease120s; FFmpeg65s e probe/decode no restante. Um slot DB global entre inspeção/importação. Fontes legítimas podem ultrapassar limites:2h não significa suporte a qualquer arquivo de2h. Não há quota de disco ou firewall de processos imposto pelo sistema operacional; PyInstaller também expande temporários. As proteções dependem dos binários fixados e dos parâmetros/extractors restritos, sem pretensão de isolamento contra binário comprometido. Linux/bundle/memória/tempo/rede/Storage precisam validação real antes de ativar Functions. Nenhum host pago foi provisionado.

## Evidência

- Testes API/processador usam dependências substituídas quando necessário, sem equivaler a Supabase real. Quantidade final e comandos no checkpoint.
- `import-relay-smoke.ts`: FFmpeg real em fonte **local**7200s H264/AAC15.269.956B. Corte1800..1810 ->10.000s/35.598B, decodePASS e primeiro frame vermelho confirma offset30min (fonte começa azul). Relay recebeu1.015.808B em2requisições; servidor serviu1.232.896B incluindo buffering/inflight. Fonte sem Range rejeitada explicitamente.
- `import-sql-smoke.mjs`: PGlite0.5.13 local,29 verificações e5migrations, permissões/RLS/serviceRPC, imutabilidade, idempotência, expiração/retomada, rate limit/slot. Não é Supabase/PostgREST, multiconexão ou SQL remoto. Ferramenta isolada em vendor/sql-test, sem dependência nova em produção.
- `import-proxy-smoke.ts`: offline, selector antigo falha antes da rede; corrigido usa proxy local que rejeita tudo, zero upstream. IE_NAME correto é vm.tiktok, não classe TikTokVM.
- Prova protegida autorizada no URL `https://vt.tiktok.com/ZSgqvRtpM/`: inspeção confirmou vídeo7701366996495125766, autor dgm.cs2,90s,154.473B de metadados. Download recusado. Uma consulta de headers coordenada confirmou **HTTP403**,1.313B/1requisição, corpo não consumido pela aplicação. Rede interrompida, nada armazenado. Teste simples do root fora desse intermediário não prova funcionamento do caminho protegido.
- NFT Windows187.601.154B incluindo yt-dlp.exe; trace inclui FFmpeg/ffprobe/extrator Windows. Avisos de arquivos Linux ausentes e parsing de executáveis registrados. Não comprova bundle/execução Linux/Vercel. Docker daemon indisponível.

## Pesquisa anterior / outras plataformas

[TikTok Portability](https://developers.tiktok.com/products/data-portability-api/) é outra integração, para dados de titulares elegíveis EEE/Reino Unido; [Display API](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query) fornece metadados/embed. OAuth não foi implementado como placebo. O usuário autorizou especificamente o experimento não oficial descrito acima; a pesquisa oficial anterior não significa que esse experimento funcione.

[IG Media](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media) trata de contas/mídias autorizadas, sem comprovar acesso a Reels públicos arbitrários. [Políticas YouTube](https://developers.google.com/youtube/terms/developer-policies) exigem aprovação aplicável para download/armazenamento. Nenhum desses importadores foi ampliado/testado com mídia real nesta entrega.

Pendência concreta: decisão do orquestrador/usuário sobre a recusa403 do caminho protegido, sem burlar bloqueios. Até lá, capabilities off; MP4 continua sendo alternativa existente, não importação TikTok disfarçada. Não alterar env, banco remoto ou deploy para apresentar a pendência como concluída.
