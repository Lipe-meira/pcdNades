# Preview sintético real — 02/11/2026

**PASS. Um único deployment**, sem redeploy, mídia externa, Supabase ou operação de backup.

| Campo | Evidência |
| --- | --- |
| Projeto existente | pcdnades-preview-api / prj_ubCQuSm6ubSL6OrYahHV2ZmwdYyH |
| Time | team_IdIH9Z57lKO3PxfIz8sDJFqN / Hobby atestado pela UI autenticada do orquestrador |
| Deployment | dpl_AapyxdXEsXXJsBsaQHTjkPZhydAd |
| URL | https://pcdnades-preview-a6quelpvg-lipe-s-projects1.vercel.app |
| Target / estado | null (Preview), READY, aliases[] |
| SHA de origem | c8e1fca2849040ac2163ef40e70dd8bc77dd895f |
| Código enviado | 35 arquivos de build/runtime do backend,195.320bytes, extraídos do gitshow desseSHA |

## Escopo e configuração

Conector Vercel foi usado para leitura, variáveis Preview e criação do deployment. O conector omite billing/root/build; o orquestrador confirmou esses campos pela UI SOMENTELEITURA: Hobby, Fastify, Node24, rootvazio, Git não conectado, buildBasic2cores8GB/concorrênciaon-demanddesligada, FluidCompute1CPU2GB/iad1/maxDuration120. Nenhum Git link foi criado.

A autenticação CLI antiga retornou403 na leitura de pré-check; não foi usada para mutações nem repetida após orientação do root. Nenhum outro token de conta foi procurado. Nenhuma configuração dos projetos pcdnades ou pcdnades-api/Production foi alterada.

Exportação backend como raiz, sem env/vendor/credenciais. Única alteração na exportação de ensaio: vercel.json buildCommand=`node scripts/require-preview.mjs && MEDIA_TIKTOK_IMPORT_ENABLED=true MEDIA_INSTAGRAM_IMPORT_ENABLED=true npm run build`. OriginalSHA256affe70f32d4eab74fe7c19ece9f2cbf477ef77529b9f697ff06cfcab9cb2bcfa; exportSHA256d15ff01098aa1f879f1e1b1a05ccd059894cb24bc29474f4cd8a894f643288a7. Código Git permanece exatamente do SHA; gitMetadata.dirty=true informou override de configuração, sem alegar árvore exportada integralmente idêntica. O trabalho Git não recebeu mudança de vercel.json.

Guarda local recusou ambiente nãoPreview com exit42. Não forjamos VERCEL_ENV: o build remoto registrou **PCDNADES_PREVIEW_ONLY: Preview environment confirmed.** Target foi omitido conforme documentação oficial de create_deployment e retornou null; não usamos literalpreview nem production.

Variáveis salvas exclusivamente Preview: runtime MEDIA_TIKTOK_IMPORT_ENABLED/MEDIA_INSTAGRAM_IMPORT_ENABLED/MEDIA_SOURCE_PREVIEW_ENABLED/MEDIA_UPLOAD_ENABLED=false; PCDNADES_PREFLIGHT_ENABLED=true e token NOVO64hex sensitive exclusivo desse projeto. Limites existentes90s/50MB e temporary preservados. Nenhum SUPABASE_*/DATABASE_URL; hiddenProductionEnvCount0. Flagstrue existiram somente no processo de build para incluir o binário, runtime false comprovado por HTTP. Token não é versionado nem impresso; a rota diagnóstica continua protegida no deployment criado. Isso não é endpoint de manutenção. Qualquer desativação/remoção posterior deve ser coordenada, sem fazer um redeploy não autorizado nesta etapa.

## Build e runtime reais

- Build remoto: npmci--ignore-scripts103pacotes/0vulnerabilidades reportadas; build14s, cache74,46MB; logs confirmam FFmpeg Linux79.826.272B e yt-dlp40.446.224B verificados. Sem erro/upgrade/prompt de pagamento.
- `/health`:200 `{status:"ok",configured:false}`.
- `/api/v1/media/capabilities`:200, upload/trimming/TikTok/Instagram/YouTube desligados; sourcePreviewfalse. Limites90s/50MB preservados.
- POST diagnóstico sem token:401. **Um único POST sintético autorizado**:200/statuspass.
- Nodev24.22.2/Linuxx64/uid993; mountOptions[rw];/tmpAvailable538.329.088B.
- yt-dlp2026.08.19; FFmpeg**7.0.2-static**; ffprobeN-66595-gc2b38619c0-static. TodosintegrityPASS nos hashes fixados do harness. Nota: identificador de release do pacote FFmpeg b6.1.1 não é a versão impressa pelo executável, que foi7.0.2.
- Encode/decode sintéticoH264/AAC0,2s PASS; binários realmente executados no/tmp da Function sem remount/bypass. Método terminou com finallyawaitrm, sem erro de cleanup.
- Tempo do harness4.101ms; NodeCPU1.861.949µs e NodeRSS179.859.456B. CPU é somente processoNode, não soma de filhos; RSS instantâneo não é pico/limite garantido.

Build READY e execução dos três binários confirmam inclusão funcional no pacote remoto. Tamanho exato do ZIP remoto não foi exposto pelo conector; não rebatizamos o tamanho do ensaioLinux como medição cloud. Referência local do mesmo código: bundle204.244.544B/ZIP101.026.900B conforme PRODUCTION-PREFLIGHT.md.

## Custo, limites e próxima etapa

Foi usado projetoHobbyexistente com buildBasic e4requests funcionais(health/caps/401/preflight). Nenhum recurso pago, upgrade ou serviço foi solicitado. A execução consome quotas do plano; saldo residual e faturamento final não foram medidos, portanto não há promessa de custo zero ilimitado. Nenhumteste de importação externa, Storage cloud, Auth ou piorcaso1080p/2h foi executado.

Evidências sem sigilos: source-manifest.json e remote-result.json em backend/vendor/preview-preflight-931f498e209e45a89cce2377b5c4308b (ignorado). O mesmo diretório contém material privado: não publicar/copiar o diretório inteiro. Não incluir preflight-token.private ou arquivos de payload em Git. Logs públicos de build podem ser consultados pelo deploymentID.

Resultado informado ao orquestrador antes da operação seguinte. **Backup não foi iniciado.** Produção/main/flagsprod/migrations/runner cloud permanecem fora desta autorização; próximas operações dependem da coordenação do usuário/orquestrador.
