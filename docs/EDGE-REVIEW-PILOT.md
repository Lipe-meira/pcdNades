# Coletor Edge — revisão e piloto futuro

Atualizado em 04/11/2026: PR #4 integrado; PR #5 já baseado na main. Não repetir a troca de base. A prévia não está aprovada para ativação. Consultar `PR5-TECHNICAL-CORRECTIONS-20261104.md` para o instalador corrigido e os procedimentos atuais; mudanças desta revisão permanecem locais, sem push.

## Evidências e pendências

O SQL da migration final foi validado em PostgreSQL local com rollback. Posteriormente, o laboratório hospedado comprovou gateway, limpeza sintética com Storage real, dez ciclos de três minutos com a migration final, alerta DOWN e recuperação HTTP204 com e-mail UP. Cron desativado e Healthchecks pausado ao final. Não repetir esses ensaios. Testes Deno permanecem simulados. Faltam falhas e concorrência reais, operações em voo após timeout ou lease, interoperabilidade Edge/runner e fechamento hospedado após oito minutos. O ping é apenas observabilidade; a autorização da prévia depende do heartbeat no banco.

A migration revoga a RPC antiga de heartbeat e exige rollout coordenado do runner atualizado. Uma operação em voo pode concluir após cancelamento; conferir seus efeitos antes de liberar o piloto. A revisão automática rejeitou uma harness PowerShell/Deno para injeção de falhas e concorrência com PostgREST/Storage locais, sem motivo adicional. Não repetir a ação por fragmentação, comando equivalente ou troca de ferramenta. Obter procedimento expressamente permitido antes de executar esse ensaio.

## Escopo histórico do piloto (não executar novamente sem nova aprovação)

1. **Ambiente:** identificar ambiente remoto de teste separado e confirmar quotas gratuitas, isolamento, ausência de dados reais e procedimento de descarte. Criar recursos somente com autorização específica; não assumir disponibilidade de um terceiro projeto Supabase.
2. **Banco:** autorizar separadamente backup e aplicação da migration revisada nesse ambiente, com conferência de histórico, grants, RLS, lease/CAS e plano de reversão. Preservar RPC e compatibilidade do runner durante a sequência coordenada.
3. **Função e segredos:** autorizar deploy da Edge Function e configuração privada de token de invocação, acesso ao Storage, Vault e URL de monitor. Testar rejeição de chamadas não autorizadas e proteção dos logs.
4. **Cron:** autorizar job de teste a cada três minutos. Confirmar respostas efetivas e heartbeat, não apenas enfileiramento via pg_net. Executar dez ciclos observados, com limpeza real e hash de vídeo final preservado.
5. **Monitor:** autorizar check externo gratuito e destinatário, sem enviar dados de usuários. Confirmar falta de ping em falha, alerta recebido e recuperação após sweep completo. A flag da prévia exige autorização independente.
6. **Interrupção e recuperação:** suspender o job de teste quando houver falha, manter flag desligada e preservar objetos/logs. Investigar lease, fila, respostas Storage e heartbeat. Corrigir no ambiente de teste, recuperar por sweep completo e repetir os cenários afetados. Nenhum rollback de código deve excluir dados.

Critérios de aprovação incluem autorização correta, 10 ciclos dentro da cadência, Storage real, falhas e concorrência sem heartbeat indevido, preservação de vídeos finais, fechamento após oito minutos e entrega efetiva de alerta e recuperação. Fontes e limites: [Supabase Cron](https://supabase.com/docs/guides/cron), [limites Edge](https://supabase.com/docs/guides/functions/limits), [preços Edge](https://supabase.com/docs/guides/functions/pricing) e [Healthchecks.io](https://healthchecks.io/pricing/). Em 31 dias, um ciclo a cada três minutos representa cerca de 14.880 invocações, sujeitas a quotas compartilhadas e custos de Storage/egress. Healthchecks oferece plano gratuito limitado. Confirmar preços e disponibilidade antes de provisionar.
