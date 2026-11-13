# Preflight final — PR #19, incluindo PR #20, para main

13/11/2026, America/Sao_Paulo. Inspeção independente, exclusivamente de leitura e planejamento. Repositório: Lipe-meira/pcdNades. Evidência resumida e sem segredos em [evidence.json](evidence.json).

## Decisão

**NO-GO para integrar à main no estado atual.** Existem três impedimentos concretos para executar a publicação agora: conflito documental não resolvido, schema produtivo ainda anterior às duas migrations e backup manual conhecido que não cobre os cadastros recentes.

O código aprovado é **tecnicamente viável como fundação inativa**, com as três flags false e o schema completo. Não identifiquei novo bloqueador de implementação no recorte desta análise. Isso não substitui os gates operacionais abaixo nem autoriza executar a sequência. Ativação pública continua **NO-GO separado**, pelos riscos residuais documentados.

| Gravidade | Item | Classificação e ação proposta |
| --- | --- | --- |
| Alta | Backend novo antes do schema completo | Bloqueador de publicação: importações administrativas exigem a RPC nova mesmo com flags false. Aplicar as duas migrations, após autorização/backup e antes de o novo backend receber tráfego. |
| Alta | Backup conhecido anterior aos novos cadastros | Pré-requisito de recuperação não cumprido. Atualizar backup consistente de banco e objetos e verificar restauração em destino expressamente autorizado. |
| Média | Conflito em `docs/continuity/orchestrator.md` | Bloqueador mecânico de integração. Conciliar os dois históricos e o estado atual sem descartar registros. Nenhuma correção foi implementada. |
| Informativa | Flags ausentes, padrão false | Condição atual segura quanto à admissão colaborativa; documentar/confirmar as três false na futura versão de produção. Não alteradas nesta tarefa. |

Os itens de schema/backup são pré-requisitos operacionais não cumpridos, não vulnerabilidades novas atribuídas ao PR. Não há achado crítico novo neste recorte. O NO-GO imediato pode ser revisto após resolver o conflito e cumprir os gates com autorização específica.

## 1. Estado exato das referências

| Referência | Estado observado |
| --- | --- |
| main | `e0ad9806804a3d554e03ff540b99d86d5319b3e4` |
| PR #19 | OPEN, HEAD `3596428942e51b526b75af7de23e842961ee3451`, branch `feat/colaboracao-identidade` |
| PR #20 | MERGED no #19 em `1689f66789f5e0386dc0774136ae7e1ac10c90ab` |
| HEAD aprovado do #20 | `f6dc3143b84d0e5bc521205e1efa0bb8160acd7a` |
| Base comum auditada | `8776ddf4d3658b1d5ecf8d91a5e13760047d8f50` |

A main avançou um commit desde a base informada no pedido: `e0ad980`, atualização do README e checkpoint. **Backend, frontend, workflows e configurações de código não mudaram nesse avanço.** A referência Git de main foi lida diretamente; o campo `base_sha` do PR ainda apresentava8776ddf e não foi usado como prova da ponta atual.

Integridade do PR20:

- `f6dc314` é ancestral de3596428.
- `git diff f6dc314 1689f66` é vazio: árvore do merge igual à aprovada.
- De1689f66 para3596428 mudaram apenas o encerramento e os checkpoints de backend/orquestrador; implementação, migrations, configuração e workflows permanecem idênticos.
- O encerramento foi lido em [3596428](https://github.com/Lipe-meira/pcdNades/blob/3596428942e51b526b75af7de23e842961ee3451/docs/ENCERRAMENTO-PR20-20261113.md), junto ao documento de colaboração e à análise de órfãos/retentativas.

**Conflitos:** GitHub retorna `mergeable=false`, `mergeable_state=dirty`. O único arquivo modificado pelos dois lados desde a base comum é `docs/continuity/orchestrator.md`. Uma comparação textual de três versões, usando `git merge-file -p` em cópias temporárias apenas desse documento, encontrou **um bloco conflitante**. Não foi executado merge de branches, não houve alteração de index/implementação nem resolução automática. O README novo só mudou na main; deve ser preservado.

Proposta pontual de resolução futura: colocar o estado de integração mais recente no topo, conservar o registro de publicação do README e o encerramento PR20 abaixo, e manter os dois históricos. Depois conferir que o delta de código contra o aprovado continua vazio e que não restam marcadores de conflito. Fazer isso apenas em tarefa autorizada; não rebasear/reescrever branches.

## 2. Compatibilidade de aplicação e cobertura reaproveitada

O PR não altera o frontend. A API acrescenta `author` à granada e `contributors` a capabilities. Os validadores existentes de `mapApiGrenade` e `checkCapabilities` verificam os campos conhecidos e aceitam campos adicionais; não encontrei rejeição desses acréscimos na interface atual. Essa é análise estática, não teste novo em navegador.

Com flags false, a resolução de ator aceita a administração existente e bloqueia publicação colaborativa. Sem contribuidores/vínculos, granadas históricas permanecem com autor nulo; vídeos e leitura pública continuam usando os IDs e `storage_key` persistidos. Não é necessário renomear os objetos históricos de `clip-N.mp4` para `clip.mp4` para reproduzi-los.

**A integração não é totalmente inerte:** o PR20 muda o caminho administrativo de corte inline, independentemente das flags colaborativas. A chave de saída passa a ser determinística, a adoção valida/decodifica o objeto e falhas transitórias específicas preservam o lease/retentativa. O processamento e a recuperação de cortes administrativos precisam constar do smoke futuro.

O backend novo chama `claim_import_slot(uuid,integer,uuid)` em três superfícies: [inspect](https://github.com/Lipe-meira/pcdNades/blob/3596428942e51b526b75af7de23e842961ee3451/backend/src/import-api.ts#L23), [processamento de importação](https://github.com/Lipe-meira/pcdNades/blob/3596428942e51b526b75af7de23e842961ee3451/backend/src/import-processing.ts#L30) e [prévia](https://github.com/Lipe-meira/pcdNades/blob/3596428942e51b526b75af7de23e842961ee3451/backend/src/preview-api.ts#L20). Esses caminhos administrativos não ficam protegidos pela simples desativação da colaboração. O worker novo também consulta `contributor_id`. **Sem schema novo, publicar o backend/worker novo é incompatível.**

Evidências reaproveitadas, com os SHAs conferidos:

| Evidência | Resultado e limite |
| --- | --- |
| [GO independente PR20, e16b1fc](https://github.com/Lipe-meira/pcdNades/blob/e16b1fc34d0d20dd5bb388c529703f16a5cbad43/docs/REVALIDACAO-PR20-20261113.md) | R1/R2 encerrados;44/44 focados, com FFmpeg onde indicado; não é repetição independente do laboratório. |
| CI aprovado f6dc314 — [43332518278](https://github.com/Lipe-meira/pcdNades/actions/runs/43332518278) |322/322 e build/bootstrap/trace/MP4 registrados na revisão. |
| CI pós-merge1689f66 — [43427094800](https://github.com/Lipe-meira/pcdNades/actions/runs/43427094800) | success confirmado; implementação igual à aprovada. |
| CI do HEAD3596428 — [43427675942](https://github.com/Lipe-meira/pcdNades/actions/runs/43427675942) | success confirmado nesta tarefa. |
| Laboratório-r72 aprovado |29 verificações do fluxo,8 cenários corrigidos de adoção/recuperação e48 tabelas sintéticas restauradas; hashes conferidos pela revisão independente. Não contém dados de produção. |

Não reinstalei dependências, não repeti suítes extensas ou laboratórios e não copiei dados reais para testes. As verificações adicionais foram metadados remotos, ancestralidade/igualdade de código, comparação textual do conflito, leitura estática e catálogos/agregados SQL em transações `READ ONLY`. Não houve chamada administrativa POST para testar a falha contra produção.

Cobertura desta tarefa: integração/compatibilidade e pré-requisitos operacionais. Não é uma nova auditoria integral dos77 arquivos do PR. Como a main só mudou documentação e o código do PR20 está intacto, não há justificativa para refazer toda a auditoria de autorização/órfãos já aprovada.

## 3. Banco atual, cadastros e mídias

Consultas somente de leitura no projeto Supabase dedicado, PostgreSQL17.11. Estado observado entre13:20 e13:28UTC de13/11 (10:20–10:28 em São Paulo):

- 13 migrations registradas; última `20261111031252 map_levels`.
- `contributors`, `contributor_links`, `private.import_slot_usage`, `author_id`, `contributor_id`, `storage_charge_bytes` e a RPC de três argumentos **ainda não existem**.
- A assinatura antiga de `claim_import_slot(uuid,integer)` existe; EXECUTE apenas service_role, não anon/authenticated. `reserve_import_source` e `release_import_slot` têm a mesma restrição.
- 19 granadas,25 mídias e21 entradas em `storage.objects`; soma declarada de104.741.093 bytes nos metadados. Não foram baixados arquivos nem comprovado o inventário físico remoto nesta tarefa.
- Último cadastro de granada em12/11 às23:46:37UTC (20:46:37 São Paulo), posterior ao backup manual conhecido.
- No instante da leitura: zero mídias awaiting/queued/processing, zero leases de mídia/slot e zero fontes de importação ainda válidas. **Isso não é uma barreira de manutenção e não impede operações iniciadas depois da leitura.**
- Nenhuma granada publicada sem mídia ready nem sem registro correspondente no Storage. Duas mídias ready não publicadas continuam sem registro de objeto, condição histórica já documentada; não foram alteradas. Não apareceu objeto sem referência de `storage_key` nessa comparação de metadados; ela não prova presença física ou ausência de saídas em voo.
- Bucket `videos-staging` privado, limite50.000.000 bytes, MIME video/mp4. RLS ativo em grenades/media_assets; policies administrativas/read pública coerentes com o schema anterior. service_role tem bypass RLS e privilégios de servidor; authenticated não tem UPDATE direto em grenades, como previsto no fluxo de revisão existente.

## 4. Migrations necessárias, ordem e impacto

Aplicar **somente depois de autorização, backup e validação do estado no momento da janela**:

| Ordem | Arquivo no PR3596428 | SHA256 do conteúdo |
| --- | --- | --- |
|1| `backend/migrations/20261112120000_contributors_authorship.sql` | `c8583390cfb0b0fb2306372582a83dd8619d837575562164f6d60c8ae2cbb633` |
|2| `backend/migrations/20261112180000_contributor_storage_and_import_pools.sql` | `70d7dad58f60d6e460cd790c23b02ad08cd710df79fe823ad501506ed784b2fd` |

Pré-requisitos identificados: schema inicial, Auth, revisão, origens/andares, mídias/import_sources e slot antigos. O histórico produtivo contém as migrations anteriores relevantes. Não reaplicar as13 migrations existentes ou versões antigas de migration2, que foi editada durante a revisão antes de sua aplicação remota.

**Migration1:** cria contribuidores e vínculos; adiciona autoria/dono estável com FK e índices; ativa RLS e revoga acesso público às tabelas novas; RPC de cadastro e helpers são SECURITY INVOKER, EXECUTE apenas service_role. Triggers mantêm autoria/dono imutáveis, restringem vídeo do próprio autor e cotas. A policy INSERT administrativa passa a exigir também `author_id IS NULL`; o backend anterior já insere sem autor, portanto continua compatível.

**Migration2:** adiciona cobrança com default0; substitui o trigger de mídia por reserva/contabilização/admissão atômicas; cria relatórios read-only e orçamento de tempo; preserva a RPC antiga e acrescenta a assinatura de três argumentos. Adapta reserva/release sem mudar seus contratos antigos. A tabela privada de uso tem RLS e grants apenas de servidor. Funções de quota/relatório não ficam executáveis por clientes anon/authenticated.

**Com colaboração desativada:** ninguém deve ganhar vínculo pelo fluxo público. Administradores e registros históricos ficam sem contributor/author e fora das cotas colaborativas de mídia. Reservas administrativas mantêm20/h individuais e50/h totais. A RPC nova continua registrando uso do slot para operações administrativas e expurgando apenas histórico privado de uso com mais de2h quando chamada; flags false não eliminam esse trabalho. Ela não apaga granadas, mídias ou objetos.

As migrations não removem dados ou objetos existentes nem transferem autoria histórica. Há locks de DDL, criação de índices, novos triggers/policies e dependência do cache de schema do PostgREST; programar janela curta e conferir contagens, hashes e ACLs antes/depois. A ausência de rewrite explícito não significa risco operacional zero.

**Backfill:** como esta produção ainda não tem tabelas/vínculos colaborativos, inicializar cobrança0 para o histórico administrativo é coerente e não exige cobrar todos os vídeos antigos como contribuição. Se a implantação encontrar colaboração prévia inesperada, migração parcial ou reaplicação após rollback2, parar e preparar reconciliação/backfill específico: reaplicar migration2 não reconstrói cobrança de linhas existentes. Não automatizar essa correção nesta tarefa.

## 5. Configuração e publicação automática

Conector Vercel e painel autenticado foram usados apenas para leitura, sem revelar segredos. Os controles omitidos pelo conector foram conferidos nas páginas de ambientes/Git/build:

| Projeto | Produção | Preview Branch Tracking | Hooks | Deployment produtivo atual |
| --- | --- | --- | --- | --- |
| pcdnades | main; auto-assign de domínios ligado | desmarcado; Save desabilitado | zero | `dpl_BQ1Eab5mSsadoqfGqByS8jDRG5JW`, READY, e0ad980 |
| pcdnades-api | main; auto-assign de domínios ligado | desmarcado; Save desabilitado | zero | `dpl_ArRES8ns9g2R7tce63HxbMGWQ3Sg`, READY, e0ad980 |
| pcdnades-preview-api | sem Git conectado | sem integração Git | não configuráveis sem Git | não acionável pelo push desta branch |

As páginas de produção dizem que cada commit enviado à main cria Production Deployment. O histórico também mostra registros produtivos para o commit documental e0ad980 nos dois projetos. **Merge/push na main é uma operação de publicação**, mesmo que a intenção seja só incorporar código com flags desligadas. A opção de ignorar builds sem alteração de raiz não deve ser tratada como barreira contra um PR que modifica backend.

API configurada com root `backend`, Fastify, Node24.x, install `npm ci`, build `npm run build`, Ignored Build Step Automatic. Isso é compatível com o package/build aprovado; não foi encontrada necessidade de trocar hospedagem para a fundação inativa inline-original. A versão do runtime e os binários hospedados ainda precisam da verificação pós-deploy autorizada.

Metadados de env: hiddenProductionEnvCount=0; nenhuma das três variáveis colaborativas existe. Em `config.ts`, ausência equivale a false e combinação filha=true/parent=false falha no startup. A documentação principal de colaboração e backend descreve as flags, embora `.env.example` ainda não as liste; o runbook precisa usá-las explicitamente:

```dotenv
CONTRIBUTORS_ENABLED=false
CONTRIBUTOR_UPLOADS_ENABLED=false
CONTRIBUTOR_IMPORTS_ENABLED=false
```

Não inserir essas flags nem habilitar anonymous sign-ins/CAPTCHA nesta tarefa. Recomendo configurar/confirmar false de forma explícita na janela autorizada, sem misturá-las às flags administrativas existentes.

Configuração administrativa observada: upload, recorte, TikTok e prévia habilitados; modo inline-original, TikTok temporary, duração90s. Instagram não aparece configurado e o código tem padrão false. Os três flags colaborativos false **não devem desligar esses fluxos administrativos existentes**. O requisito de produto20s diverge do ambiente90s; é uma pendência anterior, não introduzida pelo PR, e não foi alterada. Alinhar em decisão separada antes de ativação pública.

Não há custom environments nos dois projetos, confirmado pelo conector. GitHub: zero repository webhooks; somente os dois workflows conhecidos, frontend/backend CI, sem etapa de deploy/migration, secrets Supabase ou chamada Vercel. Não há outro PR aberto além do19. As branches antigas foram preservadas; não significa que não exista trabalho local em andamento em outros chats. Não é possível excluir automações pessoais/contas externas não declaradas; a prova de ausência de acionador limita-se às configurações e mecanismos conhecidos conferidos.

**Push documental deste preflight:** somente na branch não-main `codex/preflight-pr19-20261113`, com previews/tracking desligados, zero hooks e workflows apenas CI conferidos. Nada será enviado à main ou ao PR19. Essa comprovação habilita apenas a entrega documental prevista pelo pedido; não habilita deploy/preview manual.

## 6. Backup e riscos dos dados atuais

No destino manual conhecido, o diretório mais recente encontrado continua `release-20261111-nuke-premigration`. Os diretórios anteriores foram preservados; nenhum backup novo foi criado e nenhum dump real foi lido/importado. O checkpoint registra naquela cópia15 granadas,21 mídias e17 objetos, com restauração então verificada. Agora existem19/25/21 e novos cadastros posteriores: **aquela cópia não é um ponto de recuperação completo para o estado atual**. Não avaliei backups automáticos do provedor ou outros destinos não declarados.

O backup novo precisa incluir banco (public/private/Auth/Storage/histórico de migrations, roles/definições necessárias) e bytes dos objetos em inventário com tamanhos/hashes, além do registro privado da configuração operacional necessária. Não colocar chaves, `.env`, URLs assinadas ou conteúdo privado no Git. Retenção, destino e eventual laboratório com dados reais dependem de autorização explícita; o laboratório sintético aprovado não autoriza importar dados reais.

Pausar novas escritas/emissões e drenar processos conhecidos para obter cópia consistente. Os zeros observados de fila/leases não garantem que não existam URLs antigas válidas, requisições ainda em outro deployment ou escritores externos. Não presumir TTL universal2h nem extrapolar o TTL60s do laboratório para produção. A medição que emite nova assinatura é operação separada, não executada aqui. Definir uma janela conservadora para capacidades já emitidas ou uma alternativa aprovada; nenhuma rotação/revogação está autorizada.

Não limpar as duas mídias históricas sem objeto, objetos de tentativas, fontes retidas ou reservas como parte dessa integração. Novos caminhos não exigem renomear arquivos antigos. Preserve fontes e saídas necessárias à recuperação e à biblioteca já publicada.

## 7. Sequência futura de integração e publicação

**Plano, não executado.** A proposta mantém `backup → validações → migration1 → migration2 → integração → deploy → smoke`, com preparação anterior e gates:

1. **Preparar candidato:** autorizar a conciliação documental do conflito em branch própria, preservar o README da main e os checkpoints. Reconfirmar HEADs e árvore de implementação aprovada; se houver delta novo de código, revisar esse delta antes de prosseguir. Executar/aguardar o CI do candidato/merge futuro, sem refazer laboratórios extensos por mudança só documental.
2. **Autorizar janela e barreira:** confirmar operador, destino/retensão de backup e limites do smoke; pausar novas edições/uploads/importações e os agendamentos que escrevem, com procedimento de retorno. Conferir escritores, deployments antigos e capacidades assinadas. Não contar apenas com flags colaborativas.
3. **Atualizar backup:** copiar banco e objetos de forma consistente, verificar hashes/contagens e comprovar a restauração da cópia nova em destino explicitamente autorizado. Preservar backup anterior e o baseline19/25/21 ou o novo total observado na janela.
4. **Validar schema de origem:** conferir novamente histórico, definições, grants/RLS/triggers, dados e ausência de instalação parcial. Confirmar que o SQL a aplicar tem os hashes desta revisão. Drenar transações para os locks de DDL.
5. **Aplicar migration1 e depois2:** somente por operador/ferramenta autorizados. Registrar versões; comparar dados/objetos e invariantes. Confirmar que PostgREST enxerga a RPC de três argumentos e que anon/authenticated não ganharam acesso. Se faltar cache/assinatura ou houver migração parcial, parar antes do código novo.
6. **Gate com backend anterior:** com schema completo, confirmar health/leitura pública e fluxo administrativo antigo, especialmente inspect/reserve/release e o mínimo de mídia autorizado. O SQL foi desenhado para essa convivência; esse gate permite interromper sem publicar o backend novo.
7. **Confirmar flags e integrar:** manter as três false na versão que será publicada. Somente então autorizar merge normal do19 na main. Não repetir o merge do20. Essa ação disparará publicação automática; não criar deploy manual duplicado.
8. **Acompanhar publicação:** confirmar o deployment da API no commit integrado, runtime/config e domínios corretos. Acompanhar também o frontend; se seu build for ignorado por ausência de mudanças, comprovar a igualdade do código atual em vez de forçar preview/rebuild. Não reabrir escrita antes do gate da API.
9. **Smoke autorizado e comparação:** executar os itens abaixo, rever erros/filas/objetos, confirmar flags false e contagens esperadas; restaurar agendamentos/escrita apenas após resultados aprovados. Não habilitar colaboração ao reabrir administração.
10. **Encerrar:** registrar commits, migrations, deployments, inventário e riscos residuais; parar. Qualquer ativação pública precisa de nova aprovação.

Antecipar as migrations ao merge é essencial porque main publica automaticamente. Fazer merge primeiro e “corrigir o banco depois” cria janela de incompatibilidade administrativa. Depois de aplicar SQL aditivo, abortar a publicação mantendo o backend antigo é preferível a remover schema imediatamente sem necessidade.

## 8. Smoke, verificação final e recuperação

### Smoke mínimo proposto

- `/health`, mapas, listagem/detalhe, Nuke/HE/Solo e playback de mídia existente; nenhum cadastro antigo muda.
- Capabilities com três flags false; visitante sem sessão e sessão não-admin não publicam, editam, enviam ou importam como contribuidores.
- Login/admin e edição com revisão; teste controlado de cadastro/remoção apenas se autorizado, com identificação clara da fixture e comparação dos totais esperados.
- Upload simples, corte e complete repetido; arquivo publicado intacto; corte novo usa chave determinística e cobrança/metadados coerentes.
- Inspect/importação/prévia administrativas que já estavam habilitadas continuam autorizadas e usando a RPC nova. Downloads de provedores externos precisam da autorização específica correspondente; usar apenas conta/arquivo/URL aprovados.
- Erro transitório de adoção não publica objeto inválido e preserva retomada após lease; não provocar falha destrutiva em vídeos existentes. A prova extensa de falhas já existe em laboratório sintético.
- Grants/RLS/triggers/RPCs, dados, inventário de objetos e três flags comparados com baseline; frontend não deve depender de UI colaborativa inexistente.

READY na Vercel não equivale a smoke HTTP ou persistência verificados. Esta tarefa não executou esses testes produtivos.

### Retorno em falha

1. Manter pausa, três flags false, logs/inventário e dados novos preservados. Não executar expurgo ou restauração automática sobre gravações posteriores.
2. Se SQL ainda não foi aplicado, não publicar código novo. Se migration1 entrou e2 falhou, não avançar ao backend novo; diagnosticar a instalação parcial sob autorização.
3. Se schema completo entrou e a publicação falhou, manter o backend anterior compatível com as duas migrations; preferir correção adiante. Não há obrigação de desfazer DDL aditivo para abortar o merge.
4. Se o backend novo recebeu tráfego e precisa voltar, restaurar o deployment/backend **e todos os workers** compatíveis primeiro, conferir health/inspect e só avaliar remoção de schema depois. Uma troca de código pode alterar auto-assign na Vercel; conferir o estado no procedimento de retorno, sem presumir comportamento.
5. Para remoção completa aprovada: `20261112180000_contributor_storage_and_import_pools_rollback.sql` e depois `20261112120000_contributors_authorship_rollback.sql`. Backend novo não pode coexistir com rollback2; flags false não substituem compatibilidade. Rollback2 perde cobrança/histórico e rollback1 perde autoria/vínculos; preservar cópias e reconciliar antes de qualquer reaplicação.
6. Restauração total de banco/Storage é último recurso e precisa de autorização e reconciliação de dados novos. O backup anterior de11/11 não deve sobrescrever os cadastros atuais.

## 9. Riscos exclusivos ou principalmente da ativação pública

Não reclassifique os itens abaixo como regressões novas ou correções pendentes de R1/R2 já encerrados:

- Órfãos de **upload inline com corte** do cenário E03 foram tratados pelo PR20; a classe de risco em importações `import-N.mp4` e worker administrativo `playback-N.mp4` continua separada. Não prometer teto físico absoluto com base só na cobrança SQL.
- TTL produtivo e tokens históricos, janela SQL150min, reserva após abandono/falha e reconciliação/backfill em reaplicação.
- Capacidade física e margem para fontes/saídas, múltiplas identidades anônimas, CAPTCHA, rate limits e cabeçalhos confiáveis; slot/CPU continuam compartilhados, sem prioridade administrativa garantida.
- Interface não repete automaticamente todos os503 de adoção; ffprobe ainda pode classificar falha local como conteúdo inválido; decode lento pode esgotar tentativas.
- Dois processos hospedados independentes não foram comprovados pela corrida entre módulos do laboratório. Gateway/TLS gerenciados, provedores, dispositivos e recuperação de identidade/UI colaborativa precisam de seus próprios gates.
- Divergência20s de produto versus90s configurados é anterior e continua visível. Não alterar de forma incidental na integração inativa.

## 10. Autorizações ainda necessárias e encerramento

Esta tarefa não autoriza corrigir o conflito do PR, aplicar SQL, criar backup novo, usar dados reais em laboratório, configurar flags/pausa, parar Cron/processos, trocar deployments ou integrar a main. Precisa de aprovação específica para:

1. Conciliação documental e preparação do candidato final do19, sem modificar sua implementação aprovada.
2. Janela operacional, backup atualizado, destino/retensão e verificação de restauração; smoke de escrita limitado e provedores, quando necessários.
3. Migrations na ordem1→2 e seus gates de conferência.
4. Merge do19 na main com ciência de publicação automática e plano de retorno; confirmação das três flags false na versão publicada.

Nenhuma nova credencial foi solicitada, nenhum recurso pago foi contratado, nenhum laboratório foi iniciado e nenhuma configuração produtiva foi alterada. Não houve force-push/reset/rebase, exclusão de dados/objetos, merge/deploy, migration remota, PR B/C ou mudança de implementação.

Documentação entregue em branch própria não-main após conferir os controles de preview/hooks/CI. O parecer termina aqui, aguardando autorização para qualquer operação posterior.
