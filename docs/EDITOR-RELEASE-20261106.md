# Editor: preflight operacional hospedado — 09/11/2026

**Parecer: BLOQUEADO para solicitar execução conjunta de manutenção/backup.** A estratégia suportada e verificável está preparada, mas ainda faltam a confirmação dos escritores externos e a cobertura efetiva dos controles no projeto. A fase técnica isolada permanece **APROVADA COM RISCOS RESIDUAIS**. Seus ensaios não foram repetidos.

Primeira ação pendente: o responsável confirmar os executores com acesso SQL, Storage, service_role ou S3 e os controles WAF/Data API disponíveis no painel. A página URL Signing Keys é opcional para a alternativa de espera de2h. A autorização seguinte poderá limitar-se à manutenção, sua verificação e ao backup/restauro, com interrupção antes da exportação se qualquer escritor continuar ativo. Não se propõe alterar permissões ou desenvolver funcionalidades.

## Inventário hospedado somente leitura

Leituras de 09/11 são observações independentes, não um snapshot transacional único. Revalidar na janela. Referência PR9: `30e691157b2878da309845820928d1bd3947678e`; main remota: `9187b72bf15906b0112a736503b35b68f3d4b297`. PR continua Draft.

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
| Outros executores | pg_cron/pg_net instalados, pgmq ausente; sem FDW ou trigger customizado de Auth observado. Sessão postgres observada era pg_net worker idle | Worker batch do repo usa SQL direto e Storage; os conectores não inventariam Docker, VPS, agendadores e credenciais S3 externos |
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

Alternativa operacional viável: inventário manual completo, janela total e espera T0+2h. Se não for possível conter emissores ou comprovar dreno do Storage, solicitar ao Supabase uma barreira de ingresso suportada antes de agendar a execução. Não improvisar revogações de permissões.

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
