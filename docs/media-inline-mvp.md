# MP4 original validado na API — MVP

## Decisão de implementação em 29/10/2026

O usuário prefere não contratar hospedagem paga e aceita espera. A sugestão anterior de Actions como host do processamento foi retirada após revisão dos termos. Para preservar upload e armazenamento próprio sem outro host, o orquestrador escolheu validar arquivos já compatíveis na API Vercel, sem converter o vídeo. Implementação atribuída ao backend e ajuste do cliente ao frontend.

O arquivo continua enviado diretamente ao Supabase Storage por sessão assinada. A API recebe apenas a confirmação, baixa temporariamente com limite, inspeciona com ffprobe e marca pronto ou falho antes de concluir a operação. O original válido é usado no player. A requisição de confirmação deve ter deadline finito; operações repetidas precisam respeitar claim/lease e não publicar o mesmo job duas vezes. Não executar trabalho pendente sem garantia de vida após responder HTTP.

## Requisitos preservados

- Vídeo próprio no Storage, acessível em outros dispositivos.
- Máximo20 segundos/50MB; destino no radar e biblioteca compartilhada.
- Escrita administrativa e mídia privada com reprodução assinada.
- Reenvio após falha e acompanhamento de operação concorrente.

## Limitação explícita

Aceitar MP4 com vídeo H.264/yuv420p e áudio AAC ou sem áudio, dentro das dimensões permitidas. Outros codecs precisam ser exportados para formato compatível pelo responsável. ffprobe confirma estrutura/metadados, não decodifica cada frame. Não há reconversão automática nem importação operacional de Shorts/TikTok neste incremento.

## Validação exigida antes de liberar

1. Binário Linux de origem/versionamento/licença documentados, tamanho e execução compatíveis com bundle Vercel.
2. Testes de arquivo sintético válido, inválido e incompatível; limite20s/50MB; idempotência/timeout/lease.
3. Runtime real Vercel com binário empacotado e fluxo controlado com usuário autorizado.
4. Verificação de reprodução e seek do original; arquivos sem faststart não devem ser anunciados como convertidos.
5. Habilitação coordenada do upload só após revisão; se falhar, manter envio desabilitado e registrar causa.

A Vercel documenta Fluid Hobby com2GB/1vCPU e até300s, sujeito a quotas do plano; isso não promete uso gratuito ilimitado. Upload não passa pelo body da Function (limite4,5MB), apenas pelo Storage. Proposta de deadline do servidor120s e timeout do cliente150s exclusivamente na confirmação.

Fontes: [limites Vercel](https://vercel.com/docs/functions/limitations), [termos GitHub Actions](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features). Worker Docker e Blueprint Render ficam como opções futuras, não serviços provisionados.
