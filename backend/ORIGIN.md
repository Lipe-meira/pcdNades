# Origem de lançamento — contrato do backend

Uma granada cadastrada representa uma execução, com um vídeo, um destino e uma origem opcional. Duas execuções podem ter origens diferentes e compartilhar o mesmo destino; continuam sendo cadastros separados. Não há array de origens nem nova entidade de tática.

## API

`POST /api/v1/grenades` aceita `origin?: { x: number; y: number } | null`. Campos `target` e `videoId` mantêm o contrato anterior. `origin` omitido ou `null` cria um cadastro sem origem. O cadastro continua exigindo mídia pronta e administrador autenticado.

`PATCH /api/v1/grenades/:id`:

- Sem o campo `origin`: preserva a origem existente.
- `origin: { x, y }`: substitui o par inteiro.
- `origin: null`: limpa as duas coordenadas.
- Um par incompleto, valor não finito, string numérica, campo extra ou coordenada fora de `[0,1]` é rejeitado com `400 VALIDATION_ERROR`.

Listagem, detalhe, criação e edição retornam `origin: { x, y } | null`. Valores `0` e `1` são válidos; zero nunca é tratado como ausência. Registros legados sem as colunas também são apresentados como `origin: null` pela camada de visão. Não retornar `origin_x`/`origin_y` no contrato público.

Exemplo de cadastro (demais campos obrigatórios omitidos apenas para ilustrar):

```json
{"target":{"x":0.7,"y":0.4},"origin":{"x":0,"y":1}}
```

A origem usa exatamente o sistema do destino: imagem efetiva do radar do `mapId`, origem no canto superior esquerdo, `x` para a direita e `y` para baixo, sem padding/letterbox. A versão da imagem continua sendo a referência `radar.coordinateVersion` do mapa; este incremento não cria uma versão por coordenada nem transforma pontos ao trocar o radar.

## Troca de mapa

Para preservar o contrato anterior, `PATCH` não infere nem apaga coordenadas ao receber outro `mapId`. `origin` omitido continua preservando o valor. O frontend deve exigir/remarcar o destino no novo radar e remarcar a origem, ou enviar `origin: null` explicitamente. Não reutilizar silenciosamente uma origem desenhada no mapa anterior. É a mesma limitação de referência já existente para `target`.

## Persistência e aplicação coordenada

Nova migration `migrations/004_grenade_origin.sql` adiciona `origin_x`/`origin_y` como `double precision` nullable com uma única restrição: ambos nulos ou ambos preenchidos, finitos e dentro de `[0,1]`. A ordenação de floats do PostgreSQL faz `BETWEEN 0 AND 1` rejeitar `NaN` e infinitos. Nenhum dado, mídia, destino, grant, política RLS ou trigger é reescrito. Registros existentes começam com origem nula. Migrations `001`, `002` e `003` permanecem intactas.

O backend continua usando o mesmo cliente autenticado para criar/editar granadas; administrador mantém a permissão existente, visitante/viewer não recebe nova permissão de escrita. `origin` é convertido para as duas colunas no mesmo `INSERT`/`UPDATE`, sem janela de par parcial.

004 deve ser revisada/aplicada pelo orquestrador antes de habilitar gravação de origens no frontend. Antes dela, consultas/cadastros sem origem ainda podem funcionar, mas enviar `origin` ou limpá-la menciona colunas inexistentes e falha no banco. Frontend deve tolerar respostas antigas sem `origin`, normalizando para `null` durante a integração. Não usar isso para esconder erro de gravação.

## Verificações e limites

`npm run typecheck`, `npm test` e `npm run build` dentro de `backend/` verificam o código. `tests/origin.test.ts` cobre schema, transformação e HTTP com banco substituído, incluindo pares diferentes para o mesmo destino, zero/um, legado/null, patch preservado/limpo e negação de escrita anônima/viewer. Isso não é teste real de Supabase/RLS.

`tests/sql/origin-smoke.sql` é um teste manual com rollback para revisão do orquestrador depois de 004 e de autorização para executar SQL. Exige um cadastro de teste com mídia pronta; verifica limites, par nulo, NaN/Infinity e preservação dos demais campos. Nenhum SQL remoto foi executado neste incremento. Revisar/aplicar 004 e executar os testes reais de papéis e persistência ainda são pendências de integração.

Não há alteração no frontend, recorte, upload, reprodução, tipos de granada ou agrupamento por destino. Publicar somente depois de finalizar e testar a pendência completa; sem preview manual ou push na main por este chat.

Referência para a semântica de `NaN` em floats usada na restrição: [PostgreSQL — Floating-Point Types](https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-FLOAT).
