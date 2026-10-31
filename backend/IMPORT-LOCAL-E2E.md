# TikTok → Storage → player: validação local real

Data: 31/10/2026, fuso America/Sao_Paulo.

**Resultado: o caminho completo funcionou no ambiente local isolado.** O administrador entrou pelo frontend, informou o TikTok autorizado, selecionou10–20 segundos, importou, salvou a granada e reproduziu o MP4 armazenado. Nenhum serviço remoto do pcdNades foi acessado ou alterado. Isso não autoriza produção.

## Ambiente e isolamento

- Worktree: `C:\Users\felip\.codex\worktrees\pcdnades-dev\nadesCs2`, branch `dev`. Commits `f7bdbba` e `32ac6b3` preservados, sem reset/rebase/merge/push/deploy.
- Stack exclusiva: `pcdnades-e2e-20261031-a7f4`, CLI oficial2.102.0 instalada isoladamente.
- Banco: `127.0.0.1:55422`; Auth/REST/Storage: `http://127.0.0.1:55421`; backend: `http://127.0.0.1:55430`; frontend: `http://127.0.0.1:55431`.
- Guardas dos scripts conferiram hostname/portas, identificação do container, ausência de vínculo remoto e inventário anterior antes das escritas. Auth, banco, API e Storage apontaram exclusivamente para a stack local. O acesso público ao TikTok foi somente para o exemplo autorizado.
- Configuração, chaves locais, credenciais descartáveis, manifestos e scripts ficaram em `backend/vendor/local-integration-20261031/`, ignorado pelo Git. Nenhum `.env` existente foi sobrescrito. Relatórios não incluem senhas, tokens, cookies ou URLs assinadas.
- Cinco serviços Supabase: Postgres, Auth, PostgREST, Kong e Storage. Studio, Realtime, SMTP, analytics e edge-runtime ficaram excluídos.
- Inventário prévio de containers, volumes e imagens salvo antes de criar recursos. Nenhum comando de stop/remove/prune foi dirigido a recursos preexistentes.

## Migrations e administrador

Aplicadas uma única vez, por conexão PostgreSQL local explícita:

1. `001_initial.sql`
2. `002_maps.sql`
3. `003_media_import_sources_and_40_seconds.sql` — contém a política atual90s.
4. `004_grenade_origin.sql`
5. `20261030124528_tiktok_import_sessions.sql`

As migrations históricas não foram modificadas. Grants efetivos de `service_role` para mapas, mídia e granadas foram conferidos. Criado um usuário descartável no Auth local, com confirmação local e inclusão em `private.administrators`; o login no frontend funcionou.

O primeiro acesso REST retornou `PGRST205`: o cache ainda não reconhecia as tabelas recém-criadas por SQL direto. `NOTIFY pgrst, 'reload schema'` no banco local resolveu. Não foi necessário alterar o schema nem credenciais para contornar permissões.

A seed002 fornece três mapas. A granada de QA usou o mapa inicialAncient e coordenadas de teste; o ensaio valida mídia/persistência/reprodução, não a correspondência tática do vídeo com esses pontos.

## Prova principal, sem mocks

Vídeo autorizado: `https://vt.tiktok.com/ZSgs9BM9L/`, ID7701782883760983303. Inspeção anunciou33s; fonte validada anteriormente com33,320635s/HEVC/AAC. Não foram usados cookies de contas, login de terceiros ou proxies de evasão.

| Etapa | Resultado real |
| --- | --- |
| Login | Supabase Auth local, administrador reconhecido pela API |
| Consulta | HTTP201, metadados reais do TikTok |
| Seleção | Início00:10, fim00:20, preenchidos na interface |
| Processamento | yt-dlp em sessão única pelo caminho protegido; FFmpeg local; queued → processing → ready |
| Complete | HTTP200 em16.476ms, incluindo resolução/download/recorte/validação/Storage |
| Saída | MP4H264/yuv420p/AAC,10,000s,1080×1920,2.761.164bytes |
| Storage | Bucket privado real `videos-staging`; inicialmente um objeto, somente `import-1.mp4` |
| Publicação | Granada salva pela API real somente depois de ready |
| Reprodução | Chromium reproduziu o arquivo local, avançou o tempo e buscou até5s; player compacto/amplo |
| Independência | Navegador bloqueou todos os hosts externos, inclusiveTikTok; vídeo continuou funcionando |

O arquivo foi baixado novamente do Storage real e passou por probe e decodificação integral. A fonte completa não apareceu no Storage. Não houve embed. Nenhuma resposta de API/Auth/Storage foi substituída no teste principal.

Evidências visuais locais: `selection.png` e `playback-wide.png` na pasta ignorada do ensaio. Traces/HAR com sessões reais não foram gravados. O navegador terminou com zero erros de página observados.

## Falhas e contratos exercitados

| Caso | Como foi testado | Resultado |
| --- | --- | --- |
| Storage indisponível | Parado somente o containerStorage desta stack; processador usou o MP4 autorizado já validado | failed/STORAGE_UNAVAILABLE; temporário removido; granada anterior preservada |
| Substituição por mídiafailed | PATCH autenticado pela API real | Rejeitado; video_id anterior inalterado |
| Cancelamento do processador | AbortController abortado durante a etapa controlada | failed/IMPORT_TIMEOUT; sem ready falso |
| Transferência interrompida | PUT real, em chunks, ao Storage local, abortado durante envio | AbortError; nenhum objeto publicado |
| Cancelamento na interface | Consulta real iniciada e cancelada pelo botão | Campos preservados; nenhuma publicação solicitada |
| Concorrência | Uma execução reteve o claim; outro holder tentou o RPC real, e outra execução tentou processar | Slot recusou segundo holder; PROCESSOR_BUSY; segunda mídia ficouqueued/attempts0 |
| Repetição | Mesmo sourceId/seleção viaAPI e repetição decomplete | Mesmo mediaId; attempts1; sem objeto duplicado |
| Resposta deready perdida | Transporte descartou a resposta somente após o PATCHreal ter sido confirmado pelo servidor | Mídiaready recuperada; objeto preservado |
| Seleção inválida | Trecho91s viaAPI real | HTTP400 |
| Sem administrador | POST sem autenticação e leitura de sessões pelo cliente autenticado sem grant | HTTP401 no POST; sessões protegidas |
| Bucket privado | GET do objeto sem assinatura/autorização | Não acessível, HTTP400 |
| Assinatura expirada | URLreal com validade1s, acesso após3,5s | Recusada, HTTP400 |
| Renovação no player | Relógio do navegador avançado até a renovação; API/Storage reais | Duas consultas reais deplayback, URL diferente, posição4s preservada |
| Retomada do banco | Reiniciado somente o DB desta stack após encerramento | Mídia principal continuouready; três registros de objetos preservados |

**Limite importante dos testes de falha:** para evitar novos downloads de plataforma a cada falha, alguns casos chamaram o processador com uma etapa controlada que copia e valida o MP4TikTok já obtido. Banco, RPCs e Storage permaneceram reais. Isso não foi chamado de uma nova importação TikTok completa. A perda de resposta foi uma injeção controlada no transporte, não uma indisponibilidade aleatória.

Cancelar acompanhamento/consulta no navegador não equivale a matar imediatamente o trabalho do servidor. O backend pode concluir uma inspeção já iniciada; ela não publica granada sozinha. Não foi adicionado um endpoint novo de cancelamento de job.

O PATCH com mídiafailed foi recusado como erro genérico de banco(503), preservando o conteúdo. Refinar esse erro para uma resposta de conflito mais específica permanece uma melhoria de contrato; não foi alterado fora do escopo.

## Linux e recursos

Foi criado um sexto container exclusivo, `pcdnades-e2e-20261031-a7f4-linux`, a partir de `node:24-bookworm-slim`, com cópia dos arquivos versionados do backend, sem `.env` ou chaves locais. Limites:2vCPUs,2GiB RAM,256PIDs. Dependências Linux em volume próprio, sem substituir node_modulesWindows.

Passaram no Linux:

- Instalação fixada pelo lockfile, build/typecheck e **92 testes backend**.
- Bootstrap serverless sem iniciar um serviço remoto.
- FFmpeg/ffprobe/yt-dlp Linux presentes e executáveis; SHA256yt-dlp conferido.
- Fixture real de download HTTP200 semRange, recorte, probe/decode, envio porSDK a HTTPsubstituto e cancelamento.
- Fixture7200s, recorte1800–1810, decode e frame correto; fonte semRange rejeitada.
- NFT: três binários rastreados, nenhum.env,203.951.326bytes,9avisos de análise. Não é um deploy Vercel.

O teste de estresse repetiu o trecho autorizado para gerar90s de saída1080×1920: **57,004s**,25.961.191bytes; picoVmHWM observado do FFmpeg269.356KiB(≈263MiB). Não houveOOM. O teste não incluiu download, Auth, Storage, cold-start ou concorrência produtiva.

**Pendência concreta de tempo:** esse estresse excedeu os40s atualmente reservados ao encoder do modotemporary. Portanto esse perfil90s/1080p não está comprovado dentro do orçamento atual da importação, apesar do caso real10s ter passado. Não foi ampliado o timeout nem alterado o downloader durante a validação. Antes de produção, revisar a distribuição do prazo global110s, medir o fluxo90s completo e decidir se precisa de worker ou limites operacionais diferentes.

Outras medidas observadas:

- Stack Supabase ociosa: aproximadamente400–455MiB somando snapshots dos cinco serviços; não é medição de pico do host.
- Caso principal armazenado:2,76MB. Após os testes de falha/concorrência: três objetos finais,8.283.492bytes no total; dois são artefatos adicionais do ensaio.
- Banco lógico após o primeiro caso:11.127.955bytes. Volume/Postgres/WAL possuem overhead adicional não incluído nessa medida.
- Seis imagens oficiais novas; `docker image ls` informa aproximadamente3,75GB somados, antes de considerar deduplicação. O uso físico incremental doVHD não foi medido.
- A amostragem Windows foi iniciada tarde e não capturou o pico de todo o import; seus valores não foram apresentados como pico de processamento.

## Falhas do ensaio e correções

Não foi encontrada uma regressão que exigisse modificar o downloader ou outro código do produto. As correções foram no ambiente/roteiro:

1. Recarregado o schema do PostgREST após as migrations locais.
2. Um locator genérico encontrava botões do radar e da lista; o teste passou a usar a lista. Outro usava o texto errado de fechar janela. Corrigidos apenas os scripts, sem repetir o download principal.
3. Um `CR` no final do script gerado no Windows virou parte do argumento deNFT no Linux. O script foi normalizado paraLF; a verificação foi retomada e passou. A primeira execução parcial não foi registrada como sucesso completo.
4. Comparação do inventário precisou normalizarCRLF antes de comparar nomes de volumes. IDs/volumes anteriores foram então confirmados presentes.

Frontend nesta etapa: **55 testes e build/typecheck passaram**. Os64 testesPlaywright da etapa anterior continuam documentados separadamente; a prova nova desta etapa foi o navegador conectado aos serviços locais reais, sem mocks.

## Estado final e preservação

Os seis containers deste ensaio estão **parados**, sem remoção. Backend/frontend/supervisor próprios foram encerrados após conferirPID/parentesco; portas55421/55422/55430/55431 ficaram sem listeners. DockerDesktop permaneceu disponível; não foi desligado globalmente.

| Container | Estado final |
| --- | --- |
| `supabase_storage_pcdnades-e2e-20261031-a7f4` | Exited0 |
| `supabase_auth_pcdnades-e2e-20261031-a7f4` | Exited0 |
| `supabase_rest_pcdnades-e2e-20261031-a7f4` | Exited255 durante encerramento |
| `supabase_kong_pcdnades-e2e-20261031-a7f4` | Exited137 durante encerramento, semOOM |
| `supabase_db_pcdnades-e2e-20261031-a7f4` | Exited137 durante encerramento, semOOM |
| `pcdnades-e2e-20261031-a7f4-linux` | Exited0 |

O primeiro encerramento doDB exigiu término peloDocker; foi feita uma retomada e consulta real, comprovando recuperação da mídiaready e metadados. O desligamento posterior via pg_ctl registrou checkpoint e mensagem `database system is shut down`; o wrapper do container terminou137. Não interpretar esse código como prova de corrupção nem omitir que houve término forçado no ensaio.

Volumes preservados: `supabase_db_pcdnades-e2e-20261031-a7f4`, `supabase_storage_pcdnades-e2e-20261031-a7f4` e `pcdnades-e2e-20261031-a7f4-node`.

Estado do banco ao fim dos casos:3ready,2failed,1queued. A filaqueued é uma fixture deliberada da disputa pelo slot, sem worker em execução. A granada principal continuou referenciando sua mídiaready. Todos os objetos do bucket correspondem a recortes finais; nenhum `source.mp4`. Slot global liberado, nenhum jobprocessing.

Containers e volumes preexistentes permaneceram presentes pelos mesmos identificadores; nenhum comando global de limpeza foi executado. Não foram apagados dados, imagens ou volumes anteriores.

## Retomar este ambiente

Todos os arquivos operacionais permanecem na pasta ignorada do ensaio, incluindo `state.private.json` e `status.private.json`. **Não versionar nem imprimir esses arquivos**, pois contêm credenciais descartáveis locais.

Para retomar, primeiro conferir que o projectID e os nomes acima continuam correspondendo ao manifesto e que as portas estão livres. Iniciar somente o DB do ensaio, esperar saudável e iniciar somenteAuth/REST/Storage/Kong desse mesmo sufixo. Em seguida, `serve.mjs` sobe backend/frontend com variáveis exclusivamente locais, sem ler ou sobrescrever.env. `browser-playback.mjs` reproduz a granada existente sem fazer novo downloadTikTok.

Os scripts privados `bootstrap.mjs`, `browser-e2e.mjs`, `verify-storage.mjs`, `faults.mjs`, `contracts-cancel.mjs`, `renewal.mjs` e `final-audit.mjs` documentam a execução. Não reexecutar bootstrap/migrations sem conferir o manifesto; não repetir smokes de plataforma automaticamente. O roteiro não pode ser apontado para remoto: os guardas exigem127.0.0.1 e as portas desta stack.

## Antes de produção

1. Resolver e medir a pendência de timeout para90s em resolução alta, considerando download e validações, não apenas o encoder.
2. Medir a Function real: bundle, cold-start, CPU/RAM/disco, tempos, saída de rede e permissões. LinuxDocker não comprova Vercel.
3. Validar queda abrupta, órfãos e concorrência entre instâncias no host pretendido; preservar a limpeza conservadora de objetos publicados.
4. Revisar o mapeamento de erro de publicação com mídia inválida e definir a política operacional de retomada.
5. Só com autorização específica: migrations/configurações do ambiente remoto, habilitação, integração/push e deploy. Nenhuma dessas autorizações é inferida deste teste local.

**Concluído nesta tarefa:** exemplo autorizado importado, recortado, armazenado e reproduzido como smoke com serviços locais reais. **Não concluído nem autorizado:** liberação em produção ou garantia de suporte universal a links/durações.
