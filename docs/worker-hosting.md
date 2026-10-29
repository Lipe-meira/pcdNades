# Proposta de hospedagem automática do worker

## Correção da alternativa GitHub Actions (29/10)

O usuário escolheu a opção gratuita com espera, mas a recomendação inicial de usar runners como hospedagem de processamento produtivo foi retirada após revisar os [termos de Actions](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features). A gratuidade de runners públicos não equivale a uma oferta de hospedagem do backend. Nenhum workflow produtivo foi criado ou habilitado.

As opções abaixo são histórico de investigação, não decisão vigente. Está em avaliação uma alternativa mais simples para o MVP: validar MP4 já compatível na própria API Vercel e guardar o original, sem reconversão nem outro host. Isso preserva upload/armazenamento próprio; arquivos incompatíveis precisariam ser recusados com instrução clara. Viabilidade de tempo, binário e codecs ainda precisa confirmação antes de implementar/publicar.

Pedido do usuário em 29/10/2026: hospedar separado do PC para funcionar automaticamente. Nenhum serviço pago foi provisionado.

## Proposta pronta: Render Cron Job

O worker atual consome a fila e termina quando não há trabalho. Por isso a proposta é um job Docker agendado a cada minuto, todos os dias, em vez de um processo que fique ocioso o mês inteiro. O processamento começa no próximo disparo disponível, não instantaneamente.

`render.yaml` na raiz descreve o serviço `pcdnades-media-worker`: imagem construída de `backend/Dockerfile`, branch main, região Virginia, plano `1c-2g` (1 CPU/2GB). Escolhido acima do mínimo de 512MB porque a conversão já foi testada com limite de 1GB; reduzir memória requer teste próprio.

O Render garante uma execução ativa desse cron job por vez e adia o próximo disparo se o anterior ainda estiver trabalhando. Não disparar manualmente durante processamento: o disparo manual cancela a execução anterior. Não existe disco persistente; temporários são descartáveis e os vídeos finais pertencem ao Supabase Storage.

## Custos conferidos e ainda não aprovados

Segundo as páginas oficiais consultadas em 29/10/2026, cron jobs têm mínimo de US$1/mês por serviço e cobrança por tempo ativo. O plano 1 CPU/2GB está listado a US$0,00058 por minuto ativo. O mínimo não é preço fixo nem teto: uso, builds, tráfego e outros recursos podem gerar cobrança conforme o plano. Conferir os valores no painel antes de criar.

- [Cron jobs e cobrança mínima](https://render.com/docs/cronjobs)
- [Preços e planos de computação](https://render.com/pricing)
- [Referência do Blueprint](https://render.com/docs/blueprint-spec)

## Alternativa sem novo serviço pago: GitHub Actions

O repositório é público. Runners padrão do GitHub Actions são gratuitos para repositórios públicos nas condições atuais. Um workflow agendado pode executar o mesmo batch fora do PC, mas não é um worker continuamente ligado: intervalos mínimos e atrasos do scheduler tornam a resposta menos imediata. Seria uma alternativa para aceitar espera de vários minutos, não uma equivalência operacional à proposta do Render.

- [Runners padrão em repositórios públicos](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)
- [Limitações de workflows agendados](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

Não foram criados workflows ativos, segredos de Actions ou serviços Render. A escolha deve ser feita pelo usuário após revisar o custo e a latência.

## Passos após a escolha

1. Conectar a conta do provedor ao repositório e revisar a configuração pronta, sem aceitar cobrança antes da autorização do usuário.
2. Informar `DATABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` diretamente nos segredos do host. `sync: false` no Blueprint solicita essas informações; não versionar nem enviar valores pelo chat.
3. Usar conexão PostgreSQL com TLS válido e rede compatível com o host. A configuração precisa permitir o papel do worker operar mídia e fila; não expor essa conexão ao frontend.
4. Criar o job e executar teste controlado com MP4 sintético, acompanhando fila, FFmpeg, arquivo final e falhas. Testes locais anteriores não substituem essa verificação.
5. Somente após validar worker operacional, habilitar `MEDIA_UPLOAD_ENABLED=true` na API e fazer novo deploy. Validar também envio autenticado, publicação e reprodução em dois clientes.
6. Registrar provedor, plano, identificadores do serviço, teste real e limites no checkpoint. Não registrar segredos.
