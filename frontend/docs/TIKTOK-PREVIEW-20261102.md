# Prévia TikTok — diagnóstico e validação frontend (02/11/2026)

## Diagnóstico e alteração

A base 7443dc8 já oferecia player privado, play/pause e navegação nativos, marcação de início/fim, inputs e controles de intervalo, validação do limite da capacidade (até 30s), renovação de URL e fallback manual. A disponibilidade depende de `importers.tiktok.sourcePreview` e o modo API não usa dados de demonstração.

Três lacunas foram corrigidas sem alterar o contrato: exibir o tempo atual fora dos controles nativos (output rotulado), informar que a prévia não foi importada/publicada e tratar `SOURCE_EXPIRED` do servidor como expiração imediata da consulta. O formulário solicita nova consulta, desabilita a seleção expirada e preserva campos/cadastro/vídeo anterior; não repete POST/GET automaticamente. A expiração recebida na preparação ou na renovação segue a mesma regra.

O player segue consumindo POST autenticado de preparação aguardada e GET autenticado para renovar a URL privada; nenhuma URL de plataforma é exibida ou incorporada. A importação existente envia somente sourceId e trecho selecionado; não houve mudança no pipeline, MP4, Solo Exec, autenticação ou no contrato compartilhado.

## Verificações locais

- `npm ci` na pasta frontend: PASS, Node 24.21.0, npm 11.19.0, zero vulnerabilidades reportadas pelo instalador.
- `npm run build`: PASS, inclui TypeScript.
- `npm test`: 58/58 unitários PASS.
- `npm run test:browser -- --grep 'Prévia privada|TikTok: metadados|Solo Exec cadastra|upload falho' --project=api-desktop --project=api-mobile --workers=1`: 16/16 PASS com API/Auth/Storage controlados, cobrindo limite 30s, fallback, renovação, falha, troca de link, Reels, MP4 e Solo.
- `npm run test:browser -- --grep 'player marca início e fim sem publicar|fonte expirada pelo servidor' --project=api-desktop --project=api-mobile --workers=1`: 4/4 PASS com fixture local; inclui play/pause, seek, tempo atual, marcação e sliders sincronizados, aviso, 410 e preservação.
- `npm run test:browser -- --grep 'expiração na renovação' --project=api-desktop --project=api-mobile --workers=1`: 2/2 PASS; POST/GET, 410 no GET, player removido e seleção mantida.
- `git diff --check`: PASS; projeto não declara comando de lint.

As respostas de API/Auth/Storage e o vídeo são fixtures controladas, não evidência de integração real ou produção. Capturas não sensíveis do player fixture: `frontend/node_modules/.cache/tiktok-preview-evidence/desktop.png` e `mobile.png`; ignoradas pelo Git e sujeitas à limpeza de node_modules.

## Dependências e pendências

Produção permanece com prévia desabilitada; esta alteração não a ativa e mocks não provam disponibilidade externa. E2E real depende do backend e do orquestrador organizarem nova stack local isolada e coordenarem fonte e lease. O coletor monitorado e heartbeat válido continuam pré-requisitos de ativação. Não foram executados downloads externos, scripts de manutenção, migrations, mudanças remotas, deploy ou publicação.
