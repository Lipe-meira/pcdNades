# Vídeos: estado atual e limite da importação por link

Atualizado em 30/10/2026. Este documento substitui o diagnóstico antigo que ainda dizia que o recorte não existia e que o limite era 40 segundos.

## O que está implementado

Upload de MP4, validação do original e recorte por intervalo explícito estão implementados e foram publicados pelo orquestrador. O limite final é **90 segundos e 50.000.000 bytes**. Com recorte, a fonte pode ter até **180 segundos e 50.000.000 bytes**; sem recorte, o próprio arquivo deve respeitar os 90 segundos. Isso não é uma afirmação de que todos os formatos ou tamanhos passaram por E2E na Vercel.

Importar um link externo e guardar automaticamente o arquivo **não está funcionando** para TikTok, Instagram ou YouTube. Os três importadores continuam desabilitados. Reconhecer a URL e devolver um erro honesto não equivale a entregar a importação.

As migrations 003 (mídia/recorte/90s) e 004 (origem da granada) foram aplicadas pelo orquestrador conforme seus checkpoints. Este chat não executou SQL remoto nesta investigação e não deve reescrevê-las.

## Por que o TikTok do teste retorna 422

O link `https://vt.tiktok.com/ZSqvRtpM/` é reconhecido como um link curto do TikTok. O backend não o resolve nem baixa o vídeo: retorna `422 PLATFORM_UNSUPPORTED` porque o importador não tem um caminho habilitado. Isso não é erro de URL, Supabase ou codec. O teste deste componente não visitou o vídeo nem presumiu sua autoria ou permissão de uso.

## Diagnóstico decisivo para vídeos públicos de qualquer criador

### TikTok, incluindo contas brasileiras

A [Data Portability API](https://developers.tiktok.com/products/data-portability-api/) aceita candidatos de vários países, mas só retorna dados de usuários do EEE/Reino Unido. Uma conta brasileira não passa a ter acesso ao MP4 apenas por conectar OAuth. A [Display API](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query) oferece metadados, capa e embed, não o arquivo do vídeo.

O [recurso oficial Salvar vídeo](https://support.tiktok.com/en/using-tiktok/exploring-videos/video-downloads?lang=ar) permite download no aplicativo quando o criador habilita essa opção. Isso não documenta uma API de importação servidor-a-servidor. Os [termos para outras regiões](https://www.tiktok.com/legal/page/row/terms-of-service/en), seção 5, restringem interação por scripts automatizados. Não foi identificada uma forma oficial permitida e documentada para baixar, pelo servidor, qualquer tutorial público brasileiro colado no pcdNades. Não usar scraping/yt-dlp como se a opção Salvar concedesse essa permissão técnica.

### Instagram Reels

A documentação oficial de [IG Media](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media) e a [coleção Meta](https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login) tratam de contas profissionais autorizadas. `media_url` requer acesso à mídia correspondente; pode ser omitida em conteúdo sinalizado por direitos autorais. Não comprova acesso a Reels arbitrários de qualquer criador. OAuth de uma conta do time não autoriza consultar e copiar todas as demais contas.

As páginas Meta retornaram 429 ao acesso direto nesta investigação. A referência IG Media foi consultada via Context7 a partir da documentação Meta, e a coleção oficial foi consultada separadamente. Não foi feito um teste autenticado.

### YouTube Shorts

As [políticas da API](https://developers.google.com/youtube/terms/developer-policies), seção III.E.1, exigem aprovação prévia escrita do YouTube para download/armazenamento audiovisual. Uma API key ou o OAuth do titular não substituem essa aprovação. Não há integração de download autorizada configurada no projeto.

**Conclusão de produto:** sob as restrições acordadas, não é possível entregar honestamente um importador universal de tutoriais públicos de qualquer criador. Disponibilidade pública, permissão do criador e autorização técnica da plataforma são condições diferentes. Não há implementação efetiva entregue neste incremento.

## Pré-requisito concreto de uma conexão que possa funcionar

Os caminhos abaixo são limitados e **não atendem ao caso geral solicitado**:

- **TikTok Portability:** titular elegível do EEE/Reino Unido, app e Login Kit aprovados, escopo `portability.postsandprofile.single` ou equivalente autorizado e consentimento do titular. O fluxo solicita exportação, acompanha o pedido e usa o link de download oficial quando disponível. Não é resolução universal do link público. Referência: [Get Started](https://developers.tiktok.com/docs/en/data-portability-api-get-started).
- **Instagram próprio/autorizado:** titular de conta profissional, app Meta e consentimento com permissões de leitura aplicáveis (`instagram_business_basic` no fluxo Instagram Login). Primeiro listar/identificar a mídia dessa conta e confirmar autoria, acesso e `media_url`; só depois avaliar armazenamento/reprodução permitidos. Isso seria uma integração distinta, restrita às contas conectadas, e não deve ser apresentada como solução para Reels de terceiros.
- **YouTube:** aprovação escrita e método de obtenção permitido antes de implementar um downloader. Não substituir por API não oficial, cookies de sessão ou contorno de bloqueios.

Não criar login de plataforma só para exibir sucesso de conexão sem conseguir obter o arquivo. Não pedir senhas, cookies ou tokens no chat. Se uma integração restrita for escolhida futuramente, cadastrar app/redirect URI sob coordenação, guardar segredo apenas no servidor, vincular a autorização ao titular e testar uma mídia autorizada de ponta a ponta antes de habilitar capacidades. Não configurar app, env, host pago ou banco remoto sem autorização.

Os amigos terem acesso ao pcdNades não concede direitos sobre a mídia externa. A importação segue exigindo administrador no backend atual; eventual papel de membro importador requer decisão própria. Não liberar importação anônima nem ampliar RLS como efeito colateral.

## Contrato atual preservado

- `GET /api/v1/media/capabilities` retorna `data.upload`, `data.trimming` e `data.importers`. Cada um dos três importadores tem `enabled: false` e motivo/mensagem. A disponibilidade publicada deve ser consultada em runtime, sem presumir que um checkpoint a mantém habilitada.
- `POST /api/v1/media/imports` autentica o administrador e valida `{ sourceUrl, clip?: { startSeconds, endSeconds } }`. Fonte reconhecida porém desabilitada retorna `422 PLATFORM_UNSUPPORTED`; URL inválida, `400 INVALID_SOURCE_URL`; corpo/intervalo inválido, `400 VALIDATION_ERROR`. Nenhum `mediaId`, job, arquivo ou alteração de granada é criado nessa resposta.
- O reconhecedor exige HTTPS, hosts exatos e paths previstos, sem credenciais/fragmento/portas ou escapes de path. O original e a URL canônica são separados. Links curtos TikTok não são seguidos. Essa negação de acesso externo protege o fluxo atual; não é uma solução completa de SSRF para um futuro downloader ativo.
- `POST /api/v1/media/uploads` continua aceitando corpo ausente/`{}` ou `clip` opcional. O intervalo fica imutável na sessão. `complete` recebe só o ID na rota e corpo vazio; `200` indica `ready`/`failed`, `202` indica claim já em andamento. Sem seleção não há corte automático.
- `clip` aceita frações com precisão de 0,001 s, intervalo mínimo de 0,1 s e máximo de 90 s. Com seleção, o fim precisa estar dentro da fonte de até 180 s. Saída e fonte são limitadas independentemente a 50 MB. O recorte usa FFmpeg empacotado, validação por probe e decode da saída, com deadline/fencing; a granada anterior só muda quando outra mídia pronta é publicada com sucesso.

Uma integração externa futura deve reutilizar esse pipeline após obter a mídia por um método aprovado, sem aceitar URLs de CDN arbitrárias fornecidas pelo cliente. Validar DNS/IP/redirect a cada conexão, impedir redes internas e rebinding, não encaminhar tokens a redirects, impor limites antes/durante o download e preservar autor/URL/plataforma da fonte. Esses requisitos não estão implementados por um importador ativo nesta versão.

## Verificações desta investigação

- Releitura de arquitetura/contratos/checkpoints e documentação oficial atual.
- Oito testes existentes de `tests/importers.test.ts` passaram, cobrindo reconhecimento, rejeição, autorização e preservação do upload. Foram executados com dependências substituídas, sem visitar vídeos externos.
- O link curto do screenshot foi reconhecido pelo componente real: TikTok, `shortLink: true`; a tentativa resultou em `422 PLATFORM_UNSUPPORTED`, sem acesso à rede nem criação de mídia.
- Nenhuma mídia de terceiros foi baixada; nenhum segredo/cookie foi lido; nenhum código, política RLS, migration, env, deploy ou serviço foi alterado nesta investigação. Só documentação e checkpoint foram corrigidos.

Próxima ação: o orquestrador explica esse limite e obtém uma decisão explícita sobre o produto/proveniência antes de outro plano de implementação. Não chamar documentação atualizada de importação concluída. MP4 direto continua sendo a funcionalidade existente, não uma nova integração TikTok disfarçada.
