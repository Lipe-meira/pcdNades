# Capacidade da importação TikTok — 31/10/2026

## Conclusão e escopo

90 segundos não são confiáveis no caminho síncrono atual. Com 1 vCPU, todos os perfis de 90s ultrapassaram os 40s do encoder. Não aumentar somente esse timeout: autenticação, rede, validação, Storage, finalização e lease também precisam caber no prazo. Recomendação: worker assíncrono para manter o requisito de 90s; API com limite reduzido de 30s é uma alternativa de piloto, ainda sujeita à validação real na Vercel e à concordância sobre o limite de produto.

Nenhum downloader, upload MP4, contrato, flag ou timeout de produção foi alterado. YouTube/Instagram permanecem desabilitados. Nenhum push, deploy, migration remota, variável remota ou contratação foi feito. Commits f7bdbba, 32ac6b3 e 3da729a preservados; base desta análise eef597b.

## Evidência recuperada e metodologia

Resultados completos: `IMPORT-CAPACITY-RESULTS.csv`. Evidências privadas/MP4/scripts operacionais: `backend/vendor/capacity-20261031/`, ignorado pelo Git. Não versionar esse diretório. Matriz de 11 casos e dois casos sintéticos concluída antes da interrupção; todos os JSONL finais foram recuperados, sem repetir downloads nem benchmarks nesta retomada.

Linux, imagem oficial node:24-bookworm-slim, limite de 1 vCPU/2GiB, tmpfs de 512MiB, raiz e dependências somente leitura; scripts/resultados em mount próprio. Recursos equivalentes aos parâmetros de CPU/RAM observados no dashboard, não uma reprodução exata do hardware, scheduling ou rede da Vercel. Host compartilhado; uma execução por perfil, sem p95/p99. Algumas execuções ocorreram em containers separados simultaneamente: não inferir precisão estatística dos tempos.

Entrada principal: MP4 autorizado já retido, 10s, 1080×1920, 30fps, H.264/AAC, 2.761.164 bytes, repetido para 30/60/90s. Isso mede encoding/validação, não novo download TikTok nem o custo de decodificar a fonte HEVC original. Entrada sintética adicional: testsrc2 1920×1080/60fps com áudio, 10s repetidos. Nenhuma nova requisição ao TikTok. A matriz anterior de 2 vCPUs/90s levou 57,004s; não foi repetida e não prova escalabilidade linear, inclusive porque encoder usa uma thread.

Todos os outputs aceitos passaram pelo probe e pela decodificação completa usados pelo backend, dentro de 50MB, H.264/yuv420p/AAC e duração selecionada. O benchmark usa timeout exploratório de 120s para medir falhas em relação aos 40s do produto; isso não altera o runtime. `PASS` no CSV significa arquivo válido, não cumprimento do orçamento ou prontidão para produção.

## Resultados principais

Tempos em segundos; MB decimais; RSS é do FFmpeg, não da Function inteira. Perfis 720p preservam orientação (720×1280 para retrato). CRF23, uma thread.

| Entrada retrato / preset | Trecho | Encode | Validação | Encode+validação | CPU encode | RSS MiB | MB final |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1080 original / veryfast | 10 | 8,562 | 1,011 | 9,578 | 8,549 | 245,7 | 2,868 |
| 1080 original / veryfast | 30 | 27,297 | 3,430 | 30,728 | 27,273 | 246,2 | 8,645 |
| 1080 original / veryfast | 90 | 78,214 | 10,247 | 88,463 | 78,165 | 246,7 | 25,961 |
| 1080 30fps / veryfast | 90 | 76,754 | 9,110 | 85,865 | 76,657 | 250,0 | 25,848 |
| 1080 30fps / superfast | 30 | 16,275 | 3,376 | 19,652 | 16,224 | 203,2 | 13,537 |
| 1080 30fps / superfast | 90 | 54,310 | 11,986 | 66,297 | 54,264 | 203,9 | 40,590 |
| 720 30fps / veryfast | 10 | 6,068 | 0,667 | 6,736 | 6,013 | 158,6 | 1,570 |
| 720 30fps / veryfast | 30 | 17,597 | 1,781 | 19,379 | 17,574 | 158,9 | 4,723 |
| 720 30fps / veryfast | 60 | 36,899 | 3,833 | 40,733 | 36,843 | 159,4 | 9,450 |
| 720 30fps / veryfast | 90 | 55,753 | 6,167 | 61,921 | 55,656 | 159,7 | 14,184 |
| 720 30fps / superfast | 90 | 43,111 | 6,508 | 49,620 | 43,021 | 136,8 | 23,943 |

Stress sintético 1080p60 → 720p30/veryfast/90s: encode 48,475s, validação 4,450s, output 16,106MB, RSS145,7MiB. Stress 1080p60 → 1080p30/superfast/30s: encode17,665s, validação4,625s, output38,630MB, RSS190,0MiB. Esse tamanho próximo de 50MB mostra que CRF não garante tamanho baixo em cenas complexas.

Pico amostrado de memória do container principal: até 530.157.568 bytes (~506MiB), incluindo Node/cache, sem simular Auth/HTTP/Storage simultâneos. CPU por encode próxima do tempo de parede: carga predominantemente de CPU no quota de um núcleo. Ocupação incremental amostrada de tmp até ~40,5MB no encoder, além da fonte montada externamente. NÃO é pico de disco do pipeline completo: fonte temporária até100MB, saída até50MB+folga, faststart/cópias e processos concorrentes exigem reserva. O tmpfs512MiB é parâmetro do ensaio, não confirmação do espaço efetivo na Vercel.

SSIM nos primeiros10s, reamostrados à mesma grade: veryfast1080 ~0,9942–0,9949; superfast1080 ~0,9960; veryfast720 ~0,9885; superfast720 ~0,9913. Superfast usa mais bytes; maior SSIM nesse conteúdo não certifica leitura de mira/textos em todos os vídeos. Fonte principal já era H.264 recortada, não benchmark de qualidade contra master HEVC. Frames foram preservados localmente; 720p perde detalhes. Fixar30fps não ajudou na entrada que já tinha30fps, mas reduz trabalho quando a entrada é60fps.

Uma tentativa sintética anterior tinha escala incorreta para paisagem no harness. Foi interrompida, preservada em `stress-720-90`/`stress.log`, corrigida para limitar a maior dimensão e repetida em diretórios `stress-landscape-*-r2`. NÃO incluir a tentativa descartada nas métricas. O runtime do produto não tinha essa alteração experimental.

## Orçamentos e gargalos de ponta a ponta

| Fase | Limite atual / observação |
|---|---|
| Autenticação + is_admin + consulta inicial | Antes de `completeImport`; fora do timer110s. Não há deadline explícito englobando a rota. |
| Inspeção | Requisição separada, extração24s, com proteção própria; não somar cegamente ao complete. |
| Complete: DB/slot/stages | Compartilham AbortController110s, exceto finalizações independentes. |
| Reextração | Até24s; valida novamente fonte/formato. |
| Download temporário | Até40s, limite100MB/32conexões e proxy/DNS protegidos. |
| Probe da fonte | Até10s. |
| Encode temporary | Até40s; range legado até65s, não é solução comprovada para o403. |
| Probe final / decode | Até20s cada, também sob prazo global. |
| Storage | Prazo global; assinatura/removal SDK com espera abortável, sem garantia de cancelamento imediato da requisição subjacente. Leitura do arquivo em memória. |
| Finalização fenced | Até5s próprios; cleanup objeto2s e release slot2s, remoção de diretório sem deadline específico. |
| Lease/slot | 120s, duas tentativas, sem heartbeat. CAS verifica tentativa + locked_until e lease válido. |
| Frontend | Complete150s, monitorGET3,5s, poll3s até300 iterações; inspeção30s. Não cria mais CPU/tempo no servidor. |
| Vercel efetiva observada | Configuração do projeto120s; coldstart, Auth e overhead contam. |

Os máximos individuais não cabem simultaneamente em110s; são tetos, não reservas. Ex.:90s1080 veryfast exige88,5s só encode+validação, além de reextração/download/probe/DB/Storage. Reduzir encoding não prova SLA completo. Mesmo60s720 veryfast deixa apenas3,1s de folga no encoder: não recomendar como limite confiável do MVP.

Fechar UI cancela espera HTTP, não é cancelamento durável garantido do job. O frontend preserva mediaId e pode retomar consultas/complete; isso é recuperação, não execução em background garantida pela Function. Não usar fire-and-forget após responder. Em migração para worker, complete deve enfileirar/responder202 rapidamente, polling observar estados, recuperação ser responsabilidade do worker. Worker legado do projeto é de upload, não TikTok pronto para ligar.

Antes de piloto na API: deadline da rota desde antes do Auth, timeout de consultas, reserva explícita para Storage/finalização/cleanup; testes de relógio e faults. Não aumentar110/120 sem redesenhar lease. Heartbeat ingênuo altera locked_until e invalida o CAS atual: precisa de fencing/claim token estável e testes multiworker. `active` local é liberado antes do cleanup completo; global slot evita processamento paralelo normal, mas deve ser revisado para pressão de tmp/memória.

## Vercel: configuração e viabilidade

Leitura do dashboard nesta investigação: time Hobby, Fluid ligado, Standard1vCPU/2GB, Node24, regiãoiad1, duração120s. Nenhuma configuração salva. Esses são defaults observados, não prova dos recursos do deployment ativo nem teste de preview.

Documentação oficial consultada31/10/2026: Hobby Fluid permite máximo300s, memória2GB/1vCPU; bundle padrão250MB descompactado; request/response4,5MB. O projeto está configurado120s, não300s. Bundle Linux previamente traçado ~203.951.326bytes com9warnings exige auditoria de artefato real, não só comparação aritmética. Upload direto ao Storage deve continuar para evitar passar MP4 no corpo da Function. [Limites](https://vercel.com/docs/functions/limitations), [duração](https://vercel.com/docs/functions/configuring-functions/duration), [memória](https://vercel.com/docs/functions/configuring-functions/memory).

Hobby inclui4h/mês de CPU ativa,360GB-h de memória e1milhão de invocações. CPU de um encode90s78s, isoladamente, daria teto aritmético ~184encodes/4h, antes de qualquer outro trabalho; NÃO é capacidade garantida/cota reservada. Rede e memória também contam. [Uso e preços](https://vercel.com/docs/functions/usage-and-pricing).

API Hobby é candidata para piloto30s, concorrência global1, fonte previamente limitada, rede rápida e orçamento completo validado. Não aprovada para90s pelo ensaio. Pro por si só não corrige timers/lease/fluxo síncrono. H.264/AAC/CRF23, máximo1080p30, superfast é candidato de piloto com melhor margem que veryfast; ainda precisa ser implementado/testado e avaliado visualmente pelo usuário. Perfil720p30/veryfast pode ser alternativa econômica explícita, sem degradação silenciosa. Nenhum perfil experimental foi aplicado ao produto nesta tarefa.

## Alternativas e custos de referência

| Opção | Custo / limitações | Recomendação |
|---|---|---|
| API Vercel Hobby atual | Sem mensalidade dentro das franquias;120s configurados,1vCPU compartilhada por invocações Fluid. | Piloto reduzido, somente após testes reais de hospedagem. |
| Render worker contínuo1CPU/2GB | US$25/mês de compute; rede/Storage/impostos adicionais conforme uso. 0,5CPU/512MB US$7 é menor que o perfil testado e não aprovado por extrapolação. | Arquitetura recomendada para90s; validar encoding/rede no host escolhido. |
| Render cron1CPU/2GB | US$0,00058/min de execução, mínimoUS$1/mês por serviço; não é teto/preço fixo. Espera na fila e inicialização/imagem a cada execução. | Opção de baixo uso e tolerância a espera; precisa adaptar worker/batch e idempotência. |
| Worker próprio/PC | Sem mensalidade de host contratado; energia/manutenção/disponibilidade a cargo do usuário. | Alternativa para validar arquitetura sem contratar, não serviço24h garantido. |

Fontes oficiais: [Render pricing](https://render.com/pricing), [compute plans](https://render.com/docs/compute-plans), [cron](https://render.com/docs/cronjobs). Cron não fornece disco persistente; execuções agendadas sobrepostas aguardam, trigger manual cancela execução ativa. Não provisionado. Custos são referência da data, sem orçamento contratado. Não recomendar GitHub Actions como servidor de fila contínua; histórico de limitações em WORKER.md permanece válido.

Para90s: API autentica/cria job; worker Linux com limites de CPU/RAM/disco/rede executa temporary protegido, transcodifica/valida e publica só resultado final privado; mesma API de playback e contratosready mantidos. Persistir attempts/stages/claim, deadline por tarefa, shutdown com recuperação, retries limitados; reaper de órfãos conservador com rechecagem de referências e quarentena. Não remover objeto de resultado ambíguo/publicado. Manter validações SSRF, DNS, redirects e autorização de conteúdo. Worker não elimina bloqueios futuros do TikTok.

## Recuperação real local e preservação

`recovery.mjs` usou DB/Storage reais da stack Supabase local existente e `completeImport` real. Processamento reaproveitou MP4 autorizado validado, sem novo downloader. SIGKILL em processo Node antes do Storage e após PUT real; lease foi expirado por SQL SOMENTE dos fixtures interrompidos para acelerar ensaio. Não foi espera natural de120s nem interrupção durante encode ativo.

- Antes do Storage: retomada na tentativa2, ready, objetoimport-2.mp4.
- Após Storage antesready: tentativa2 ready; objetoimport-1.mp4 não publicado ficou retido, sem exclusão arriscada.
- Duas interrupções: ATTEMPTS_EXHAUSTED, failed, sem publicação.
- Hash do vídeo originalmente publicado e referência da smoke permaneceram iguais; nenhum objeto excluído.
- Quatro diretórios temporários de processos mortos retidos para análise. Isso confirma que SIGKILL impede finally; cleanup posterior ainda é pendência.

Fixtures adicionais permanecem no banco local. Não confundir com repetição do E2E TikTok original. Falhas Storage/cancelamento/concorrência e renovação de URL anteriores constam em IMPORT-LOCAL-E2E.md; aqui não foram todos repetidos. Não considerar testes simulados como prova de CDN/Vercel.

## Reprodução e estado final

Harness versionável: `scripts/import-capacity-benchmark.mjs`. Com backend compilado e dependências/binários Linux, entrada autorizada offline e diretório de resultados NOVO:

```sh
node backend/scripts/import-capacity-benchmark.mjs /workspace/backend /input/authorized.mp4 /results/new-run
# Um perfil apenas:
node backend/scripts/import-capacity-benchmark.mjs /workspace/backend /input/authorized.mp4 /results/another-run 1080-superfast30-30
```

Executar em container limitado a1CPU/2GiB e tmpfs512MiB, montando código/dependências readonly; nunca usar entrada arbitrária de usuário como comando. Fonte/resultados privados antigos não devem ser sobrescritos. Não executar a matriz de novo se apenas retomar análise. CSV deriva dos11JSONL principais e2stress-r2; não contém URLs, tokens, MP4 ou credenciais.

Na retomada final o daemon Docker Linux não estava disponível (pipe inexistente). Não foi reiniciado porque todos os13casos e o relatório de recuperação já estavam completos. Logo, estado atual individual dos containers/volumes não pôde ser reconfirmado ao vivo. Último estado registrado:5serviços Supabase locais haviam sido iniciados para recuperação, containers de benchmark terminaram; container Linux anterior preservado. Nenhum container/volume/evidência foi excluído. Daemon desligado não prova estado persistido dos serviços; inspecionar após próxima inicialização, sem comandos globais de limpeza. Recursos preservados detalhados em IMPORT-LOCAL-E2E.md; novos containers `pcdnades-capacity-20261031` e `pcdnades-capacity-stress-20261031`.

Nenhuma mudança em src nesta entrega. Resultados anteriores92backendLinux/55frontend pertencem ao código preservado e não foram novamente executados na retomada documental. Validação atual:13outputs e JSONL recuperados, probe/decode e recuperação registrados, sintaxe Node do harness e git diff --check. Fonte/saída ficam fora do Git. Não há aprovação de produção.

## Checklist antes de preview seguro — ordem recomendada

1. Decidir requisito:90s com worker (preferido) ou piloto30s na API; confirmar qualidade/resolução e limites explícitos de fonte, saída e concorrência. Não prometer30s universalmente com estas amostras.
2. Implementar política escolhida incrementalmente, frontend/contratos/config alinhados. Conferir MEDIA_MAX_DURATION_SECONDS efetivo: deploy antigo pode manter20s apesar do contrato90; nenhuma env foi lida/alterada nesta tarefa. Não aceitar silenciosamente divergência.
3. Corrigir orçamento desde Auth/DB e reservas de finalização; para worker, fila/claim/fencing/heartbeat/shutdown antes de aumentar duração. Testar expiração natural, multiinstância, perda de resposta do ready, falha/timeout do Storage e morte durante encode. Manter upload MP4 como regressão obrigatória.
4. Repetir perfis candidatos com fonte HEVC autorizada, CS2 com mira/texto, retrato/paisagem30/60fps, alta complexidade, várias amostras e p95; contabilizar download/coldstart/Storage/tmp/memória. Falha clara acima dos limites; nunca cortar fora da seleção.
5. Auditar bundle Linux real, binários/hashes/permissões e warnings, disco/tmp/CPU/RAM na hospedagem, rede/CDN autorizada. Validar cleanup sem apagar objetos referenciados ou publicação ambígua. Janela/quarentena de órfãos definida.
6. Obter autorização específica para preview/infra e ambiente Supabase REMOTO DE TESTE separado, com migrations em ordem, buckets privados/RLS/admin descartável. Preview não alcança localhost deste PC. Sem credenciais de produção. Nenhum recurso pago sem aprovação.
7. Só após autorização, configurar preview isolado, flags exclusivas do teste (temporary), um único deploy controlado, produção desabilitada. Previews automáticos continuam desativados; não publicar main para testar.
8. E2E real no host:link autorizado→seleção→download→encode→Storage apenas final→ready→smoke→player/seek/renovação com origem bloqueada; repetir faults/retomada/concorrência e provar preservação anterior. Revisar logs sem dados sensíveis e monitorar custos.
9. Apresentar evidências e pedir decisão de produção separada. Funcionar localmente ou em preview não autoriza deploy/flags de produção.