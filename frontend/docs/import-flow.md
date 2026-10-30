# Importação de trechos do TikTok

O cadastro tem duas etapas: consultar o link e selecionar o intervalo antes de importar. A consulta autenticada retorna metadados reais da fonte. O frontend aceita fonte finita de até duas horas e trecho final de0,1a90segundos/50MB,com precisão de0,001s. O uploadMP4 mantém seus limites separados: origem com recorte até180s e saída até90s. YouTube e Instagram permanecem indisponíveis.

## Contrato implementado

- CapabilitiesTikTok: enabled,inspection e campos de limites DIRETOS no objeto importers.tiktok. Inspection habilitada sem limites válidos é erro de contrato; não há fallback para os180s do upload.
- POST/media/imports/inspectadmin com sourceUrl retorna201data:sourceIdUUID,providerTikTok,sourceUrlcanonical,videoId,title,author,durationSeconds,expiresAt,preview:null,previewReasonCode:PREVIEW_UNAVAILABLE e limites ANINHADOS emdata.limits.
- POST/media/importsadmin envia SOMENTE sourceId eclip{startSeconds,endSeconds}. Retorna201dataMediaRecord comid e mediaId iguais,sourceId/sourceUrl/clip vinculados. O frontend chama POSTcomplete{} depois de criar a mídia; GET apenas observa o estado.
- A consulta vale15min para criar importação. A mídia já criada pode ser retomada após a consulta expirar. Retomada verifica sourceId,URLcanonical eclip; novo link ou intervalo limpa o identificador de retomada. Repetição do mesmo sourceId/clip é idempotente no servidor; outro trecho requer nova consulta.
- Cliente mantém30s para consulta e150s para complete. Enquanto complete aguarda,o observador GET a cada3,5s apresenta apenas estágios reais:resolving,downloading,transcoding,validating,storing. Monitoramento é cancelado no fim/abort e não substitui o resultado do complete.

## Interface e estados

Consultar vídeo/Consultar novamente/Cancelar consulta mantêm os demais campos do formulário. Respostas antigas são ignoradas após trocar link ou sair do modo. Título,autor,duração da fonte e limites aparecem depois de consulta válida; fonte desconhecida/live/inválida não libera o trecho.

O editor aceita mm:ss ouhh:mm:ss,com até três casas decimais; os sliders ajustam o mesmo intervalo. O resumo mostra a duração final. Intervalos invertidos,fora da fonte,maiores que90s ou com precisão inválida não criam mídia. Salvar inicia a importação e só publica o cadastro depois de ready.

Prévia visual NÃO está disponível neste contrato. Não há player,thumbnailCDN ou embed do TikTok. A interface informa essa limitação e permite escolher pelos metadados e horários. Prévia real permanece dependente de um contrato futuro que a autorize; não é simulada.

PROCESSOR_BUSY no complete mantém a mídia para Retomar importação; na consulta pede aguardar e consultar novamente. Erros de rede/timeout no complete preservam a sessão quando já recebida. Estado terminal failed exige nova seleção e preserva o cadastro e vídeo anteriores. Mensagens de limites/range/rate/obtenção são sanitizadas; detalhes de infraestrutura não entram na interface.

## Validação e limites da evidência

Testes de adaptador e navegador usam API/Auth/Storage controlados e vídeo sintético. Cobrem fonte2h/trecho90,horários,invalidcaps,previewnull,expiração,sourcebind,abort/troca de link,respostas antigas,timeout,complete perdido/ocupado,estágiosreais,failed/tamanho,preservação de cadastro e regressõesMP4/origem/player/CRUD/mobile320.

Esses testes NÃO provam obtenção externa do TikTok ou execução no Vercel. Não foi alterada configuração de produção,nem houve deploy ou habilitação de importador pelo frontend. Integração,serviços remotos e publicação pertencem ao orquestrador após entrega completa e testada.
