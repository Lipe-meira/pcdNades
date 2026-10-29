# Frontend pcdNades

Prévia navegável em React + TypeScript + Vite. **Este incremento é uma demonstração**, não uma biblioteca compartilhada pronta: o serviço padrão é em memória, não usa localStorage e perde alterações ao recarregar. Nenhum vídeo é enviado ou baixado. Não há credenciais nem variáveis de ambiente de produção nesta entrega.

## Rodar e verificar

Requer Node 22.12+ (validado com Node 24). Execute nesta pasta:

```powershell
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run test:browser
```

O servidor de desenvolvimento usa http://127.0.0.1:5173. Os testes de navegador iniciam ou reutilizam http://127.0.0.1:5174. Se o Chromium do Playwright ainda não estiver instalado: `npx playwright install chromium`. O arquivo tests/fixtures/test-pattern.mp4 já está incluído: é um padrão audiovisual sintético de dois segundos, sem gameplay, usado apenas para testar o player. Não é um vídeo de execução de granada.

Vercel: diretório raiz `frontend`, instalação `npm ci`, build `npm run build`, saída `dist`. O arquivo vercel.json contém fallback de SPA preservando os caminhos de assets e mapas. Publicação e integração na main são responsabilidade do orquestrador.

## Fluxos disponíveis

- Seleção de Mirage, Inferno e Ancient, filtros combinados por smoke/flashbang/molotov e lado T/CT.
- Destinos clicáveis e lista acessível. Dois exemplos sobrepostos abrem uma lista de escolha.
- Detalhes com instruções fictícias e player HTML de arquivo, sem iframe/embed.
- Administração explicitamente demonstrativa, sem solicitar senha nem simular segurança real.
- Cadastro/edição/exclusão temporários, validação, confirmação antes de excluir, foco restaurado ao fechar diálogos, alternativa de coordenadas pelo teclado.
- MP4 local: limite de 50.000.000 bytes e 20 segundos, extensão/MIME/assinatura verificados e prévia reproduzível exigida. O browser usa URLs de objeto, liberadas ao substituir/excluir/encerrar a página.
- Formulário de link Shorts/TikTok com aviso de indisponibilidade. Tentar importar gera PLATFORM_UNSUPPORTED; nenhum download, cadastro publicável ou substituição de vídeo anterior ocorre.
- Estados provisórios de mídia definidos em src/domain/types.ts; o fluxo integrado previsto aparece na administração. Progresso de upload e processamento não é simulado.

## Mapas

As plantas de Mirage/Inferno/Ancient são desenhos vetoriais dos mapas CS2 feitos por setpos.gg, licenciados explicitamente sob CC BY 4.0. Não são o esquema fictício inicial nem texturas oficiais extraídas. Crédito visível junto ao radar e documentação completa em public/maps/ATTRIBUTION.md. Snapshot ba5f793883e1ce13076dd6919aa1601099c247cf, publicado em 23/10/2026. Podem não refletir alterações recentes do jogo.

As imagens são preservadas integralmente em 1024×1024. Cada mapa possui radarVersion para evitar trocar enquadramento sem rever pontos. Coordenadas x/y de 0 a 1, origem superior esquerda. O clique mede o próprio elemento img sem padding ou letterbox. Os destinos demonstrativos foram reposicionados para as novas artes e continuam fictícios, não validados para treinar.

## Estrutura e próxima integração

- `src/domain`: modelo provisório e funções de filtros/coordenadas/validação.
- `src/services/lineupService.ts`: interface assíncrona e implementação temporária. Trocar por adaptador de API, sem mover persistência para o navegador.
- `src/features/library`: consulta, seleção e detalhes de vídeo.
- `src/features/admin`: CRUD e formulário de mídia.
- `src/components`: radar, diálogo nativo e ícones.
- `tests`: domínio/serviço e fluxos de navegador desktop/mobile.

O contrato v1 foi fornecido pelo orquestrador e lido no README do backend. **O cliente HTTP e a autenticação ainda não estão ligados à interface.** Esta entrega prioriza a primeira prévia publicada. Não existe configuração por env que transforme a demo em API automaticamente; um próximo incremento deve implementar e testar esse adaptador explicitamente.

Pontos de integração confirmados:

- Base `/api/v1`; mapas em `{data:[{id,name,radar:{imageUrl,width,height,coordinateVersion}}]}`.
- Granadas paginadas em GET `/grenades`; escrita autenticada via Supabase Bearer e `videoId` somente quando ready.
- GET `/media/capabilities` é a autoridade para limites e disponibilidade. O teto confirmado pelo usuário é 20 segundos; não assumir os defaults antigos de 180 segundos.
- POST `/media/uploads` cria sessão assinada Supabase; upload do arquivo, POST `/media/:id/complete`, acompanhamento a cada 3s até ready/failed. Não inventar porcentagem.
- Playback é obtido em GET `/media/:id/playback` apenas depois de vincular mídia pronta à granada publicada; renovar URLs quando expirarem.
- Importadores continuam desabilitados. Manter vídeo anterior até substituição bem-sucedida. Enviar MP4 é alternativa explícita.
- Alinhar IDs/caminhos/coordinateVersion dos mapas com o seed do backend antes de usar cadastros reais. As fontes/versões estão em public/maps.

## Limites da verificação

Build/typecheck, testes unitários e testes Chromium em desktop/mobile validam esta demo. A integração real ainda depende de projeto Supabase, migrations, administrador, API, storage e worker configurados pelo backend; persistência entre dispositivos, permissões do servidor, upload real e reprodução Safari/iOS não foram validados. Erros/carregamento da consulta estão implementados, mas a demo não depende de rede para os cadastros.
