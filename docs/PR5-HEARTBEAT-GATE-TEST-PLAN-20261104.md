# PR5 — plano e resultado do gate vencido

Estado final: ensaio mínimo concluído com PASS; consultar resultado ao final. As seções de preparação abaixo registram as condições anteriores, não autorizam repetição.

04/11/2026. Branch codex/tiktok-preview-edge-review-20261103; HEAD0c602609ee221b9a7525a503ef01be011e2cb570. Preparação exclusivamente local: sem inicializar backend, chamar Lab, rodar testes ou alterar configurações nesta etapa.

## Contrato revisado

`backend/src/source-preview-supabase.ts`, sourcePreviewAvailable: flag precisa ser true, consulta swept_at em import_preview_maintenance/singleton=true, timeout3s, timestamp finito, no máximo5s no futuro, idade<=480000ms. Exatamente oito minutos ainda é válido; acima disso é indisponível. Erro, ausência, timestamp inválido e flag desligada também retornam false. False isolado não prova vencimento.

`backend/src/application.ts`: GET /api/v1/media/capabilities usa essa função; tiktok.sourcePreview também depende de clientes configurados e importador disponível. Importador desabilitado ou cliente ausente pode mascarar o gate. Não chamar endpoints de inspeção/importação/prévia para testar capabilities.

## Escopo mínimo recomendado para autorização

Uma execução local da função real do backend, consultando exclusivamente o Lab qtixfjntddsxjirxwqon por GET. Não é necessário subir servidor HTTP nem abrir porta. A SDK e a função são reais; não fornecer swept_at simulado. Reaproveitar o teste já existente da ligação com a rota, sem rodar a suíte inteira.

1. Conferir HEAD/diff e destino HTTPS exato do Lab. Preparar credencial legítima exclusiva do Lab por configuração privada já existente ou intervenção do usuário; nunca solicitar seu valor no chat. Se não houver configuração segura, parar. Não carregar .env desconhecido nem credencial de produção.
2. Cliente Supabase sem persistência de sessão/autoRefresh/detectSessionInUrl. Fetch de teste nega qualquer origem diferente do Lab, redirect, método diferente de GET, ou caminho diferente de /rest/v1/import_preview_maintenance; não permite Auth, RPC, Storage, Edge, TikTok ou monitor. Essa restrição é proteção do ensaio de leitura, não uma reprodução da harness de falhas rejeitada. Nenhuma injeção de falha ou concorrência.
3. Fazer uma leitura basal de swept_at com o mesmo cliente. Exigir resposta bem-sucedida, uma linha singleton=true, timestamp válido e idade real estritamente maior que480000ms com margem. Não substituir o timestamp nem modificar relógio. Conferir hora local confiável; discrepância relevante com UTC do banco impede conclusão. Sem heartbeat vencido ou sem autenticação/leitura legítima, INCONCLUSIVO, não PASS.
4. Chamar sourcePreviewAvailable(clienteReal, {MEDIA_SOURCE_PREVIEW_ENABLED:'true'}, Date.now()) uma única vez. O objeto é argumento local da função existente, não alteração de process.env, .env, Vercel ou Supabase. Observar que a chamada efetuou o GET esperado e recebeu a mesma linha válida, sem erro/timeout; caso contrário false não comprova causa. Resultado esperado false.
5. Leitura final de swept_at pelo mesmo cliente para confirmar inalterado. Encerrar o processo. Logs só com horário UTC, idade, status HTTP, número de leituras, resultado e verificação de igualdade; sem chaves, headers, corpo de configuração ou URLs assinadas. Não criar fixtures, jobs, arquivos de mídia ou configurações persistentes. Relatório/checkpoint locais são a única escrita em disco prevista.

PASS: leitura real confirmada, heartbeat antigo real preservado, premissa de flag true explicitamente passada, resultado false devido à idade, nenhuma requisição fora da allowlist. Falha de conexão/SDK/autenticação ou ausência de linha é INCONCLUSIVO para idade. Interromper sem tentativa automática.

O uso de chave de serviço, se necessário pelas ACLs, não torna a credencial readonly: a allowlist e o procedimento restringem as requisições deste ensaio. Não alegar garantia de banco readonly por usar GET; a consulta desta tabela não chama RPC nem funções mutantes.

## O que esse ensaio prova e o que não prova

- Prova integração do código local real do gate com leitura real do Lab e rejeição de heartbeat vencido, sob premissa explícita de habilitação local fornecida à função.
- Não prova resposta HTTP de um servidor hospedado, configuração da Vercel, transição saudável→vencido durante oito minutos, UI, renovação de URL ou disponibilidade de importador.
- Não precisa alterar heartbeat, flags persistidas, jobs ou arquivos de mídia/configuração; não requer Cron, monitor ou oito minutos de espera. O objeto de configuração local true é necessário para não testar apenas o atalho de flag desligada.

## Reaproveitamento dos testes existentes

- source-preview.test.ts: teste de disponibilidade já cobre timestamp recente, vencido481s, futuro, ausente, flag ausente e erro; dependências simuladas. Não repetir suite de limpeza/player.
- preview-api.test.ts: teste de capabilities já cobre tiktok.sourcePreview true com heartbeat recente e false com timestamp antigo, e flag desligada; clientes/importador simulados. Esta evidência demonstra o wiring da rota, não a integração hospedada.
- Não afirmar que esses arquivos foram executados nesta etapa de planejamento. Reutilizar resultados documentados apenas no commit/escopo em que foram obtidos; se não houver resultado específico confiável do teste de rota, executar apenas esse teste filtrado após autorização, identificando-o como simulado.

Se for exigida comprovação HTTP local adicional, autorizar separadamente um processo filho temporário com MEDIA_SOURCE_PREVIEW_ENABLED=true somente nele e Fastify.inject(GET capabilities), sem listener público. Também precisa validar a disponibilidade real do importador ou identificar explicitamente qualquer disponibilidade simulada. Sem essa premissa o false da rota é ambíguo. Não ativar importador/flags remotos nem alterar aplicação para facilitar o teste. Esse passo não é necessário para o ensaio mínimo da função.

## Autorizações a solicitar

Autorizar uma execução do escopo mínimo: cliente/processo local com credencial privada exclusiva do Lab, três leituras GET no máximo (baseline, função e conferência final), argumento local true, registros sanitizados no relatório/checkpoint. Nenhuma mudança remota, credencial nova, arquivo .env ou execução do coletor. Credencial ausente implica intervenção privada antes do teste.

Opcional e distinto: autorizar somente o teste automatizado filtrado da rota com dados simulados caso falte evidência anterior; ou HTTP local adicional com ambiente efêmero explicitamente habilitado. Nenhuma dessas autorizações libera teste hospedado.

## Bloqueios críticos após eventual PASS

Falhas reais PG/Storage na versão final; concorrência/interoperabilidade Edge-runner; efeitos de requisições em voo após timeout/lease; fechamento da capability no ambiente hospedado. Um teste de idade com linha antiga não comprova a transição hospedada. Harness rejeitada permanece fora do escopo, sem comandos equivalentes. Para preencher essas lacunas exigir procedimento expressamente permitido e aprovação de ambiente/efeitos.

Ainda são necessárias revisão/CI do HEAD autorizado para publicação e aprovações operacionais de production migration/rollout/infraestrutura/monitor/flag, com backup e parada do runner legado. Não repetir o ensaio de recusa do instalador, dez ciclos, alertas ou player já aprovados. NO-GO de produção permanece.

## Execução autorizada: interrompida no preflight de credencial

04/11/2026. HEAD0c602609ee221b9a7525a503ef01be011e2cb570 confirmado; mudanças somente documentais anteriores preservadas. Nenhuma requisição GET executada (0/3), nenhuma chamada a sourcePreviewAvailable e nenhum backend iniciado. Não é PASS nem falha comprovada do gate: INCONCLUSIVO por falta de configuração privada legítima identificada para o Lab hospedado.

Verificados apenas nomes de arquivos e destino de configurações antigas conhecidas, sem imprimir valores privados. Ambiente do processo não fornece configuração Supabase; worktree PR5 tem somente .env.example. Configurações client.env/edge-client.env do laboratório local anterior não correspondem ao host autorizado. Não reutilizadas, não tentada credencial de produção nem consulta alternativa. Solicitado ao usuário somente caminho de arquivo privado exclusivo do Lab, sem conteúdo ou tokens.

Retomar após intervenção: validar o arquivo indicado sem exibir valores e conferir destino exato/permissões; então executar a única tentativa autorizada com no máximo três GETs conforme plano. Não houve consumo da tentativa funcional, mas não iniciar até existir configuração segura. Relógio e heartbeat ainda não foram validados nesta etapa; a execução deve parar se houver divergência. Cron/Healthchecks/produção/flags intactos; sem push/merge.

Próximo passo que aproxima da produção: desbloquear essa credencial e concluir a leitura real do gate antes de propor novos ensaios. Em seguida priorizar procedimento expressamente permitido para efeitos tardios/falhas PG-Storage e Edge-runner; fechar verificação hospedada do gate. Manter NO-GO operacional sem substituir evidências por simulação nem recriar a harness bloqueada.

### Configuração privada vazia criada após autorização específica

Arquivo fora do Git: C:/Users/felip/AppData/Local/pcdnades-credentials/preview-lab/heartbeat-gate.env. Somente URL exata do Lab e campo SUPABASE_SERVICE_ROLE_KEY vazio. Pasta/arquivo privados, herança desativada e acesso autorizado somente ao usuário Windows corrente; ACL conferida. Nenhuma chave copiada/criada e nenhum teste executado. Aguardar preenchimento manual confirmado; validar segurança antes das três leituras previamente autorizadas.

## Resultado da execução mínima autorizada — PASS

04/11/2026, aproximadamente18:19:25UTC (15:19 Brasília), HEAD0c602609ee221b9a7525a503ef01be011e2cb570. Arquivo privado preenchido pelo usuário: owner e única regra Allow para usuário Windows atual, herança desativada, pasta/arquivo sem reparse points. Somente os dois campos esperados; URL exata do Lab e escopo/formato da credencial validados em memória, sem imprimir valores, claims, hash da chave ou conteúdo. Não alterar ACL nem arquivo nesta etapa.

Uma execução local via Node/tsx em stdin, sem salvar runner nem segredo em arquivo/comando. SDK real e função sourcePreviewAvailable real do checkout. Cliente auth sem persistência/autoRefresh/detecção de URL. Fetch restrito a GET no host exato do Lab, caminho /rest/v1/import_preview_maintenance e parâmetros select=swept_at/singleton=eq.true; limite absoluto3, timeout3s, redirects recusados, nenhuma permissão para outros endpoints. Sem chamadas Auth/RPC/Storage/Edge/coletor/TikTok/monitor. Nenhum listener HTTP nem aplicação hospedada iniciados.

| Etapa | HTTP | swept_at | Idade real | Diferença relógio local/Date HTTPS |
|---|---|---|---|---|
| Baseline |200|2026-11-04T17:12:02.332103+00:00|4.043.238ms|629ms|
| Função real |200|Mesmo timestamp|4.043.317ms|390ms|
| Conferência final |200|Mesmo timestamp|4.043.388ms|315ms|

Controle de relógio comparou Date do servidor HTTPS ao ponto médio de início/fim de cada requisição, aceitando no máximo5s; todos passaram. Linha retornada e timestamp válidos, idade estritamente maior que480000ms, GET da função confirmado sem erro/timeout. Função chamada exatamente uma vez, argumento local MEDIA_SOURCE_PREVIEW_ENABLED=true, resultado false. Não alterado process.env ou configuração persistente. Portanto o resultado não veio do atalho de flag desligada, ausência de dados ou erro de leitura. Três GETs totais, sem retry; heartbeat final igual ao inicial.

PASS integração do gate local com dados reais do Lab. Não é teste HTTP da capability hospedada, nem transição temporal completa saudável→vencido. Testes simulados de rota/borda existentes não foram repetidos. Nenhuma nova comprovação sobre concorrência/falhas/timeout/coletor deve ser inferida.

Nenhuma alteração remota, arquivo de mídia/configuração, segredo, flag, Cron, Healthchecks, migration, produção, Vercel, push ou merge. Relatório/checkpoint são as únicas alterações locais desta etapa.

## Prioridades após esse PASS

1. Resolver a existência de procedimento expressamente permitido para os cenários reais ainda bloqueados: falhas PostgreSQL/Storage e efeitos após timeout/lease, sem reconstruir ou executar equivalente da harness rejeitada. Enquanto não houver, registrar impossibilidade e NO-GO; não simular aprovação operacional.
2. Interoperabilidade/concorrência real Edge-runner segue pendente de procedimento e autorização específicos. Rollout deve manter runner legado parado; não testar concorrência na produção.
3. Gate da capability no runtime hospedado permanece não comprovado; planejar ensaio isolado com Lab e configuração exclusiva, sujeito a autorização de infraestrutura/configuração. PASS local não autoriza flag produtiva.
4. Próxima entrega executável sem ampliar ensaios remotos: pedir autorização para consolidar documentação e correção local no PR5 Draft com push normal e CI do HEAD final, sem deploy/merge/flags. Isso elimina a divergência entre código local validado e CI remoto, mas não substitui os testes críticos anteriores.
5. Após fechar os gates técnicos, preparar preflight/backup frescos e autorizações separadas para migration/rollout/monitor/flag produtivos. Não repetir os testes de recusa, ciclos, alerta ou gate local já aprovados.
