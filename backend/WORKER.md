# Operação do worker

Contexto Docker: backend/. Build: `docker build -t pcdnades-worker:local backend` a partir da raiz. Imagem usa Node22, FFmpeg/ffprobe Debian e usuário não root; não inclui .env ou arquivos MP4. Build baixa imagens/pacotes, não toca Supabase. Para repetibilidade estrita, fixar digest da imagem após validação pelo operador.

Execução: `docker run --rm --init --read-only --tmpfs /tmp:rw,noexec,nosuid,size=256m --memory=1g --cpus=1 --env-file /caminho/seguro/worker.env pcdnades-worker:local`. Arquivo env fora do Git, permissões só para operador. Não passar valores secretos na linha de comando/log/chat. CPU/RAM/tmp são limites iniciais a validar com arquivos reais de até20s/50MB. Não expor portas; container executa batch e termina quando fila esvazia.

Env obrigatórias: DATABASE_URL (conexão PostgreSQL com papel servidor autorizado ao schema público/worker e TLS validado), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. MEDIA_MAX_BYTES e MEDIA_MAX_DURATION_SECONDS iguais à API, teto20s. Não precisa publishable key, FRONTEND_URL ou PORT. Não usar DATABASE_URL do navegador. Configuração da rede/Supabase e credenciais são responsabilidade do operador; não desabilitar verificação TLS para contornar conexão.

Caminho simples para time pequeno: um único job Docker agendado a cada minuto num host de containers existente ou pequeno servidor dedicado, com segredo gerenciado e no máximo uma execução ativa; evitar novo Redis/fila externa porque PostgreSQL já persiste a fila. Esta é uma proposta operacional, host/custo ainda não aprovados. Scheduler deve pular disparo se anterior estiver ativo, registrar código de saída/alerta e impor janela suficiente para esvaziar a fila. Não matar cada minuto: job individual pode levar até10 minutos. A API Vercel não executa este worker e não deve chamar FFmpeg.

Ao parar/reiniciar, jobs processing só voltam à fila após lease de15min; máximo3 tentativas e depois failed. Erros de conteúdo viram failed; fila vazia termina com sucesso. Não interpretar código0 como prova de processamento de todos arquivos: consultar estados failed e logs. Nenhum endpoint público para iniciar worker. Logs não devem incluir URL assinada/credenciais.

Fontes/saídas sem referência ainda precisam reconciliação e política de retenção, não estão automaticamente apagadas; acompanhar uso de Storage. Cancelamento do host pode deixar temporários no container descartado e objetos órfãos no Storage. Antes de produção exercitar retomada, limite de quota, erros reais, upload/reprodução e monitoramento.

Teste independente de mídia: `node backend/scripts/media-smoke.mjs` (ou dentro de backend: `node scripts/media-smoke.mjs`). Requer ffmpeg/ffprobe já no PATH; gera fixture sintética azul com seno2s, converte com opções do worker e verifica h264/aac, duração, bytes e ordem moov/mdat. Remove temporários no finally. Não executa worker completo, SQL, rede ou Supabase; não prova integração Storage. Não instala dependências do sistema.

## Verificação executada em 29/10/2026
Docker build da imagem pcdnades-worker:local concluiu. Smoke sintético passou no Windows (2s/17446bytes) e dentro da imagem Debian sem rede, usuário node, filesystem read-only, tmpfs256MB,1GB RAM/1CPU (2.021s/23179bytes,H264/AAC,faststart). Diferenças de tamanho/duração decorrem das versões de codec; ambos respeitam teto20s. Não foi executado worker com DATABASE_URL, fila ou Storage. Nenhum container persistente iniciado e nenhuma imagem publicada em registry.
