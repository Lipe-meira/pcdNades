# Evidências da execução r5

Implementação352c0e177602fc1e6e79fe817960f92c76286f43; fontes e migrations inalteradas. Todos os usuários, objetos e dados são sintéticos.

- `results.json`:28 cenários aprovados e A07 reprovado por expectativa incorreta da harness (expiração sem os30s de tolerância do PostgREST). A leitura GoTrue esperava401; a API real usa403/bad_jwt. Consulte o reteste corrigido de expiração.
- `extended-results.json`:cinco reproduções aprovadas. **E03 PASS significa reproduzir um defeito**, não aprovar a garantia física de capacidade. O órfão tem55.820 bytes.
- `compatibility-results.json`:seis verificações com backends reais. C04 espera503; é controle negativo após remover a RPC nova, não falha de compatibilidade no schema completo.
- `expiry-results.json`:T01/T02/T03, incluindo TTL60s medido, expiração natural e limite real de novas sessões.
- `auth-expiry-results.json`:T04 corrigido, expirando naturalmente, com tolerância do PostgREST e refresh do mesmo UID. Reteste focado em token30s na mesma stack; o teste original usava120s.
- `catalog.json`:RLS, grants de EXECUTE, overloads e triggers examinados.
- `backup-restore.json`:48 tabelas reais comparadas após pg_dump/restore, contagens e hashes iguais; sem conteúdo de credenciais.
- `inventory-before-rollback.json`:mídias/cobranças e objetos ANTES da remoção da contabilidade; fontes e saídas incluídas.
- `inventory.json`:instante posterior à reaplicação das migrations; cobrança zero das linhas preexistentes é uma ressalva operacional, não economia de disco.
- `physical-{sizes,sha256}.txt`:inventário independente do volume no instante do backup,10 arquivos/1.485.413 bytes.
- `physical-final-*.txt` e `objects-final.json`:inventário após os testes de falha/retry, com objetos órfãos preservados.
- `isolation.json`:rede única interna, zero portas publicadas, mounts, imagens, bloqueio de egress e preservação de recursos existentes. Não contém os ambientes dos containers.
- `source-sha256.json`:43 arquivos de implementação/migrations no container, comparados com a worktree.

Resultados brutos preservam hipóteses iniciais: o texto de S10 sobre2h não era uma medição; T01 comprovou60s nesta versão/configuração. Nenhum JWT, senha, chave, URL assinada ou dump foi incluído. Logs de preparação e tentativas anteriores ficam apenas em `runtime*/`, ignorados pelo Git. O relatório registra suas causas, sem atribuí-las ao produto.
