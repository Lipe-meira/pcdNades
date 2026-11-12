# Validação integrada isolada — PR #19

Data: 12/11/2026, America/Sao_Paulo. Projeto: Lipe-meira/pcdNades.
Implementação examinada: **352c0e177602fc1e6e79fe817960f92c76286f43**.
Backend anterior: **8776ddf4d3658b1d5ecf8d91a5e13760047d8f50**.
Branch documental: `codex/validacao-integrada-pr19-20261112`.

## Parecer

- **GO técnico para integração inativa**, com as três flags false, duas migrations exatas presentes ANTES de o backend novo receber tráfego, backup verificável e implantação coordenada. Os caminhos administrativos reais examinados continuam funcionando. Este parecer não autoriza merge/deploy nem atesta o schema atual de produção, que não foi consultado.
- **NO-GO para ativação pública**. A perda de lease seguida de retentativa deixou um objeto físico fora da cobrança SQL; a premissa de validade de upload divergiu no Storage local; ainda faltam capacidade operacional, política antiabuso/CAPTCHA e validação dos provedores autorizados. Os detalhes e limites seguem abaixo.

Nenhum arquivo de implementação de `backend/` ou `frontend/` foi alterado. Nenhum merge, deploy, migration produtiva, configuração Vercel/Supabase remoto ou download TikTok/Instagram foi executado. A branch própria contém apenas documentação e infraestrutura de validação. Produção, seus backups e suas credenciais não foram usados.

Resultado consolidado: **43 verificações com resultado esperado**, mais isolamento e dump/restore. São28 da matriz principal, cinco sondagens adicionais, seis de compatibilidade e quatro de TTL/rate limit/expiração. A expectativa inicial A07 reprovada foi preservada e substituída pelo reteste T04 corrigido. Isso inclui reproduções de riscos: a igualdade entre cobrança e ocupação física sob perda de lease **reprovou**, mesmo com reprodução bem-sucedida. Não se trata de43 critérios de ativação aprovados.

## Componentes e isolamento comprovado

| Componente | Utilizado de verdade |
|---|---|
| Docker | Desktop/Engine 29.7.2; Compose |
| Banco | PostgreSQL 17.11, imagem `postgres:17` identificada por digest na evidência |
| Auth | GoTrue `v2.197.0`; signup anônimo, login por senha, refresh e logout reais |
| Data API | PostgREST `v14.12`, JWT e troca real de roles |
| Storage | `v1.84.19`, backend de arquivos em volume novo, buckets privados |
| Aplicação | Fontes exatas do PR em Node 24.22.2; HTTP por Fastify, supabase-js 2.118.0 |
| Processamento | FFmpeg 5.1.9 real; ffprobe do pacote do projeto; worker real |
| Dados | Apenas sessões, usuários, mapas do repositório e MP4s sintéticos |

A stack principal é `pcdn-pr19-352c-20261112-r5`, com rede `-internal` (`Internal=true`), volumes `-db` e `-objects` novos e seis containers. Nenhuma porta foi publicada no host; os testes rodam pelo runner dentro da rede. A tentativa TCP de saída retornou `ENETUNREACH`. Cada container pertence exclusivamente à rede própria; nenhum é privilegiado, nenhum recebe socket Docker ou diretório de backups. O único mount do host é o diretório ignorado desta execução, com fixtures e credenciais sintéticas; o banco também recebe seu SQL de bootstrap próprio.

Inventário anterior à tarefa: **61 containers e 38 volumes**, todos preservados. O inventário de r5 inclui também as tentativas anteriores desta tarefa: 85 containers e 46 volumes. Docker estava desligado; sua inicialização fez alguns containers anteriores voltarem pelas próprias políticas de restart. Não foram emitidos comandos de start/stop/remove para esses recursos. As stacks preliminares próprias foram paradas; nada foi excluído.

Limite: é uma stack Supabase montada com serviços reais e schema compatível em PostgreSQL comum; não é um clone do serviço gerenciado, de seu gateway, extensões, TLS, quotas do plano ou configurações atuais. O gateway local é um roteador HTTP transparente, sem substituir Auth, PostgREST, SQL ou Storage. Não prova isolamento contra comprometimento do Docker/host. A CLI Supabase não estava no PATH; Compose permitiu manter todos os listeners fora do host.

## Migrations, compatibilidade e recuperação

Todas as migrations anteriores do diretório `backend/migrations/` foram aplicadas em banco vazio sintético. Depois, nesta ordem:

1. `20261112120000_contributors_authorship.sql`;
2. `20261112180000_contributor_storage_and_import_pools.sql`.

Catálogos reais confirmaram RLS nas cinco tabelas examinadas, cinco RPCs/overloads relevantes sem EXECUTE por anon/authenticated e com EXECUTE por service_role, além dos triggers de autoria/estado/revisão. Ambas as assinaturas de `claim_import_slot` foram expostas corretamente pelo PostgREST. Consulte `evidence/catalog.json` para os nomes e resultados exatos. O bootstrap usou os grants e funções Auth compatíveis; os serviços executaram suas próprias migrations internas.

O backend anterior continuou criando uploads administrativos após cada migration. O teste adicional com os dois backends reais por HTTP exercitou inspeção administrativa com **extração de metadados controlada**, mantendo Auth, RPC e banco reais:

| Schema | Backend anterior | Backend novo |
|---|---|---|
| As duas migrations | inspect 201 | inspect 201 |
| Após rollback2 | inspect 201 | inspect 503, controle negativo esperado |
| Após rollback2 → rollback1 | inspect 201 | não utilizado nesse schema |

Os hashes do conteúdo comum de **14 mídias e uma granada** permaneceram iguais no ensaio adicional de rollback. A assinatura nova é necessária mesmo com as flags false; portanto backend e workers compatíveis precisam preceder a remoção do schema.

Foi gerado um `pg_dump -Fc` sintético usando pg_dump17 e restaurado em outro banco descartável do mesmo cluster. **48 tabelas** de public/private/auth/storage tiveram contagens e hashes de linhas iguais. SHA256 do dump: `501ab584b3163fc8fa7c82219c1dac9446844050e246444e410cbfbd3c09bf20`. O dump binário fica no diretório ignorado, sem segredos no Git; a evidência contém apenas hashes e contagens.

Também foram salvos contribuidores, vínculos e autoria sintéticos antes dos rollbacks. Após reaplicar a primeira migration, seis contribuidores e seus vínculos/autorias foram recuperados. A restauração de autoria exigiu suspensão **transacional e exclusiva de triggers de usuário no banco descartável**, pois autoria é imutável por contrato. Isso demonstra possibilidade de recuperação administrativa; não é rotina pronta nem autorização para fazer o mesmo em produção.

**Ressalva operacional comprovada:** reaplicar migration2 sobre mídias existentes deixa `storage_charge_bytes=0`. Não reativar contribuições após esse caminho sem reconciliar/backfill dos arquivos existentes. Rollback1 remove autoria/vínculos; rollback2 remove contabilidade/histórico de slots. Backup e preservação de objetos são indispensáveis.

## Autenticação, autorização e flags

Passaram com sessões reais:

- Visitante lê mapas/biblioteca; escrita sem sessão retorna401.
- A e B são anônimos diferentes; escolher o mesmo apelido não une identidades ou propriedade.
- Publicação usa vídeo próprio e autoria derivada do vínculo do UID, não do corpo.
- Dono edita; B não edita a granada de A nem publica com seu vídeo; contribuidor não exclui.
- Administrador exclui; biblioteca e playback público de conteúdo publicado continuam funcionando.
- PostgREST recusa leitura direta de vínculos e execução das RPCs privilegiadas por visitante/A/B; `is_admin()` distingue usuário/admin.
- Refresh preserva UID; logout global invalida refresh e o backend retorna401. **PostgREST continua aceitando o JWT assinado enquanto válido**, sujeito ao mesmo RLS; isso é relevante para expectativas de revogação.
- Todas as flags false preservam administração; parent=true/filhas=false não libera mídia/importação; worker-transcode anuncia/recusa upload colaborativo; desligar uploads bloqueia complete de operação iniciada, mas não revoga a capacidade de upload já entregue.

A prova original A07 esperava401 logo após `exp` e recebeu200 no PostgREST. É uma expectativa incorreta da harness: PostgREST14 admite30s de tolerância de relógio, conforme sua [documentação de autenticação](https://docs.postgrest.org/en/v14/references/auth.html#time-based-claims-validation). O reteste T04 espera essa tolerância antes de julgar expiração; GoTrue devolve403/bad_jwt para o token expirado e PostgREST401. O resultado original foi preservado, sem reclassificá-lo como bypass do PR.

CAPTCHA externo não foi chamado nem configurado. Para a prova local de rate limit, o gateway deve sobrescrever `X-Forwarded-For` com o endereço do socket e GoTrue deve receber `GOTRUE_RATE_LIMIT_HEADER=X-Forwarded-For`. Só configurar a quantidade sem o cabeçalho não limitou o cadastro nesta stack. Isso não atesta a configuração do gateway gerenciado. A configuração inicial de1000/h foi deliberadamente permissiva para as fixtures; o teste específico usa2/h.

## Storage e processamento físico

| Cenário | Resultado observado |
|---|---|
| Inline simples | ready; fonte175.766 bytes, cobrança175.766; complete repetido não aumenta attempts |
| Corte1–3s | fonte175.766 + saída55.820 =231.586 bytes; cobrança igual |
| Worker administrativo | ready com FFmpeg real; fonte e playback físicos preservados; fora da cota colaborativa |
| Upload colaborativo em worker |403 antes de reservar |
| Colaborador já queued | worker marca failed/PROCESSOR_UNSUPPORTED, mantém50MB; nenhum playback criado |
| Arquivo falso | failed; reserva50MB mantida |
| Arquivo >50.000.000 bytes / MIME errado / caminho trocado no token | Storage real400 nos três casos |
| Vídeo privado sem publicação | B/visitante não conseguem ler; playback público404 |
| Complete tardio com vagas ocupadas |12 chamadas HTTP simultâneas →12×429, reserva preservada |
| Complete simultâneo da mesma mídia |12 respostas200/202; uma tentativa de processamento |
| Abandono | arquivo/linha aguardando e reserva50MB permanecem |
| Reuso sem upsert | objeto existente não é sobrescrito |
| Exclusão de objeto com token válido | token permite reenviar o mesmo caminho; flags não o revogam |
| URL de leitura curta | funciona antes e retorna400 após expirar |

Antes do rollback, o inventário `storage.objects` tinha **10 objetos / 1.485.413 bytes**. A leitura independente dos **10 arquivos no volume físico** confirmou a mesma soma; hashes SHA256 foram registrados. Fontes de administradores e contribuidores foram incluídas. A comparação por mídia no corte foi exata. Após reaplicar migration2, o inventário físico continuou existindo, mas a cobrança zerou por desenho da migration; as evidências separam esses dois instantes.

Depois dos testes adicionais, o inventário final tinha **14 arquivos / 1.948.585 bytes**, incluindo o órfão de retentativa. Objetos sintéticos e backups foram preservados. Todas as cinco stacks criadas nesta tarefa foram paradas ao encerrar; nenhum container, volume, rede ou backup foi removido. Recursos anteriores permanecem intactos.

### Risco confirmado: órfão em retentativa

E03 expirou, por trigger de falha **restrito a uma mídia sintética**, o lease quando o backend entrou em `storing`. Não substituiu FFmpeg, download local do Storage, upload ou banco. A primeira tentativa armazenou `clip-1.mp4` e perdeu a atualização final; o complete retornou202. A segunda tentativa concluiu `clip-2.mp4`.

- Físico: fonte175.766 + clip1 55.820 + clip2 55.820 = **287.406 bytes**.
- Cobrança SQL: fonte + saída atual = **231.586 bytes**.
- Diferença: **55.820 bytes não contabilizados**.

O caso E03 está PASS na harness porque a reprodução esperada foi comprovada. **A garantia “ocupação física total sempre coberta pela cobrança SQL” está REPROVADA sob essa falha.** O risco já estava descrito na revisão, mas agora existe prova com arquivos físicos. Não demonstramos que um usuário consiga provocar deliberadamente essa falha. Ainda assim, o teto400MB não deve ser apresentado como teto físico absoluto antes de resolver órfãos ou reservar margem para todas as tentativas/fontes/saídas.

### Diferença de validade das URLs

O token efetivamente emitido pelo Storage1.84.19 nesta stack tem `exp-iat=60s`, e o código da imagem usa esse padrão quando `UPLOAD_SIGNED_URL_EXPIRATION_TIME` não existe. A premissa documental de7200s não corresponde a este ambiente. A descrição “2h token not time-waited” no resultado bruto S10 era uma hipótese, **não medição**; T01/T02 a substituem. Não inferir a validade de produção a partir desta versão/configuração local. O TTL real do ambiente de ativação deve ser medido/configurado e refletido na operação e no cliente.

## Importações: o que foi real e o que foi controlado

Auth, HTTP da aplicação, PostgREST, RPCs, cotas e slots foram reais. Somente a extração de metadados em `inspect` foi fornecida por fixture, declarada nos scripts; não houve acesso a TikTok/Instagram.

- A consegue seis inspeções; a sétima recebe429/IMPORT_RATE_LIMIT.
- B não seleciona a fonte de A:404.
- 20 reservas colaborativas somadas não impedem o administrador de usar suas20/h.
- Oito claims simultâneos via PostgREST têm um único vencedor; liberação de outro holder não solta o slot.
- Fixture de400s consumidos produz IMPORT_RATE_LIMIT; administrador mantém acesso ao slot.
- Lease real de slot de1s expirou naturalmente; o novo titular foi preservado diante da liberação atrasada do titular antigo.
- O backend anterior usa a assinatura antiga; o novo usa a de três argumentos, sem ambiguidade de overload.

Não foram validados download real de provedores, reextração de conteúdo externo, conclusão completa de importação TikTok/Instagram ou prévia/Edge/Cron. O tratamento específico de indisponibilidade/mudança de conteúdo do provedor continua pendente em ambiente e conta de teste autorizados. A cota protege reservas, mas o slot continua compartilhado: uma contribuição pode causar PROCESSOR_BUSY transitório ao administrador; não existe prioridade física comprovada.

## Política operacional proposta — não implementada

1. Manter flags colaborativas desligadas enquanto não houver decisão de capacidade física, antiabuso e órfãos. Reservas abandonadas podem esgotar a contribuição mesmo com pouco disco utilizado.
2. Usar relatórios SQL somente leitura e inventário físico completo para classificar cada mídia, fonte, saída e tentativa. Nunca decidir por uma única `storage_key` ou só pelo status failed/awaiting_upload.
3. Excluir da elegibilidade qualquer objeto publicado/referenciado, fonte de importação válida, lease ativo ou capacidade assinada ainda válida. Várias identidades não ampliam o orçamento global, mas permitem esgotá-lo rapidamente.
4. Parar novas emissões, esperar **a maior validade efetiva de tokens já emitidos**, tolerância e margem operacional; flags sozinhas não invalidam assinaturas. Não reduzir a espera porque um serviço novo passou a emitir tokens mais curtos.
5. Produzir dry-run e backup/manifesto; conferir estabilidade em duas leituras. Reconciliar objetos e só liberar reservas depois de comprovar que não há reenviabilidade, referências ou processamento em voo.
6. Uma futura limpeza deve usar caminhos exatos, leases/checagens de versão, auditoria e idempotência. Não remover prefixos amplos ou atualizar contabilidade antes de contabilizar órfãos. Nenhuma rotina destrutiva automática foi escrita ou executada.

## Plano de implantação seguro — não executado

1. Aprovar separadamente correções/decisões residuais e limites de produto20s; confirmar capacidade, versões de Auth/Storage e validade real de uploads. Configuração local usou MEDIA_MAX_DURATION_SECONDS=20; o padrão90s do código não foi alterado.
2. Coordenar publicação automática de main, parar novas escritas/emissões/processamento conforme necessário e obter backup consistente de banco **e** objetos. Testar restauração e preservar autoria/configurações.
3. Conferir hashes do SQL aprovado, schema anterior e grants; aplicar migration1 e depois2 **antes** do backend novo. Se já existir contribuição de instalação anterior, reconciliar/backfill, não presumir que a coluna inicializada em0 cobre os objetos.
4. Publicar backend/worker novos com as três flagsfalse; validar leitura pública, login/admin, upload simples/corte, inspect e assinaturas RPC. Só depois liberar administração conforme janela autorizada.
5. Antes de ativar, resolver a diferença física em retentativas ou aprovar solução que garanta capacidade; validar CAPTCHA com chaves de teste do provedor, gateway/cabeçalhos confiáveis, limites por rede e respostas reais do frontend.
6. Ativar por etapas aprovadas: identidade com filhasfalse; uploads só inline-original em configuração suportada; importações após teste de provedor especificamente autorizado e orçamento operacional. Monitorar reservas, bytes físicos, órfãos, slots, latência/admin e disco livre.
7. Em falha, desligar flags e preservar dados/objetos. Para rollback de schema: backend/worker compatíveis primeiro, confirmar inspect/admin, rollback2 e então1 somente com backup da autoria. Não restaurar dump sobre dados novos automaticamente.

## Evidências, reprodução e limitações

Os resultados brutos ficam em `evidence/`; não incluem chaves, senhas, JWTs completos, URLs assinadas ou dumps. `runtime*/` é ignorado e contém somente dados/credenciais **sintéticos**. Os43 arquivos de fontes/migrations dentro do container tiveram hashes iguais aos da worktree. `git diff 352c0e1 -- backend frontend` não contém alteração.

As primeiras rodadas falharam por preparação da harness: search_path/ownership Auth, grants de roles Storage, FRONTEND_URL ausente, permissão do ffprobe com npm --ignore-scripts, mapa de fixture com ID incorreto e uso de opção GNU find numa imagem BusyBox. Corrigidos na infraestrutura; resultados anteriores preservados localmente. A expectativa de tolerância JWT e o cabeçalho do rate limiter também foram corrigidos; não são regressões atribuídas ao PR. Nenhum resultado de PGlite/mock foi usado como evidência integrada nesta entrega.

Para reproduzir em uma **worktree própria**, com Docker e sem `.env` real:

```powershell
node docs/validation/pr19/prepare.mjs -r6
docker compose -f docs/validation/pr19/runtime-r6/compose.json build runner
docker compose -f docs/validation/pr19/runtime-r6/compose.json up -d
node docs/validation/pr19/isolation.mjs -r6
node docs/validation/pr19/launch.mjs -r6
docker cp docs/validation/pr19/extended.ts pcdn-pr19-352c-20261112-r6-runner-1:/app/backend/lab-extended.ts
docker exec pcdn-pr19-352c-20261112-r6-runner-1 node --import tsx lab-extended.ts
docker cp docs/validation/pr19/compatibility.ts pcdn-pr19-352c-20261112-r6-runner-1:/app/backend/lab-compatibility.ts
docker exec pcdn-pr19-352c-20261112-r6-runner-1 node --import tsx lab-compatibility.ts
node docs/validation/pr19/expiry-launch.mjs -r6
```

Escolher outro sufixo se já existir; o preparo recusa sobrescrever a configuração. Os scripts não são adequados a um banco existente: constroem fixtures e ensaiam rollbacks exclusivamente no recurso criado para esta validação. `compatibility.ts` deve ser executado por último entre os testes de schema; deixa o banco após rollback1. O teste de expiração pode então operar só em Auth/Storage/PostgREST. Parar apenas a stack própria ao terminar e preservar volumes/dump até decisão do usuário. Nenhuma instrução de remoção ampla acompanha esta entrega.

Permanecem fora da cobertura: frontend em navegador/dispositivos, gateway/TLS gerenciado, capacidade e quotas reais do plano, CAPTCHA externo, provedores reais, Edge/Cron/prévia, carga prolongada/fairness e restauração de produção. Esses limites impedem declarar a ativação pública pronta.
