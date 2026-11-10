# Editor: preflight operacional hospedado — 09/11/2026

**Parecer: APTO PARA SOLICITAR AUTORIZAÇÃO DE MANUTENÇÃO/BACKUP.** Em09/11, o responsável confirmou que não existe escritor externo e que Enable Data API e Storage → URL Signing Keys, com rotação/revogação, estão disponíveis no painel. Essas confirmações encerram as pendências de informação do parecer anterior. A fase técnica isolada permanece **APROVADA COM RISCOS RESIDUAIS**, sem novos ensaios.

Isso não comprova uma barreira já ativa nem autoriza execução. A primeira condição da futura janela será ativar os controles aprovados e demonstrar a cobertura WAF dos deployments/aliases antigos, o bloqueio REST/RPC e a drenagem de Cron, Edge e Storage. A leitura WAF404 permanece uma limitação de inspeção, não prova de bloqueio. Se qualquer caminho continuar ativo ou não puder ser verificado, interromper antes de exportar dados ou aplicar DDL e seguir o retorno acordado.

Solicitar autorização limitada à manutenção reversível, sua verificação e ao backup/restauro em destino privado e ambiente separado acordados com o responsável. Preferir a espera de2h após a última emissão possível, mais uploads em andamento, sem rotação de chaves. A alternativa rotate/revoke do Storage exige autorização explícita adicional. Nenhuma alteração de permissões, código ou produção foi realizada com estas confirmações.

## Cliente interno e armazenamento isolado — 09/11

O ensaio posterior superou a falha HTTP do host: rede Docker exclusiva internal=true com gateway_mode_ipv4=isolated, sem portas publicadas, uma rede por serviço e IPv6 desativado. Cliente Node próprio dentro da rede fez login GoTrue, consulta PostgREST e upload/download Storage de MP4 sintético com hash idêntico. Testes de rota nos oito namespaces não encontraram rota IPv4 padrão nem IPv6 não loopback; containers não são privileged, não têm CapAdd nem docker.sock. DNS externo e conexões de amostra falharam; canário próprio respondeu em sua rede, mas não a partir da stack. [Docker documenta](https://docs.docker.com/engine/network/port-publishing/) o modo isolated sem endereço de bridge no host. Resultado PASS para HTTP interno e isolamento de rede dentro do modelo de host/daemon íntegros; não é defesa contra administrador ou daemon comprometido. Sem teste de player/decodificação nesta rodada. Containers próprios parados e evidências preservadas; conta/bucket/tabela/MP4 sintéticos permanecem. Nova restauração exigirá banco/volumes próprios vazios, sem apagar evidências.

**Armazenamento continua BLOQUEADO para dados reais.** Um VHDX de dados criptografado com BitLocker em F: pode guardar backup; bind mounts nele não transferem automaticamente camadas, logs, temporários ou swap do Docker compartilhado em C:. Uma VM Hyper-V separada, com disco/config/checkpoints/logs inteiramente no volume protegido e Docker Engine próprio, reduz exposição, mas não cobre automaticamente paginação, hibernação e crash dumps do host Windows. Existe C:/pagefile.sys; Hyper-V Manager/serviço vmms não foram encontrados. Não afirmar proteção integral sem controles efetivos e aprovação de mudanças necessárias.

Para evitar rastros em C: com maior confiança, preferir um computador Linux separado ou inicialização externa independente em meio inteiramente criptografado, com swap desabilitado ou cifrado e C: não montado. Efetuar backup/restauração nesse ambiente, transferindo ao Windows/F: somente artefatos já cifrados; proteger credenciais/chaves em canal separado. Alternativa Hyper-V no mesmo Windows é mais conveniente, mas depende de proteção comprovada dos caminhos da VM e dos mecanismos globais de memória/dump do host; eventuais alterações globais exigem autorização específica. Nada foi criado ou alterado nesta tarefa. [Microsoft documenta riscos de paginação/dumps](https://learn.microsoft.com/en-us/windows/security/operating-system-security/data-protection/bitlocker/countermeasures) e [Docker observa que tmpfs pode usar swap](https://docs.docker.com/engine/storage/tmpfs/).

## Rede interna para restauração — ensaio bloqueado, 09/11

A rede exclusiva Docker internal=true manteve portas publicadas apenas em127.0.0.1 e comunicação TCP interna entre PostgreSQL, Auth, PostgREST e Storage. IPv6 está desativado e cada serviço tinha somente essa rede. No entanto, HTTP do host para127.0.0.1:58821 expirou; portanto **acesso de entrada FAIL** e a stack não satisfaz o requisito de validação HTTP. Amostras de destinos IPv4 externos e DNS falharam, mas isso não comprova bloqueio de todos os serviços/portas nem do gateway: **isolamento de saída não comprovado integralmente**. A imagem PostgREST não permitiu inspecionar rotas via sh. Containers próprios foram parados; volumes e evidências preservados. Não usar esta configuração para restauração real.

## Stack vazia de restauração — atualização de 09/11

A stack exclusiva restore-ready-20261109 iniciou PostgreSQL, GoTrue/Auth, PostgREST e Storage reais. Bindings verificados em 127.0.0.1 antes dos testes; somente os oito serviços próprios estavam na rede. Health Auth, listagem administrativa vazia, PostgREST e listagem Storage passaram; zero tabelas públicas, usuários e buckets. Todos os containers próprios foram parados e os volumes preservados. Dados e credenciais usados são sintéticos.

A rede bridge permite egress; antes de dados reais é obrigatório implementar e comprovar isolamento de saída, confirmar proteção do VHDX Docker em C:, temporários e destino, e obter autorização explícita. Não há restauração de dados reais nesta etapa.

## Preparação local — 09/11/2026

C: e F: têm respectivamente 1404,6 e 413,9 GiB livres, mas a verificação BitLocker foi negada por permissões. O Docker usa WSL2 com disco de dados em C:/Users/felip/AppData/Local/Docker/wsl/disk/docker_data.vhdx; temporários Windows também ficam em C:. A proteção de C: e F: deve ser confirmada pelo responsável antes de dados reais. F: protegido isoladamente não cobre o Docker em C:.

Ambiente próprio PostgreSQL17.11 sintético criado, rede none, sem portas, zero tabelas públicas; psql, pg_dump e pg_restore --list passaram. Container parado e volume preservado. GoTrue, PostgREST e Storage ainda não estão preparados neste novo ambiente; restauração operacional completa permanece pendente. Não usar essa stack para dados produtivos antes de comprovar criptografia e completar serviços.

Janela única permanece condicionada a: (1) aprovação específica para manutenção/backup e barreira demonstrada; (2) backup final e restauração comprovados antes de autorização separada para histórico20/revision; (3) autorização separada para merge/deploy; (4) autorização específica para smoke/reabertura. Em qualquer falha, interromper e seguir retorno documentado; não presumir autorização por passagem do tempo.

## Proposta de uma janela coordenada — 09/11/2026

Proposta para revisão; nenhuma manutenção, cópia de dados ou alteração remota foi autorizada. Esta proposta substitui a sequência de duas janelas somente se o responsável autorizar cada etapa exigida. A janela anterior de apenas backup permanece registrada abaixo como histórico.

Antes da janela, com autorização separada para copiar dados, pode-se obter backup-base privado do banco e objetos enquanto o site funciona e ensaiar sua restauração isolada. Mudanças durante a coleta podem causar divergência entre banco e Storage. Não usar como backup final nem presumir que um delta ou hashes resolvam a consistência sem procedimento validado. Sem autorização atual, não coletar dados. Preparar antes, sem dados reais: escolher e verificar criptografia/ACL/espaço do destino e do ambiente de restauração; conferir ferramentas e credenciais por canal seguro; preparar stack isolada vazia, sem egress e com bindings loopback; documentar baseline/retorno dos controles e responsável. Nenhuma dessas mudanças foi executada nesta revisão.

Docker: contexto desktop-linux/WSL2 e Docker Root Dir /var/lib/docker referem-se ao filesystem da VM, não ao F:. Registro WSL informa distribuição docker-desktop em C:/Users/felip/AppData/Local/Docker/wsl/main; o caminho efetivo do disco de dados e dos volumes ainda deve ser confirmado em Docker Desktop > Settings > Resources > Advanced e no host. Docker documenta localização padrão em LocalAppData/Docker/wsl, que pode ser personalizada. Não copiar, mover ou modificar VHDX/volumes de outros projetos. Verificar criptografia efetiva do volume que contém VHDX, volumes, camadas, logs, swap e temporários, além do destino F:. Se isso não for comprovado, não restaurar dados reais nesse Docker; preparar destino isolado protegido aprovado. F: criptografado sozinho não protege C:.

Janela única proposta: reservar **6 horas**, estimativa inicial sujeita ao ensaio de backup-base e à disponibilidade do responsável; sem limite garantido e sem extensão automática. (1) Até30 min: confirmar WAF/Data API/Cron e bloquear ingressos; drenar e estabelecer T0. Falha ou cobertura desconhecida: abortar. (2) Esperar T0+2h para URLs de upload e confirmar término de uploads em voo; não reduzir prazo ou rotacionar chaves. (3) Sob a barreira, exportar backup final completo e objetos, verificar inventários, hashes e consistência, e demonstrar restauração funcional em ambiente isolado autorizado; reservar60–90 min após espera, com margem conforme dados medidos. Backup-base pode acelerar somente após demonstrar procedimento de atualização consistente; na dúvida realizar cópia final completa. (4) Parada obrigatória: somente com backup e restauração aprovados, solicitar autorização específica para reconciliar a migration20/50 sem reexecução e aplicar revision. Não proceder enquanto não houver resposta explícita. (5) Validar schema/permissões; solicitar autorização específica para merge do PR9 e publicação coordenada backend/frontend. Não proceder enquanto não houver resposta explícita. (6) Apenas com autorização própria, realizar smoke produtivo, reabrir e monitorar. O responsável permanece presente; se não responder, se qualquer gate falhar ou se a janela aprovada se esgotar, executar o plano de retorno. Jamais interpretar tempo transcorrido como autorização.

Comparação: duas janelas permitem que a restauração seja examinada com site reaberto, mas o backup envelhece após novas escritas e uma segunda suspensão exige nova cópia final ou delta comprovado. Janela única evita repetição da espera e garante backup próximo do DDL, mas mantém o site indisponível durante restore, decisão humana e publicação; pausas sem resposta ou falhas podem consumir a janela. Antes de DDL, abortar e restaurar WAF/Data API/Cron anteriores sem alterar dados. Depois de revision, manter escrita bloqueada e seguir recuperação coordenada: backend antigo isolado não é retorno seguro após revogação de UPDATE; não restaurar backup sobre escritas novas sem autorização específica.

Pré-requisitos para solicitar a janela: local/criptografia/ACL e espaço aprovados para F:, Docker e temporários; credenciais não expostas em argv/log/chat; ambiente isolado vazio e procedimento Auth/RLS/Storage pronto; disponibilidade do responsável para aprovações durante a janela; baseline WAF e retorno comprováveis; orçamento de tempo para restauração e recuperação de falhas. Aprovação do backup-base, da manutenção, dos dois blocos de alterações produtivas e do smoke são decisões distintas. Não há autorização atual para nenhuma delas.

## Primeira janela supervisionada — proposta não autorizada

Referência desta preparação:2de63a56862779e0f6cadb870496ad28f91ee23d. Escopo exclusivo: manutenção reversível, backup e teste de recuperação, SEM alterar o schema produtivo ou publicar o editor. Ao terminar, a aplicação antiga deve voltar ao estado anterior. Se o site voltar a receber escritas, o backup será uma fotografia histórica; um rollout posterior exigirá novo backup consistente ou atualização/delta validado sob nova barreira. Não manter o site parado esperando autorização de migration.

### Viabilidade WAF: plano confirmado; eficácia será verificada na janela

O responsável conferiu manualmente, sem salvar alterações: equipe **Hobby**; pcdnades com0 Custom Rules, limite3, Add Rule e Deny disponíveis; pcdnades-api com0 Custom Rules e Deny disponível. Não encontrou seletor explícito Production/Preview. Essa é a evidência de disponibilidade da conta; get_team/list_teams omitiram plano e get_firewall_config(active) continua404. Não foram instaladas ferramentas ou criadas regras para suprir essa limitação de leitura.

A [documentação WAF](https://vercel.com/docs/vercel-firewall/vercel-waf) confirma até3 regras por projeto Hobby; a proposta usa uma vaga em cada projeto, sem upgrade nem rate limit pago. [Regras](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules) são aplicadas sem redeploy. A disponibilidade de Deny não prova que uma regra já esteja publicada ou que o agente tenha permissão de escrita: publicação e retorno serão manuais, sob supervisão do responsável com acesso ao painel.

**Production/Preview:** [Environment é uma condição opcional da regra](https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration), não um seletor de deploy obrigatório. O [WAF é configurado por projeto](https://vercel.com/docs/vercel-firewall/firewall-concepts) e a [CDN inspeciona cada requisição a um deployment antes da aplicação](https://vercel.com/docs/how-vercel-cdn-works). Assim, a regra proposta é Request Path começa com `/`, ação Deny, primeira prioridade e sem condição Host, Environment, Method ou deployment. **Inferência desses contratos:** o alcance é todo tráfego do projeto, inclusive Production, Preview, aliases e URLs antigas, não apenas a versão atual. Isso explica por que a ausência de seletor não impede a proposta; não é comprovação empírica da barreira.

Preparar essa especificação somente localmente; nenhuma configuração foi salva. Na janela, confirmar condições realmente publicadas e negar todos os caminhos, inclusive leituras. Validar status e atribuição da regra para cada ingresso relevante do inventário, sem assumir que ausência de filtro significa aplicação eficaz nesta conta. Se aparecer escopo oculto, bypass, limitação ou URL ainda passando, abortar antes da exportação e resolver com suporte oficial. Não remover proteção existente ou contratar upgrade automaticamente.

Publicação WAF será manual e supervisionada: Log sem filtro; teste Deny limitado a um **host Preview antigo já existente**; nova observação Log em Production; por fim Deny sem condição de host/ambiente. O filtro Host permite o estágio Preview mesmo sem seletor Environment, sem criar deployment. Editar a mesma regra entre estágios e conferir cada diferença antes de publicar. Se não for possível testar esse host com os controles disponíveis, não improvisar: resolver antes de assumir a barreira. Nada de AI wizard, vercel.json novo, deploy, sharelink, bypass ou Challenge/rate limit usado como negação.

Se Deployment Protection/SSO interceptar uma URL antiga, receber401 ou uma tela de login NÃO comprova Deny da regra. O responsável poderá conferir em sua sessão Vercel normalmente autenticada, sem segredo de bypass, e correlacionar o resultado com os eventos WAF. Sem essa evidência ou demonstração equivalente suportada, o ingresso não está verificado. O agente não utilizará Computer Use nem extrairá cookies para isso.

### Janela estimada e limites

**Reservar5h contínuas**, data/hora ainda a aprovar em America/Sao_Paulo, com responsável disponível e acesso de retorno testado antes. Não é uma medição de desempenho nem promessa de duração. Para o volume atual, expectativa de3h30–4h30, com5h como limite operacional da proposta:

| Intervalo desde início aprovado | Ação e decisão supervisionada |
| --- | --- |
| 00:00–00:30 | Conferir baselines; estágios WAF/publicação nos dois projetos; Cron inativo e Data API off; verificar ingressos e drenar requisições já aceitas. Registrar T0 somente quando não houver emissor ainda em execução. Se não provar cobertura/dreno até00:30, abortar antes de exportar |
| T0 atéT0+02:00 | Esperar validade das URLs de upload anteriores, sem rotacionar chaves. Se T0=00:30, termina02:30. A espera não cancela upload iniciado antes da expiração: verificar também seu término. Novo emissor ou operação sem limite observável invalida T0 e exige abortar/replanejar; não estender a janela automaticamente |
| Até03:00, após expiração/dreno | Dump lógico e exportação do histórico; download dos objetos; manifesto e hashes; confirmar ausência de drift. Orçamento30min, ajustável somente por nova decisão do responsável |
| 03:00–04:00 | Restaurar o backup real no destino isolado já preparado, conferir schema/ACL/RLS/triggers/Auth/Storage e comprovar login/permissões/reprodução HTTP. Não aplicar revision ou migration20 nem usar frontend novo contra schema antigo |
| 04:00–04:15 | Se houver recuperação comprovada, encerrar esta etapa e restaurar Data API, regras WAF e Cron aos estados registrados. Validar apenas leituras no site antigo; sem smoke de escrita produtiva |
| 04:15–05:00 | Reserva para diagnóstico/retorno. Em04:30, se sem conclusão, iniciar abortar/retornar; não iniciar operação nova longa. Falha do retorno requer comunicar incidente imediatamente;5h é orçamento, não garantia física de recuperação |

WAF pode gerar403/negação de acesso e Data API off interrompe também leituras da biblioteca. Abas abertas podem tentar novamente; avisar administradores previamente para guardar seus rascunhos. Não rotacionar chaves para encurtar a espera nesta proposta. Se validação do backup terminar depois da reabertura, seu resultado vale apenas para o snapshot capturado e não libera DDL posterior.

### Checklist da ativação e pontos de parada

- [ ] **Antes de qualquer indisponibilidade:** usuário aprovou início/fim, destino, retenção, operador e ambiente isolado; plano/vaga/Deny confirmados e acesso manual de publicação/retorno pronto; credencial segura disponível; ferramentas preparadas; nenhum escritor externo, confirmado pelo responsável. Sem esses requisitos, não começar.
- [ ] Capturar estado anterior WAF por projeto (configuração completa/versão/ordem/estado), IDs dos deployments e aliases, Data API atual e job1 (active/schedule/hash do comando, sem corpo/segredos). Combinar ausência de mudanças administrativas concorrentes. Baseline ausente ou retorno não disponível: não ativar.
- [ ] Publicar e verificar WAF nos dois projetos, incluindo todos os aliases e URLs individuais READY relevantes inventariados por paginação. GET/HEAD devem ser negados pelo edge antes da função, sem sharelink/bypass; guardar status/regra/horário sem headers privados. Um endereço ainda passando: desfazer e abortar antes do backup.
- [ ] Desativar o job1 pcdnades-preview-sweep preservando schedule/comando; aguardar despachos/execuções em andamento. Desativar Enable Data API pelo painel; confirmar setting e negação REST/RPC inclusive acesso privilegiado e GraphQL se exposto. Não invocar RPC mutável nem gerar upload para ensaiar a barreira. Auth/Storage não são automaticamente desligados.
- [ ] Correlacionar SELECTs agregados desta página com logs de duração/conclusão Vercel/Edge/Storage; nenhuma mídia queued/processing ou lease ativa sem resolução, Cron inativo e net queue vazia. Falta de visibilidade não equivale a sucesso. Não matar jobs, limpar fila ou alterar sessões.
- [ ] Registrar T0 depois de cessarem todos os emissores e aguardar2h, mais uploads em andamento. Clientes comuns sem policy Storage não ganham escrita por isso; acesso privilegiado continua sujeito à confirmação de ausência de processos externos e suspensão de ações administrativas.
- [ ] Produzir backup somente após os gates, em destino criptografado; validar integridade, manifesto, contagens/referências e inventário antes/depois. Drift ou erro: marcar artefatos incompletos e abortar, sem migration/repair.
- [ ] Restaurar e comprovar recuperação isolada; realizar retorno exato e leituras finais da produção antiga. Registrar evidências e a hora da reabertura, identificando quando o backup deixa de ser corrente. Nenhum passo inclui publicação do editor.

### Destino privado: especificação para aprovação

Proposta de caminho: `F:\BackupsPrivados\pcdnades\<data-da-janela>` em volume criptografado verificado. O caminho ainda não foi criado nem aprovado. F: tem cerca de414GiB livres nesta leitura; tentativa de consultar BitLocker via manage-bde foi negada por falta de acesso administrativo. **Não considerar F: criptografado**. O responsável deve confirmar proteção ativa e chave de recuperação guardada fora do próprio backup, ou escolher outro volume/contêiner criptografado. Nenhuma criptografia ou ACL foi alterada.

Capacidade medida só por metadados: banco14.571.187bytes (~13,9MiB),12 objetos com64.895.376bytes (~61,9MiB), todos com tamanho declarado. Não é tamanho de dump medido; pode crescer. Reservar ao menos `max(20GiB, 6×D + 4×S + 10GiB)` onde D é o tamanho do banco e S dos objetos, incluindo margens para dump, cópia protegida, restauração, volumes e imagens. Revalidar D/S e espaço dos discos do backup E do Docker antes da janela. Se separar máquinas/volumes, aplicar margens em cada destino, sem supor que o espaço em F: resolve o armazenamento Docker em C:.

Requisitos: acesso somente ao operador nominal e contas de serviço estritamente necessárias, sem links públicos, sincronização OneDrive/Git ou herança de acesso ampla. Proposta de retenção30dias após a captura, a aprovar; sem exclusão automática de artefatos/evidências. Arquivos temporários com dados reais devem ficar no volume criptografado desde a primeira gravação; Docker Desktop/volumes de restauração também precisam de armazenamento protegido. ACL e criptografia de cada destino devem ser confirmadas pelo operador. Uma segunda cópia criptografada privada pode ser aprovada separadamente; não enviar para nuvem por inferência.

Ferramentas observadas: Node24.21.0, Docker29.7.2 com daemon ativo, SupabaseCLI2.102.0 em cache e imagem PostgreSQL17 local; dependências SDK/Playwright existentes. psql/pg_dump e age/gpg/7z não foram encontrados no PATH: usar ferramentas PG17 em container suportado e armazenamento criptografado do sistema confirmado, ou preparar alternativa antes da janela. Nada foi instalado. Preparar a stack NOVA vazia e loopback com Auth/REST/Storage reais antes da indisponibilidade; não reutilizar volumes de evidência e não carregar dados de produção nessa preparação antecipada.

Credenciais: operador fornece acesso existente por canal seguro/gerenciador, não por mensagem no chat; não resetar senha produtiva, gerar credenciais S3 ou copiar env de produção automaticamente. Validar previamente como a ferramenta receberá a credencial sem senha em argumentos, console, histórico, screenshot ou logs de debug. Guardar material de recuperação necessário separadamente e protegido. Chave raiz Vault/JWT/secrets não será extraída como parte implícita desta primeira autorização; se indispensável ao destino escolhido, tratar separadamente antes da janela.

### Recuperação real a comprovar nesta etapa

Restaurar cópia em stack NOVA dedicada, só loopback, com disco protegido, sem egress para SMTP,OAuth,Cron,webhooks,Healthcheck ou TikTok. Banco e bytes Storage são restaurados juntos; recuperar buckets/keys/ACLs/RLS/triggers e conferir o histórico como estava, sem aplicar as duas migrations pendentes. Usar artefatos do par antigo main9187b72, extraídos na área isolada, sem trocar checkout de outra branch. Frontend/backend novos exigem revision e não são o par correto para testar backup pré-DDL.

Provas obrigatórias: comparar contagens/fingerprints privados de Auth/dados, grants/RLS/triggers e referências; baixar cada objeto restaurado e comparar tamanho/hash; login GoTrue real com conta permitida no destino, is_admin e negações de usuário comum/anon; leitura REST/API e reprodução HTTP do MP4 restaurado (status, bytes/hash e player). Sessões do destino usam chaves próprias; não reutilizar tokens produtivos. Se for necessário criar contas sintéticas para verificar permissões, isso deve constar da autorização exclusivamente no destino isolado. Sem escrita de smoke em produção nem repetição da suíte sintética completa.

Vault: preservar seu dado cifrado/configuração como parte do backup revisado, mantendo Cron desativado no destino. Recuperação funcional de Vault depende de mecanismo suportado de chave/reprovisionamento do destino. Se não demonstrada, registrar limitação e não declarar recuperação integral de segredos/scheduler; não improvisar alteração de owner, grants ou chave para fazer o restore passar. Essa primeira etapa não libera o rollout por si só.

### Abortar e retornar exatamente ao estado anterior

1. Supervisor interrompe admissão de novas operações de backup. Aguardar/cancelar com segurança processos de exportação em leitura; manter artefatos incompletos identificados e protegidos, sem apagá-los. Sem tocar no banco produtivo.
2. Verificar baselines e ausência de mudanças concorrentes. Repor Enable Data API ao valor original; confirmar leituras REST. Não conceder permissões ou executar reparo/migration para restaurar acesso.
3. Restaurar configuração WAF registrada: retirar apenas a regra temporária de cada projeto e repor a ordem/estado anterior. Não desativar o firewall inteiro nem substituir configuração de terceiro. Se houve alteração concorrente, revisar diferença com o responsável antes de restaurar snapshot inteiro. Manter usuário com acesso manual ao painel para retorno independente do conector404. O baseline confirmado é zero Custom Rules: retirar a regra temporária deve devolver essa contagem e o comportamento anterior, preservando as demais proteções. Histórico de auditoria e versões gerados pela operação poderão permanecer no provedor; não serão apagados para simular ausência de mudança.
4. Confirmar leituras GET/HEAD na API e site antigos, mesmos deployments/aliases/SHA; não fazer cadastro/edição/upload em produção. Repor job1 ao active original por último, com mesmo id/schedule/hash do comando. Confirmar Cron/Edge retomando por logs agregados; não invocar função manualmente.
5. Registrar reabertura, resultado do backup (completo/incompleto/restore falhou), divergências e pendências. Se um controle não puder ser restaurado, comunicar imediatamente e seguir sob supervisão; não fazer reset, rollback de banco, deploy ou exclusão como atalho. Falha de backup não justifica deixar produção indefinidamente bloqueada.

### Quem faz cada ação após autorização

| Ação | Responsável/método disponível | Limite atual |
| --- | --- | --- |
| Confirmar plano, vaga, escopo WAF e publicar estágios/retorno | Usuário no painel Vercel; agente acompanha inventário/leitura | Plano Hobby/zero regras/Deny confirmados pelo responsável; conectores omitem plano e WAFactive404. Mutador oficial update_firewall_config existe, mas o método escolhido será publicação manual para garantir baseline e retorno; não usar PUT de configuração inteira |
| Toggle Enable Data API e reposição | Usuário no painel Supabase | Conector atual não expõe configuração/toggle; disponibilidade foi confirmada manualmente |
| Cron Inactive/Active | Usuário no painel; alternativamente conector execute_sql, SOMENTE com autorização explícita para cron.alter_job no id1 | Não executado. Evitar unschedule/recriação; revalidar id/baseline antes de qualquer alteração |
| Inventários, SELECTs agregados, logs e CI | Conectores Vercel/Supabase/GitHub autorizados para leitura | Não imprimir payloads privados/segredos nem interpretar ausência de log como drain |
| Criptografia, ACL, destino, segredo e recuperação de chave | Operador local nominal | Precisa confirmar manualmente antes de aprovar destino; agente não pede senha no chat |
| Dump, download, hashes e restore | CLI/SDK/ferramentas locais no destino aprovado, sob supervisão | MCP execute_sql não é exportador de backup. Só após autorização de dados reais e barreira aprovada; nenhum acesso de teste deve alcançar produção |
| Rotação/revogação URL Signing Keys | Fora da proposta padrão; painel manual se autorizada separadamente | Não rotacionar Auth ou Storage nesta etapa |

### Texto proposto de autorização — preencher, não executar agora

> Autorizo exclusivamente a janela de manutenção e backup de [data], [início–fim], America/Sao_Paulo, por até5h, com [operador] acompanhando. Aprovo o destino [caminho/volume criptografado verificado], a área de restauração [ambiente separado protegido] e retenção proposta de30dias, sem exclusão automática. Após confirmação do plano/vaga/escopo WAF nos dois projetos e dos demais pré-requisitos, autorizo os estágios e a regra temporária WAF, Data API off/on, job1 Inactive/Active, verificação negativa por leitura, drenagem e espera de URLs por2h, dump/download privado de dados reais e restauração isolada com validação Auth/permissões/vídeos. [Se necessário, autorizo contas sintéticas apenas no destino isolado.] Exijo abortar antes da cópia se a barreira falhar e retornar às configurações originais ao terminar ou atingir o limite; não prolongar a janela sem nova decisão. Não autorizo migration, reparo de histórico, merge, deploy, rotação de chaves ou smoke de escrita em produção.

**Proposta pronta para aprovação da janela/destino, ainda sem autorização de execução:** plano/vaga/Deny foram confirmados manualmente; alcance geral fundamentado no contrato oficial, com eficácia e ausência de bypass a comprovar na ativação antes da cópia. Faltam data/hora, operador, acesso de retorno, criptografia, destino e retenção aprovados. Nenhuma ação produtiva foi realizada nesta preparação.

## Inventário hospedado somente leitura

Leituras de 09/11 são observações independentes, não um snapshot transacional único. Revalidar na janela. Referência técnica PR9: `30e691157b2878da309845820928d1bd3947678e`; preflight documental anterior: `731fea90c9cc0cec7695e73087a5234a1ef2aa38`; main remota: `9187b72bf15906b0112a736503b35b68f3d4b297`. PR continua Draft.

| Recurso | Evidência | Consequência |
| --- | --- | --- |
| Frontend pcdnades | Deployment dpl_CXveN8eKcbhPAs77gEo7PtEw7HgW READY/main9187b72; 83 deployments listados, 54 READY (45 production e 9 outros), 10 aliases | Incluir URLs individuais e aliases antigos na barreira. READY não comprova acesso público nem função em execução |
| Backend pcdnades-api | Deployment dpl_GunuHiZjWUF55rNDU7hdEQYsYtbp READY/main9187b72; 80 listados, 63 READY (43 production e 20 outros), 14 aliases | Bloquear só o domínio principal ou publicar uma flag nova deixa versões antigas fora do controle |
| Proteções Vercel | Listagens sem próxima página. SSO informado para preview; leitura de WAF active retornou 404 nos dois projetos | Não concluir ausência de WAF nem cobertura de todos os deployments. Roots/tracking/hooks continuam sendo confirmações manuais anteriores |
| Supabase | pcdNades, ref kdyzxxgzvgiffluyjjxu, ACTIVE_HEALTHY, PostgreSQL17.11.0.003, organização Free | Não presumir PITR ou backup diário pago disponível. Preparar exportação lógica privada |
| Migrations/limite | 9 versões até20261103120954; revision ausente; função20/50, janela1h e security invoker confirmados | Revalidar equivalência completa antes de reparar somente o histórico20; depois aplicar revision |
| Acesso direto | authenticated mantém INSERT/UPDATE/DELETE em grenades, com RLS is_admin; anon sem DML público; service_role tem DML e RPCs mutáveis | Pausar API não contém administrador direto nem escritor privilegiado |
| ACLs e triggers | Sem ACL explícita de coluna ou membership das três roles consultadas. RPCs mutáveis de importação/preview acessíveis a service_role; is_admin é leitura. Triggers grenade_ready, media_state e immutable_import_source presentes | Não remover grants, policies ou RPCs como atalho. Inventário estrutural não prova ausência de SQL dinâmico |
| Storage | Dois buckets privados, videos-staging e import-previews, até50MB/video/mp4;12objetos em videos-staging; zero policies Storage | Grants SQL não equivalem a autorização RLS. Clientes comuns não têm escrita normal por policy; service_role e URLs assinadas são exceções |
| Cron/Edge | Job1 pcdnades-preview-sweep ativo, */3min; Edge preview-sweep ACTIVE/v1, verify_jwt=false, com token próprio | Fonte hospedada exige claim REST antes de modificar Storage. Cron inativo não cancela invocação aceita nem chamada externa |
| Repouso observado | Filas net/Cron, leases de mídia/importação/sweep e preview jobs vazios;14 mídias ready/2failed;11 granadas com mídia, sem objeto publicado ausente | Isso é um snapshot, não drenagem garantida. Sucesso do Cron SQL comprova despacho HTTP, não conclusão Edge |
| Logs agregados, últimos15min | 5 invocações Edge concluídas com204; Storage mostrou GET e POST de listagem, sem payloads consultados. Vercel não retornou grupos de logs runtime nesse intervalo | Cron está efetivamente executando mesmo com fila vazia. POST de listagem Storage é leitura; ausência de log Vercel não comprova ausência de requisição |
| Outros executores | pg_cron/pg_net instalados, pgmq ausente; sem FDW ou trigger customizado de Auth observado. Sessão postgres observada era pg_net worker idle | Worker batch do repo usa SQL direto e Storage; os conectores não inventariam Docker, VPS, agendadores e credenciais S3 externos; o responsável confirmou em09/11 que não existe escritor externo |
| Git/configuração | Workflow backend-linux apenas compila/testa; sem deploy. Dois vercel.json mantêm false exclusivamente para esta branch; sem crons nesses arquivos | Não comprova ausência de automações externas ou settings não expostos |

Rotas mutáveis do backend publicado (main9187b72), também presentes na integração, sob `/api/v1`:

- POST `/grenades`; PATCH e DELETE `/grenades/:id`.
- POST `/media/uploads` e `/media/:id/complete`.
- POST `/media/imports/inspect`, `/media/imports` e `/media/imports/:sourceId/preview`.

Upload assinado escreve diretamente no Storage. Complete, importação e worker podem continuar após suspender a admissão. GET de playback emite URL de leitura. Não revalidei capabilities por HTTP: o leitor web não acessou os endpoints. O fetch Vercel que cria sharelink temporário não foi usado nesta tarefa de leitura.

## Manutenção proposta: controles, verificação e retorno

Preferir indisponibilidade total temporária, usando controles existentes. A barreira cobre dados da aplicação e objetos; não se deve chamá-la de suspensão de toda escrita interna de Auth ou telemetria. Atualizações de sessão Auth podem continuar e entrarão no snapshot do dump de dados. Não foi observado trigger customizado de Auth escrevendo na aplicação. Operações administrativas em contas, schema e dados ficam suspensas por coordenação do responsável.

| Caminho | Controle futuro | Verificação antes do backup/DDL | Retorno |
| --- | --- | --- | --- |
| APIs e frontends, antigos e novos | Regra WAF Deny temporária e prioritária nos dois projetos, sem filtro de host/ambiente e sem bypass anterior. Para janela total, negar todos os métodos | Registrar configuração/versão anterior. Confirmar Deny nos domínios, aliases e URLs individuais relevantes, em Production e Preview, antes da função. GET/HEAD podem verificar uma regra que nega todos os métodos; probes de escrita exigem autorização específica. Conferir métricas, sem sharelinks/bypasses | Remover só a regra criada e restaurar ordem/estado anterior, mantendo proteções existentes. Não é necessário alterar API_WRITES_PAUSED |
| REST/RPC direto Supabase | Desativar temporariamente Enable Data API pelo painel oficial, sem revogar grants | Confirmar setting e indisponibilidade de REST/RPC, inclusive acesso privilegiado; conferir GraphQL se exposto. Isso não desativa Storage, Auth ou SQL direto | Repor o valor anterior. Reativação reabre acesso direto autorizado: inicia a reabertura controlada, não acesso exclusivo de um operador |
| Cron | Alternar somente job1 para Inactive, preservando job, comando e schedule | cron.job.active=false, nenhuma execução/HTTP pendente e confirmação de conclusão Edge por logs/leases. Não interpretar queue vazia como cancelamento de chamada já despachada | Repor active=true somente porque esse era o estado original; manter id/schedule/comando. Não recriar job nem ler Vault decrypted |
| Edge preview-sweep | Cron inativo e Data API desligado impedem novo claim REST na fonte hospedada inspecionada | Drenar chamadas existentes. Há deadline60s e lease2min, mas expiração isolada não prova término. Confirmar logs/execuções; se não houver visibilidade, aguardar o responsável | Reativar Data API/Cron após par compatível; não alterar código ou token |
| URLs de upload anteriores | Preferência sem mudar chaves: cessar TODOS os emissores, registrar T0 da última emissão possível e esperar T0+2h, além dos uploads em andamento | Incluir versões antigas e processos privilegiados. Confirmar expiração e término de uploads; conferir ausência de drift. Ausência de awaiting_upload no banco não reduz esse prazo. S3 presign/TUS ou outros emissores precisam de inventário próprio | A espera não muda chaves ou policies. Emissores só retornam na reabertura |
| Alternativa para URLs | Storage URL Signing Keys: rotate e revoke das chaves que ainda validam URLs anteriores; rotação de Auth não resolve | Confirmar recurso disponível neste projeto, registrar apenas IDs/estados, testar negação de URL anterior sob autorização. Revogação não cancela upload já aceito; download em cache pode persistir | Repor estados via standby/rotate conforme documentação só depois da manutenção, ou aprovar permanência da nova chave. Sem capturar valores. Opção não autorizada nem comprovada no projeto |
| Worker, SQL e S3 externos | Responsável identifica produtores/agendadores, suspende novas execuções e aguarda término | Identificar hosts/serviços e conferir execuções, filas, leases, sessões e Storage. Restrição de rede só protege DB/pooler. Revogar URL Storage não contém credencial S3 direta | Restaurar apenas estados anteriores identificados. Não matar processos nem resetar leases silenciosamente |

A composição não foi ativada ou testada no projeto hospedado. As bases oficiais são: [Data API](https://supabase.com/docs/guides/api/securing-your-api), [Network Restrictions](https://supabase.com/docs/guides/platform/network-restrictions), [WAF Deny/Bypass e ambientes](https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration), [Cron Active/Inactive](https://supabase.com/docs/guides/cron/quickstart), [upload assinado de2h](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [URL Signing Keys](https://supabase.com/docs/guides/storage/security/signing-keys) e [service keys do Storage](https://supabase.com/docs/guides/storage/security/access-control).

A [pausa de projeto Vercel](https://vercel.com/docs/projects/managing-projects) bloqueia a produção ativa, não comprova bloqueio de versões antigas. A [orientação Supabase](https://supabase.com/kb/troubleshooting/putting-a-project-in-read-only-mode-or-freezing-writes-during-a-migration-b5a2c7) classifica default_transaction_read_only como soft freeze: conexões existentes mantêm estado e Data API pode sobrescrever a configuração. Ambos foram rejeitados como barreira única. Não propor Dockerstop no hospedado nem pausar Supabase para tentar executar DDL enquanto indisponível.

**Critério de drenagem:** depois de cessar admissão, observar repetidamente Cron/net, leases, mídia queued/processing, atividade SQL relevante e execuções/logs de Vercel/Storage. Exigir término ou parada comprovada dos executores. Nem pg_stat_activity sozinho, nem lease expirada, contagem estável ou sucesso do Cron SQL bastam. Se alguma escrita relevante retornar, invalidar o backup. Sem cobertura demonstrada, parar antes da cópia/DDL e seguir o plano de retorno acordado.

Alternativa operacional selecionável: ausência de escritores externos confirmada pelo responsável, janela total e espera T0+2h. Reconfirmar essa condição ao iniciar a janela. Se não for possível conter emissores ou comprovar dreno do Storage, solicitar ao Supabase uma barreira de ingresso suportada antes de agendar a execução. Não improvisar revogações de permissões.

### Leituras mínimas para verificar a janela autorizada

Acompanhamento por operador, sem polling automático nesta tarefa. Consultas agregadas não mostram tokens, URLs assinadas, conteúdo de jobs ou dados pessoais:

```sql
SELECT jobid,jobname,schedule,active FROM cron.job;
SELECT count(*) AS cron_running FROM cron.job_run_details WHERE end_time IS NULL;
SELECT count(*) AS dispatch_pending FROM net.http_request_queue;
SELECT status,count(*) FROM public.media_assets GROUP BY status;
SELECT count(*) AS live_media_leases FROM public.media_assets WHERE locked_until>now();
SELECT count(*) AS live_import_lease FROM private.import_slot WHERE locked_until>now();
SELECT count(*) AS live_sweep_lease FROM private.preview_sweep_lease WHERE locked_until>now();
SELECT state,count(*) FROM public.import_preview_jobs GROUP BY state;
SELECT usename,backend_type,state,wait_event_type,count(*)
FROM pg_stat_activity
WHERE datname=current_database() AND pid<>pg_backend_pid()
GROUP BY usename,backend_type,state,wait_event_type;
```

Correlacionar esses resultados com duração/conclusão das execuções Edge, Vercel e Storage. Não consultar corpo de Cron, headers de pg_net, Vault decrypted ou linhas completas de logs para obter essa prova. O job deve permanecer inativo durante a observação; fila momentaneamente vazia com Cron ativo não é barreira.

## Backup real: procedimento preparado, não executado

O plano Free permite exportação lógica privada. Não contamos com PITR ou backup diário confirmado. [Backups de banco](https://supabase.com/docs/guides/platform/backups) não incluem os arquivos do Storage. Nenhum backup, credencial ou destino real foi criado nesta tarefa.

**Destino a aprovar:** diretório fora do Git, OneDrive e pastas públicas, em volume criptografado, com acesso restrito ao operador. Acordar caminho, capacidade, retenção, chave de recuperação guardada separadamente e ambiente de restauração. Segunda cópia privada criptografada se aprovada. Não guardar dados produtivos em vendor nem anexar artefatos ao PR/chat.

**Banco:** CLI2.102.0 já instalada; `--version` e `db dump --help` consultados localmente, sem conexão remota. Preparar PostgreSQL17 compatível e conexão TLS direta ou Session Pooler5432, não Transaction Pooler6543. Credencial fornecida por canal seguro e mecanismo suportado validado, sem senha no histórico, argumentos expostos ou logs. Não redefinir senha automaticamente se faltar acesso. Os comandos abaixo são modelos, não comandos executados:

```text
supabase db dump --db-url <conexao-protegida> --role-only -f <destino-privado>/roles.sql
supabase db dump --db-url <conexao-protegida> -f <destino-privado>/schema.sql
supabase db dump --db-url <conexao-protegida> --data-only --use-copy -f <destino-privado>/data.sql
supabase db dump --db-url <conexao-protegida> --schema supabase_migrations -f <destino-privado>/history_schema.sql
supabase db dump --db-url <conexao-protegida> --schema supabase_migrations --data-only --use-copy -f <destino-privado>/history_data.sql
```

Revisar as exclusões efetivas da CLI antes da exportação. Conferir explicitamente dados Auth/public/private/Storage, customizações de Auth/Storage, owners, grants, RLS e triggers. O histórico exige exportação separada. Não recriar cegamente schemas gerenciados num destino Supabase. Os arquivos são snapshots distintos; a barreira mantém aplicação/objetos estáveis e impede DDL, enquanto sessões Auth podem variar e são capturadas juntas no dump de dados. Não afirmar snapshot global idêntico de todos os serviços.

**Objetos:** copiar todos os arquivos dos dois buckets por SDK Storage.download existente, somente leitura na origem, preservando bucket/key no arquivo privado de recuperação. O levantamento contém12 objetos e deve ser revalidado. Evitar criar credencial/configuração S3; se necessária, solicitar autorização adicional. Manifesto privado: bucket/key, tamanho, SHA256, metadados necessários e configurações dos buckets, sem URLs assinadas. Comparar inventários antes/depois e relacionar grenades.video_id → media_assets.storage_key → objeto. [Download oficial](https://supabase.com/docs/guides/storage/management/download-objects) separa arquivos e metadados. GNUtar/xattrs foi uma exigência do Storage local; não há acesso ao volume físico hospedado para transplantar essa receita Docker.

**Integridade:** comandos com exit0, arquivos não vazios, SHA256 por arquivo e manifesto, leitura/descriptografia privada do arquivo protegido, contagens e referências relevantes, ACLs/RLS/triggers/owners/histórico e objetos com bytes/hash correspondentes. Não resetar contadores ou sessões. Backup deve preservar20/50 sem reexecutar a função. Se aparecer drift, não aprovar o conjunto como consistente.

**Restauração:** autorizar ambiente NOVO separado e cópia de dados reais, compatível com Supabase/PG17. Desativar egress SMTP/OAuth/webhooks/Cron/monitor; nunca apontar frontend produtivo ao destino. Seguir o [procedimento lógico oficial](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), com ON_ERROR_STOP=1 e transação quando apropriado. Revisar diferenças de roles gerenciadas, sem remover owners/policies indiscriminadamente. Não usar supabase_admin do laboratório como credencial produtiva. Repor objetos via Storage API nos mesmos buckets/keys, conservando os metadados originais como evidência; IDs/versionamentos internos podem mudar, mas referências da aplicação precisam funcionar. Não inserir metadados apontando para bytes inexistentes.

Provar no destino: leitura HTTP, login permitido, restrições RLS, permissões, criação/edição de fixture exclusivamente ali e reprodução MP4 restaurado. Fingerprints privados e contagens verificam preservação dos dados Auth; não pedir senha de usuário pelo chat. Não repetir os ensaios sintéticos como substituto desta recuperação do backup real.

**Auth/Vault/configuração:** o Cron usa Vault. Ciphertext no dump não comprova uso dos segredos em outro projeto: recuperação demanda procedimento suportado para chave raiz ou reprovisionamento privado aprovado. Nunca reativar no teste o Cron com URLs/tokens reais, SMTP ou Healthcheck original. Inventariar configurações/flags/versões/Auth/Edge e credenciais por responsável, sem imprimir valores. JWT, chaves S3 e configurações gerenciadas não equivalem a SQL exportado. Não copiar chave raiz nesta tarefa.

**Falha parcial:** se exportação, integridade, download ou restore falhar antes do DDL, não reparar histórico nem migrar. Preservar cópias incompletas identificadas; repetir sob barreira comprovada ou abortar e restaurar configurações. Após revision, preferir correção adiante com schema aditivo: backend antigo perde UPDATE e cliente novo exige revision. Não restaurar backup antigo sobre novas escritas, mudar aliases ou devolver grants sem autorização específica. Restaurar SQL não recupera objetos Storage perdidos; usar o manifesto aprovado.

## Checklist único de execução futura

Cada mutação depende de autorização. Este checklist é preparação, não execução.

1. **Manutenção:** confirmar escritores, controles, destino e operador; registrar estado anterior; ativar WAF nos dois projetos e Data API off, desativar Cron/produtores; provar cobertura de ingressos antigos, diretos e privilegiados. Sem prova, interromper antes do backup.
2. **Dreno:** aguardar operações aceitas, Edge, jobs e leases. Cessar emissão e esperar T0+2h mais uploads, ou usar revogação Storage expressamente aprovada e verificada. Não redefinir contadores/sessões.
3. **Backup/restore:** exportar privadamente banco/Auth/ACL/RLS/triggers/histórico/configurações necessárias e objetos sob a barreira; conferir manifesto, hashes e ausência de drift; restaurar e validar por HTTP no destino aprovado. Sem recuperação comprovada, não prosseguir.
4. **Histórico20:** revalidar equivalência completa, assinatura/owner/ACL/search_path e20/50/1h; reparar apenas20261105210000 como applied por comando oficial. Não reexecutar função, migrations antigas ou sessões.
5. **Revision:** aplicar somente20261105170000 por procedimento transacional aprovado que registre a versão; verificar default1, trigger, grenade_ready, grants/RLS e ausência de UPDATEauthenticated em tabela/colunas/atalhos. Backup permanece pré-DDL.
6. **Integração:** autorizar merge único do PR9 em main, preservando branches originais. O bloqueio Git desta branch não bloqueia main. Este item não está autorizado.
7. **Publicação coordenada:** manter barreiras durante builds; backend compatível antes do frontend novo, ambos READY e aliases no mesmo SHA. Git automático não é atômico. Nenhum deploy manual extra sem pedido.
8. **Smoke autorizado:** com schema e par compatível prontos, reativar Data API e permitir o acesso necessário. A barreira REST termina nesse ponto; outros administradores/produtores permanecem avisados/suspensos. Verificar login,401/403,criação/edição,409/428,MP4 legado/novo,Solo/rascunhos. Sem TikTok real.
9. **Reabertura:** se PASS, repor regras/configurações/Cron/hosts exatamente conforme aprovado; orientar reload. Monitorar5xx/409/428/Auth/Storage/filas/locks. Em falha, fechar admissão e preservar evidências, sem recuperação automática de ACL/dados.

**Escopo da primeira autorização futura proposta:** janela de indisponibilidade; alterações reversíveis WAF/Data API/Cron; parada e dreno dos hosts identificados; espera de URLs; probes negativos explicitamente permitidos; backup privado real e cópia para restauração isolada sem integrações externas. Autorizar abortar/retornar antes de exportar se a barreira falhar. Não incluir migration, repair, merge, deploy ou smoke de escrita produtiva. Rotação/revogação Storage requer autorização adicional se escolhida.

## Histórico preservado — preparação de06 a08/11

Os estados abaixo são registros datados. As pendências locais de HTTP, restauração e bindings foram superadas no ensaio de08/11. Para o ambiente hospedado, vale o parecer e checklist de09/11 acima. Não repetir ensaios nem executar comandos históricos sem revalidar escopo e autorização.

---

# Integração do editor — plano de publicação (06/11/2026)

Estado atual: PR #9 aberto em Draft e publicado para revisão. Push exclusivo da integração autorizado; rollout BLOQUEADO pelos gates abaixo. Não há autorização de produção. Branch codex/integracao-editor-20261106, base main9187b72; incorpora PR8 05cbc5a, concorrência7bc2e6a e limite3936153. Branches originais preservadas. Nenhuma alteração de layout ou limite durante integração.

## Gate isolado atualizado — 08/11

**APROVADO COM RISCOS RESIDUAIS**: ensaio completo e recuperação operacional real concluídos; evidências/reprodução em [relatório isolado](ISOLATED-ROLLOUT-20261108.md). Bindloopback, freeze total do laboratório com dreno/locks, backup prérevision,20/50/histórico local,cutover,cliente antigo428,409concorrente,permissões/MP4 e frontend real sobre restore passaram. GNUtar com xattrs é obrigatório para o Storage local. Nenhum dado produtivo copiado.

Produção permanece BLOQUEADA até definir/verificar a barreira de todos os ingressos hospedados, especialmente Storage/URLs antigas,API antiga/jobs, e autorizar backup real privado com recuperação comprovada. Dockerstop não é receita equivalente no Supabase hospedado. API_WRITES_PAUSED não é freeze global. Se não houver barreira comprovada ou expiração/dreno observáveis,NÃO executar DDL. A alternativa mais segura pode exigir indisponibilidade total temporária.

## Correção de teste

Falha api-mobile `origens distintas no mesmo destino...`: NaN ao dividir por dimensão do radar. Marcadores podem existir antes do carregamento da imagem; boundingBox sem espera não garante geometria válida. Ajustado teste para complete/naturalWidth e expect.poll nas razões com mesma precisão0.001; sem sleep, relaxamento de assert ou mudança da aplicação. Teste dirigido desktop/mobile passou. Resultado da suíte final consta no checkpoint.

## Evidências e limites

Builds backend/frontend e typecheck;150 backend/63frontend unitários. Testes browser usam API/Auth/Storage simulados e MP4 sintético, sem TikTok real. Concorrência em PostgreSQL17 real isolado:uma escrita ganha e outra retorna UPDATE0; gatilho incrementa versão e preserva mídia/origem/destinos. Script integration-schema-smoke.mjs aplica as11 migrations do repositório em PostgreSQL17.11 descartável sem rede, exercita grants/RLS/is_admin/mídia/rollback e rate limit20/50/janela60min. Auth.uid/users e storage.buckets são schema sintético; não comprova GoTrue/PostgREST/Storage HTTP real. Build local não empacotou yt-dlp porque importador não foi habilitado no ambiente de build. CI Linux precisa ser conferido no SHA final antes de publicação.

## Preflight somente leitura já realizado

Produção: histórico9 versões até20261103120954; revision ausente. reserve_import_source já tem>=20 por owner e>=50global,created_at>now()-1hour,advisory lock762001139,search_path vazio,security invoker,owner postgres,EXECUTE postgres/service_role. Migration20261105210000 ainda ausente. Nova comparação somente leitura retornou body_equivalent=true após normalizar whitespace, assinatura p_owner uuid,retorno import_sources,volatile=true,security_invoker=true,search_path vazio,owner postgres e ACL esperada. Isso comprova equivalência do efeito atual, mas não autoriza reparo do histórico; repetir na janela aprovada. Nenhum attacl explícito de coluna em grenades e nenhuma membership de anon/authenticated/service_role retornados; authenticated mantém UPDATE de tabela antes da migration. Revalidar no momento da aplicação. Leitura não prova ausência de toda RPC customizada: revisar funções security definer/rotas que escrevem grenades no preflight autorizado.

Vercel: usuário confirmou manualmente Root Directory frontend/backend,Production=main,Preview Tracking Disabled,sem Custom Environments ou Deploy Hooks e workflow sem deploy. Ambos os arquivos efetivos possuem bloqueio explícito git.deploymentEnabled=false para a branch de integração. Push e PR9 foram autorizados e realizados,com zero deployments novos nas consultas pós-publicação. CI Linux do HEAD0ab9095 passou no run42275850248. Isso não autoriza merge ou rollout;revalidar configuração antes da janela.

## Ordem exata após aprovações separadas

1. Conferir SHA final/main/CI, configuração Production Branch=main e Preview Tracking off nos dois projetos. Confirmar deploys conhecidos para retorno e preservar configurações/flags atuais. Revisar disponibilidade das pessoas e janela; não ativar importadores nem alterar limites.
2. Definir responsável,barreira hospedada,duração e destino privado do backup. Autorizar separadamente backup/restauração de dados reais e manutenção. Preparar configurações/roles/Auth, inventário Storage e artefatos compatíveis. O ensaio sintético não constitui backup produtivo.
3. Registrar grants/configs/deployments para recuperação. Ativar barreira autorizada de TODOS os escritores:API antiga,diretoSupabase/RPC,Storage/URLs emitidas,jobs/worker. Verificar negação efetiva,dreno e ausência de escritores. Então criar backup FINAL consistente de DB/schema/grants/RLS/triggers/Auth/histórico e objetosStorage sob a mesma barreira;validar TOC/checksums e restauração operacional isolada autorizada. Havendo drift/caminho ativo,PARAR. Só prosseguir após recuperação comprovada.
4. Reconciliar a migration20: obter definição e comparar corpo normalizado CRLF/LF, assinatura/retorno,linguagem,volatilidade,security invoker,search_path,owner e ACL com estado esperado. Sem alterações semânticas além10→20; se houver divergência, PARAR. Após comprovação registrada e autorização explícita, usar ferramenta oficial de reparo do histórico (`supabase migration repair 20261105210000 --status applied` com versão/escopo remoto conferidos via help). Esse passo altera SOMENTE histórico e não deve reexecutar a função. Não usar db push genérico ou reaplicar antigas; arquivos001..004 correspondem a versões remotas diferentes. Não marcar revision como aplicada neste reparo.
5. Ainda na janela, aplicar exclusivamente20261105170000_grenade_revision.sql por procedimento aprovado que registre sua versão; testar em isolamento previamente o fato de20 já estar registrada apesar do timestamp posterior. Confirmar coluna revision default1,trigger monotônico e grants de tabela/coluna/RLS; confirmar registros e mídias existentes sem mudanças indevidas. A ordem física de efeito20 já ocorreu antes da revisão; os dois scripts são independentes. Nenhuma sessão é apagada/resetada.
6. Autorizar merge SOMENTE do PR de integração para main (não integrar novamente PR8/branches componentes); main dispara os dois deployments quando configuração confirmada. Aguardar API e frontend READY no mesmo SHA antes de liberar edições. As builds automáticas não são atômicas: manter janela durante toda discrepância. Se ordem manual for autorizada, backend deve estar pronto antes do frontend novo. Não disparar redeploys repetidos por padrão.
7. Com autorização de escrita de smoke específica, conta administrativa e dados descartáveis:GET inclui revision;POST1/PATCH2;duas edições da mesma revisão produzem200/409,sem sobrescrita;PATCH antigo sem expectedRevision retorna428;anon/não-admin recusados;MP4 existente e novo,legado sem origem,Solo com destinos,rascunho por conta/reload e reprodução/renovação. Não importar TikTok real sem autorização. Confirmar20/50 por definição/histórico,sem consumir cota para ensaio em produção.
8. Verificar hashes/contagens autorizadas,logs sem segredos e cliente antigo orientado a recarregar. Só então reabrir edição; monitorar409/428/5xx e registrar evidências. Leitura com backend antigo/novo e clientes cacheados precisa ser observada.

## Incompatibilidades e mídia após409

Frontend novo exige revision nas respostas; backend antigo não a fornece. Backend novo exige expectedRevision e clientes antigos recebem428. Migration revoga UPDATE de authenticated, logo backend antigo perde caminho de edição. Não há rollout sem janela de escrita garantido com este contrato. Informar usuários para salvar rascunhos e recarregar após publicação; aba antiga não deve ser tratada como compatível.

Mídia pode ficar ready mesmo se o PATCH retornar409. Serviço valida mídia e conserva mediaId em memória; não repetir PATCH automaticamente nem apagar vídeo. Novo salvar com revisão antiga continuará409. Salvar rascunho não persiste mediaId/File/URL: fechar janela pode perder referência local à mídia pronta, deixando objeto não vinculado. Preservar objeto e cadastro publicado; reconciliar administrativamente sob autorização, não coletar automaticamente nem afirmar que rascunho recupera o upload. Reabrir com revisão atual e revisar antes de nova publicação; eventual reaproveitamento do mediaId exige fluxo suportado/validação de propriedade, nunca alterar estado privado no navegador por fora.

## Recuperação

Falha antes do DDL: manter deployments antigos e janela; reparar histórico somente com evidência/autorizações. Falha após revision: manter schema aditivo e dados, parar novas escritas e preferir corrigir adiante/publicar par compatível. Promover backend antigo isoladamente NÃO é rollback seguro: seus PATCH perderam UPDATE e cliente novo exige revision. Se retorno ao par antigo for expressamente aprovado, restaurar grants exatos registrados após avaliar que isso remove proteção CAS; não remover revision/trigger nem restaurar banco inteiro sobre novos dados por padrão. Rollback de código não reverte histórico,grants,Storage ou banco. Preservar mídias órfãs para investigação. Falha em smoke: manter edição suspensa e reportar; nenhuma repetição automática de importação ou migração.

## Gates antes de produção

Confirmação atual de disparos Vercel; backup/restore aprovado; CI final; validação real Auth/PostgREST/Storage em ambiente autorizado ou aceite explícito de sua ausência; simulação de cutover com cliente antigo; autorização separada de reparo do histórico,DDL,merge/deploy e escrita de smoke. Abertura de Draft não atende esses gates.

## Bloqueio Git publicado

frontend/vercel.json e backend/vercel.json preservam única regra false para codex/integracao-editor-20261106,sem wildcard conflitante. Configuração já publicada no PR9; roots e ausência de hooks confirmadas manualmente pelo usuário. Não repetir conferência antiga como pendência resolvida; revalidar somente se houver mudança relevante ou antes da janela.

## Revisão de risco e compatibilidade real — 06/11/2026

Novas leituras produtivas confirmam9 migrations até20261103120954,ausência de revision e da versão20;função efetiva20/50,lock/janela preservados,ACLpostgres/service_role e search_path vazio. grenades tem RLS,políticas SELECTpúblico e INSERT/UPDATE/DELETE autenticado condicionado a is_admin;UPDATEauthenticated de tabela ainda presente. Nenhum ACL explícito por coluna,membership das roles consultadas ou função public/private cujo corpo referencie grenades foi encontrado. Busca textual não é prova contra SQL dinâmico/extensões/caminhos externos.

Migrationrevision não colide com coluna/trigger/função já existente segundo leitura atual;antes de aplicar confirmar também private.grenade_revision() ausente. Triggergrenade_ready existente deve coexistir,sem remover ou desabilitar. Conferir versãoPostgreSQL,locks longos,tamanho/tempo esperado do ALTERTABLE e disponibilidade de proprietário;usar lock_timeout/statement_timeout aprovados para falhar sem bloquear indefinidamente. Se timeout:ROLLBACK e abortar rollout,sem retry automático.

### Matriz de gates restantes

| Gate | Evidência atual | Falta para aprovação |
|---|---|---|
| CAS/migrations/grants/RLS | PostgreSQLreal11migrations e disputa2sessõesPASS | Preflight e aplicação autorizados no ambiente destino |
| Auth/REST/Storage reais integrados ao novo backend | Não executado nesta entrega;harness antigos apontam labs de terceiros/alguns consultam TikTok | Nova stack sintética exclusiva com GoTrue/PostgREST/Storage,sem reutilizar dados/volumes/labs existentes |
| Admin vs usuário comum,401/403,409/428 | APIcontrolada e PGreal cobertos | Repetir por HTTP com loginGoTrue real na stack nova |
| MP4/upload/reprodução/Solo | BrowserfixturePASS,integridade de mídiaPGPASS | UploadStorage real,Range/playback/hash e client antigo/novo no mesmo ensaio |
| Backup/restauração | Procedimento abaixo preparado | Execução privada explicitamente autorizada e restore comprovado |
| Reconciliação histórico20 | Definição equivalente por leitura | Reparar histórico com autorização e registrar evidência |
| Janela de escrita | Somente orientação operacional | Bloqueio efetivo para todos os admins/abas/API;acordo verbal ou esconder botão não basta |

Containers antigos em execução não foram alterados,nem lidos seus segredos. Não execute source-preview-local-e2e.ts:contém fontesTikTok/Reels reais e limpeza;solo-local-e2e.mjs exige nome/portas/credenciais de lab histórico. Adaptar para stack nova é trabalho pendente,não integração aprovada. Usuário autorizou testes isolados,mas não uso de dados reais nem interferência nesses labs. Nenhum E2EHTTP real foi alegado nesta revisão.

## Backup privado reproduzível — somente após autorização específica

1.Escolher diretório NOVO fora do Git e de sincronização cloud,criptografado,com ACL exclusiva ao operador/Admin/SYSTEM e espaço verificado;sem links/reparsepoints. Criar manifest privado de IDs de projeto,PostgreSQLversão,horárioUTC,SHAs de aplicação/migrations e ferramentas. Credenciais via PGSERVICEFILE/PGPASSFILE privados,sem senha em argumento/log/chat;papel de leitura com privilégios suficientes para Auth/Storage/schema. Não usar credencial parcial e anunciar backup completo.
2.Conferir pg_dump/pg_restore17 compatíveis e usar conexão direta/session-mode suportada,não transactionpooler. Backup-base consistente em um único archivecustom cobre schemas public,private,auth,storage,supabase_migrations e dependências. Modelo de comando,não executado:
```powershell
pg_dump --dbname="service=pcdnades_backup_read" --format=custom --file="$backupDir/database.dump" --verbose 2> "$backupDir/pg-dump.log"
if ($LASTEXITCODE -ne 0) { throw 'Backup falhou: não prosseguir.' }
pg_restore --list "$backupDir/database.dump" > "$backupDir/toc.txt"
if ($LASTEXITCODE -ne 0) { throw 'Archive inválido.' }
Get-FileHash -Algorithm SHA256 "$backupDir/database.dump"
```
Não usar --no-acl/--no-owner no backup-mestre. Um dump completo pode conter segredos de Auth/Vault;mantê-lo privado e só executar com escopo autorizado. Extensões/schemas geridos não devem ser restaurados cegamente em outro projetoSupabase. Inventariar roles/memberships/grants/configuraçãoAuth e dependências;roles-only dump pode conter passwordhashes e exige aprovação/armazenamento privado. Capturar configurações via interfaces oficiais,sem publicar valores. ArchiveSQL não inclui configurações de serviço Auth/SMTP/JWT nem bytes dos objetosStorage.
3.Storage:por SDK/API oficial com permissão de leitura,listar todos os buckets relevantes (videos-staging,publicados,prévia e outros encontrados),paginar até terminar e preservar chaves relativas,metadados,tamanhos,ETag/versão quando disponível. Copiar bytes para destino privado mantendo bucket/chave;calcularSHA256 de cada objeto baixado e manifest. Nenhuma URL assinada ou token no manifest público. Comparar contagem/tamanhos/hash;relistar para detectar drift. Não tratar metadados storage.objects como backup de arquivos.
4.Restore em NOVO ambiente isolado explicitamente autorizado,sem egress/SMTP/webhooks externos e sem chaves de produção. Primeiro ensaiar com dadosSINTÉTICOS;dados reais só após autorização específica. Preparar roles/extensões/serviços compatíveis,restaurar archive com pg_restore --exit-on-error em banco vazio por procedimento aprovado;conferir erros/TOC/schema/FKs/policies/grants/triggers/funções/histórico. Configurar Auth/Storage locais para não emitir e-mails ou chamar endpoints externos. Se usar --no-owner em cópia de ensaio,documentar e testar ACL/roles separadamente:isso não prova restore exato de permissões.
5.Restaurar bytesStorage por mecanismo compatível do destino sem duplicar incorretamente registros de metadata. Confirmar contagem eSHA256 de objetos,referências grenades→media,estado ready,hash dos dados relevantes,login de conta de teste autorizada,is_admin,negações anon/viewer,playbackRange e roles. Authusers sem sessão/configuração/JWT compatível não comprova recuperação de login. Registrar PASS/FAIL de cada camada,sem declarar sucesso parcial como restauração integral.
6.ConsistênciaDB+Storage:dump usa snapshot transacionalDB,mas não snapshot atômico de objetos. Backup-base pode ocorrer antes da janela;após suspender TODOS os escritores/importadores/coleta que alterem dados relevantes e drenar operações,verificar drift e produzir backupfinal/delta e manifest de objetos estável,com revalidação/restore. Se houver writers não controlados,parar:backup entre camadas não é consistente. PausarCron/serviços seria alteração remota que requer autorização separada;nenhuma foi executada aqui.
7.Guardar hashes/logs/resultado de restore em manifest privado,segregar senha de criptografia e testar acesso pelo responsável de recuperação. Não apagar backups anteriores;retention/eliminação só com autorização. Falha de integridade,permissão,drift ou restore impede rollout.

## Checklist operacional final — cada mutação requer autorização

1.Autorizar/realizar backupbase privado e restoreisolado;revalidar HEAD/CI/preflight/configVercel e nomear responsável pela janela.
2.Ativar bloqueio REAL de novas escritas para todos os admins/API/abas,drenar uploads/processing/requests e controlar escritores de fundo;confirmar zero operações em voo. Nenhum mecanismo remoto de manutenção foi provisionado nesta tarefa. Finalizar backupcoerente/delta após freeze e validar antes de DDL.
3.Revalidar equivalência exata da função20 e metadata/ACL;registrar evidência privada. Com autorização,usar repair oficial SOMENTE20261105210000applied,não executar novamenteSQL nem dbpushgeral. Validar histórico e função inalterada.
4.Aplicar exclusivamente20261105170000 por procedimento transacional aprovado que registre versão. Capturar schema/grants antes;validar default1,trigger incremento,grenade_ready preservado,RLS/policies e ausência UPDATEauthenticated/colunas/memberships/atalhos. Testar sequência de histórico fora da ordem numérica em ensaioCLI antes;não corrigir isso reaplicando antigas.
5.Autorizar merge únicoPR9 em main. BloqueioGit é exato para branch integração,portanto não impede deploymain;não reutilizar regra false geral. Não integrar PR8/componentes novamente.
6.Aguardar API/frontendREADY e aliases no MESMO SHA;manter freeze durante builds não atômicas. Se operação manual for autorizada,API compatível primeiro,frontend depois. Não promover deployment antigo do backend isoladamente após migration.
7.Executar smoke de escrita explicitamente autorizado com dados descartáveis:loginadmin/viewer,401/403,create/GETrevision1,PATCHrevision2,duas edições200/409,clienteantigo428,UPDATEdireto negado,MP4upload/playback/hash,legado/Solo/rascunhos. Sem TikTokreal. Nenhuma mídia publicada deve ser substituída pelo teste.
8.Conferir integridade e erros,reabrir escritores de forma coordenada;orientar reload/recuperação de rascunho e manter edição suspensa se clientes antigos persistirem sem controle.
9.Monitorar5xx/409/428/Auth/upload/playback e locks durante janela acordada. Em falha:fechar escrita,preservar logs/mídias e decidir correção adiante/retorno com responsável. Restaurar backup completo sobre dados novos causa perda e exige aprovação específica;preferir schemaaditivo e recuperação seletiva. Reabrir apenas após smokePass.

Conclusão histórica de06/11:BLOQUEADO para rollout. Motivos:backup/restauração não executados;integraçãoHTTP realAuth/PostgREST/Storage e cutover/cliente antigo não comprovados;bloqueio efetivo de escrita e reparo/aplicação ainda não autorizados. PR9 é revisável,mas não autorização de produção.

## Evidência incremental de08/11/2026 — primeira rodada histórica, superada pela continuação

Ver docs/ISOLATED-ROLLOUT-20261108.md:HTTPGoTrue/PostgREST/Storage comMP4,409/428 epermissões PASS emstacknova sintética;backup/restauraçãodeDB/AuthmetadataeStoragebytesPASSparcial. API_WRITES_PAUSED implementada defaultfalse,testada,masnãoéfreezeglobal. Faseisolada permaneceBLOQUEADA porbind0.0.0.0(stackprópriaparada),drain/barreiraDBStorage,sequênciacompleta eaplicaçãorestauradaHTTP/frontendpendentes. PendênciasanterioresHTTPparcialmente superadas por essa evidência,sem chamarfullE2Eaprovado.
