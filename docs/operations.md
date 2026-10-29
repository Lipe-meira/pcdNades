# Operação e integração do pcdNades

## Recursos dedicados

- Frontend: https://pcdnades.vercel.app ; projeto Vercel `pcdnades`.
- API: https://pcdnades-api.vercel.app ; projeto Vercel `pcdnades-api`, raiz `backend/`, Fastify nativo. Health, mapas, lista de granadas e capabilities responderam HTTP 200 após configuração em 29/10. Conferir estado atual antes de assumir disponibilidade.
- Supabase: projeto `pcdNades`, referência `kdyzxxgzvgiffluyjjxu`, organização Lipe-meira's Org, região São Paulo.
- URL Supabase: https://kdyzxxgzvgiffluyjjxu.supabase.co .
- Painel: https://supabase.com/dashboard/project/kdyzxxgzvgiffluyjjxu .

## Configuração da API

As variáveis ficam no projeto **pcdnades-api** da Vercel, em Settings → Environment Variables, nos ambientes apropriados. Alterar variável exige novo deploy para a alteração entrar em vigor.

| Variável | Situação/requisito |
| --- | --- |
| `SUPABASE_URL` | URL pública do projeto dedicado, configurada pelo orquestrador. |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável configurada pelo conector. Não confundir com chave de servidor. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret/service_role configurada diretamente no host pelo usuário em 29/10. Nunca colocar em conversa, frontend ou Git. O orquestrador conferiu apenas presença/nome/ambientes, sem ler seu valor. |
| `FRONTEND_URL` | `https://pcdnades.vercel.app`, para resolver radares. |
| `CORS_ORIGINS` | Lista explícita de origens autorizadas; incluir localhost apenas quando necessário. |
| `MEDIA_MAX_DURATION_SECONDS` | `20`; API e worker devem usar limites compatíveis. |
| `MEDIA_UPLOAD_ENABLED` | Default `false`. Habilitar como `true` somente quando o worker estiver configurado e o fluxo tiver sido exercitado. Controla capabilities e criação de novas sessões de upload. |

Sem a configuração completa, a API atual retorna indisponibilidade para dados/mídia; isso não deve fazer o frontend trocar silenciosamente para dados demonstrativos. `/health` indica inicialização e configuração, mas sozinho não comprova conexão ao banco nem upload operacional.

Na Vercel, a aplicação HTTP usa a entrada `backend/src/server.ts`, que importa e instancia Fastify diretamente. A configuração compartilhada fica em `application.ts`. Não aguardar `app.listen()` no topo do módulo: o loader serverless intercepta o listen durante o import e isso bloqueava a inicialização. O teste `backend/scripts/bootstrap-smoke.mjs` reproduz essa interação. O worker não é parte da Function HTTP.

## Conta administrativa

O usuário deve escolher o e-mail. Criar/convidar a conta pelo Supabase Auth e inserir o UUID correspondente em `private.administrators`, por operação administrativa coordenada. Senha deve ser definida pelo usuário em fluxo apropriado, nunca no chat ou Git.

Um usuário autenticado comum não se torna administrador por fazer login. As permissões dependem da lista privada no banco. Confirmar URLs de redirecionamento/Auth, política de cadastro e login antes de disponibilizar administração.

## Worker e vídeos

O upload envia um MP4 ao bucket privado `videos-staging`. O pedido `complete` enfileira o processamento; um worker com FFmpeg/ffprobe deve consumir a fila, validar, converter e guardar a saída. Só depois o vídeo pode ser publicado em uma lineup.

O host do worker requer `DATABASE_URL`, URL Supabase e chave de servidor. Configurar conexão PostgreSQL segura conforme as opções do projeto/host; não registrar string com senha em documentação ou mensagens. O processo batch termina ao esvaziar a fila: precisa ser chamado novamente por scheduler ou operado conforme guia do backend.

Não habilitar upload de produção como pronto sem confirmar worker ativo, processamento, reprodução e tratamento de falha. Importadores Shorts/TikTok seguem desabilitados; os adaptadores existentes não baixam vídeos.

## Verificações já realizadas e seus limites

- Tabelas, RLS, bucket privado e mapas criados no Supabase dedicado pelas migrations 001/002 revisadas.
- `docs/verification/database-smoke.sql` executado no banco real: leitura pública, negação de acesso/escrita por usuário comum, CRUD administrativo e transições de mídia. Fixtures foram revertidas por rollback.
- Esse teste não cria arquivo no Storage, não executa FFmpeg e não substitui teste HTTP com login real.
- Aviso informativo do advisor sobre `private.administrators` sem políticas é intencional: a tabela não concede acesso cliente; somente a função privada consulta a lista.

Para concluir: configurar segredo servidor e conta administrativa; testar API/autenticação; configurar worker; exercitar upload/complete/processamento/playback e consulta em dois clientes. Registrar cada etapa no checkpoint correspondente.
