# Origem e destino de uma execução

Contrato alinhado com o orquestrador30/10: cada cadastro tem um destino e uma origem nullable; vários cadastros com o mesmo destino podem ter origens e vídeos distintos. Não há array de origens nem origem inventada para dados antigos.

API: origin omitido/null noPOST resulta null;PATCH omitido preserva inclusive ao mudar mapa,origin:null limpa,objeto substitui par. GETnovo retorna objeto/null;adaptador aceita campo ausente deAPIantiga como null. Coordenadas finitas normalizadas0..1 inclusive,mesmaimagem/mapId/versão do destino,sem conversão de pontos.

UI novo cadastro exige origem e destino; editar legado pode manter origem nula. Apenas originTouched envia o campo emPATCH,para não mudar origens silenciosamente. Trocar mapa limpa ambos e não recupera pontos ao retornar;cadastro que já tinha origem exige remarcá-la. Legado originalmente sem origem pode salvar novo mapa com origemnull explícita e destino remarcado. Remover origem é ação explícita em edição.

Modos de marcação têm botões pressionados,coordenadas manuais rotuladas,legenda e feedback. Quadrado azul/plus representa jogador;círculos existentes representam destinos. Linhas tracejadas no mesmo wrapper da imagem,sem captarcliques. Grupo de destino revela origens cadastradas;clicar origem abre apenas a execução correspondente. Legado mostra Origem não cadastrada. Playeramplo/compacto usa mesmaexecução semnovo player desnecessário.

Validações locais/controladas não provam persistência de produção. Migration004 e publicação pertencem ao orquestrador e requerem coordenação explícita. Nenhum radar,ID,asset,versão ou catálogo é alterado por este recurso.
