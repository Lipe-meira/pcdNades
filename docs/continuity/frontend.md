# Checkpoint — frontend

Atualizado em: 28/10/2026 22:48, America/Sao_Paulo
Estado: em andamento — fechamento da primeira prévia demonstrativa

## Objetivo e pedido atual

Construir frontend React/TypeScript do pcdNades, coordenado pelo chat “Criar site de lineups para CS2”. Etapa autorizada: prévia navegável com mapas reais licenciados, radar, filtros, detalhes, administração e MP4 local explicitamente demonstrativos. Registrar continuidade em disco imediatamente, conforme nova instrução do usuário, sem esperar a tarefa terminar. Orquestrador já publicou snapshot anterior; aguarda última revisão/testes/push para integrar melhorias.

## Localização do trabalho

- Branch: feat/frontend. Worktree gerenciado: C:/Users/felip/.codex/worktrees/pcdnades-frontend/nadesCs2.
- Base: e889e3b (docs/visao-projeto). Último commit implementado: 953a2ad.
- Commits anteriores: 056eea8 biblioteca/radar; e3b66c0 plantas licenciadas reais; 953a2ad CRUD e MP4 local.
- Push desta branch: ainda pendente. O orquestrador integrou 953a2ad a origin/main e publicou a demo, conforme mensagem; não alterei main nem publiquei.
- Nova regra AGENTS.md e template lidos de origin/main, commit d8c643b, via git show. Ainda não incorporados à branch local (não fazer merge sem coordenação).
- Sem commit neste momento: frontend/docs/implementation.md, frontend/package.json, frontend/vite.config.ts, frontend/src/app/App.tsx, frontend/src/components/{Dialog,Icon,Radar}.tsx, frontend/src/domain/{lineups,types,validation}.ts, frontend/src/features/admin/{Admin,LineupForm,MediaInput}.tsx, frontend/src/features/library/{Library,VideoPlayer}.tsx, frontend/src/main.tsx, frontend/src/services/{demoData,lineupService}.ts, frontend/src/styles.css, frontend/tests/{admin,domain}.test.ts.
- Arquivos novos: frontend/README.md, frontend/docs/verification.md, frontend/playwright.config.ts, frontend/tests/browser/flows.spec.ts, frontend/tests/fixtures/test-pattern.mp4, frontend/vercel.json e este checkpoint. A maioria dos arquivos alterados acima tem apenas formatação Prettier; mudanças funcionais recentes estão em validação 20s, labels acessíveis e CSS contra overflow.

## Feito

- React 19 + TypeScript + Vite em frontend/, interface PT-BR responsiva, serviço assíncrono em memória substituível. Nunca usa localStorage como fonte de dados.
- Mirage/Inferno/Ancient com plantas vetoriais reais do setpos.gg (CC BY 4.0, snapshot ba5f793883e1ce13076dd6919aa1601099c247cf); créditos/licença/versão em public/maps. Não são texturas oficiais extraídas; limitações do autor documentadas. Desenho fictício inicial removido e pontos demo reposicionados.
- Radar proporcional, filtros tipo/lado, agrupamento de destinos sobrepostos, lista acessível e detalhes.
- CRUD demonstrativo, foco e confirmação de exclusão. MP4 local com player nativo, validação contêiner/MIME/tamanho/duração. Importação de links explicitamente não operacional; tentativa não publica dados nem substitui mídia.
- 12 testes Playwright passaram (6 cenários em desktop/mobile). Incluem filtros/vazio, pontos sobrepostos, formulário/radar/foco, link não suportado e MP4 com play/pause/seek/edição/exclusão/reload.
- Corrigidos overflow em 320px e nome acessível do seletor. Duração máxima ajustada para 20s por instrução confirmada do usuário.
- Dependência Supabase investigada e removida: nenhum adaptador real ou env criado neste incremento. Foco alinhado com orquestrador é primeira entrega demo, integração real em incremento posterior.

## Em andamento

- Documentação, formatação e fechamento de verificações após ajustes finais de 20s.
- Capturar/revisar screenshots desktop/celular/formulário, executar testes/build/typecheck/audit/diff, commit e push. Testes e docs/vercel.json ainda não commitados.

## Retomar daqui

1. Ler AGENTS/guia/checkpoints atualizados na main remota, conferir git status/branch/log e este arquivo. Não trocar branch nem editar checkout alheio.
2. No diretório frontend/, executar npm test e npm run build; depois npm run test:browser e npm audit. Os 12 testes browser passaram antes da formatação; repetir só porque houve ajustes recentes de tipos/20s/format.
3. Revisar screenshot desktop 1440×1000, mobile 390×844 e formulário. Browser IAB da sessão pode não existir; confira antes de reutilizar. Servidor dev foi iniciado em 127.0.0.1:5174 (sessão exec 92059), mas não presumir que continua ativo.
4. Atualizar docs de verificação e este checkpoint, commitar somente frontend/ e docs/continuity/frontend.md com descrição PT-BR; git push -u origin feat/frontend. Informar SHAs e resultado ao orquestrador.
5. Aguardar coordenação para integração real; não provisionar serviços nem alegar persistência compartilhada funcionando.

## Decisões e contrato

- Confirmado: limite 20s por vídeo; React+TS; mapas reais com atribuição; dados compartilhados via backend; sem embed como substituto de download.
- Demonstração abre MP4 local e perde alterações ao reload. Login é uma porta de demonstração claramente identificada, sem senha ou segurança fingida.
- Proposto/pendente: cliente HTTP e Supabase auth/storage ligados às telas. README backend 8904118 lido, sem editar worktree backend.
- Contrato: /api/v1 maps/grenades, envelopes data/pagination, Bearer Supabase, videoId ready para publicar; uploads assinados, complete, polling 3s; playback somente após publicação e URL expira; capabilities é autoridade para limites; PLATFORM_UNSUPPORTED para importadores desabilitados.
- IDs de demo: mirage/inferno/ancient; enviar ao backend para seed com URLs /maps/{id}.svg, 1024×1024 e coordinateVersion setpos-{id}-ba5f793. Não preservar coordenadas se trocar imagem/enquadramento.
- Referências: frontend/README.md, frontend/docs/{implementation,verification}.md, frontend/public/maps/ATTRIBUTION.md e C:/Users/felip/.codex/worktrees/pcdnades-backend/nadesCs2/backend/README.md (somente leitura).

## Validação

- Executado: 9 testes unitários/serviço, typecheck e build verdes até 953a2ad; build verde após fallback SPA/testes adicionados; 12 testes navegador verdes após correção de overflow/labels.
- Executado: npm audit encontrou 2 moderadas no Vitest inicial; npm audit fix atualizou a 4.1.12 e retornou zero vulnerabilidades.
- Ainda executar novamente: suite unitária com novo teste de duração (esperado 10 testes), build/typecheck e audit após fechamento; inspeção final de screenshots.
- Não validado: API/Supabase real, storage/worker, permissões, upload remoto, playback assinado, persistência em dois dispositivos e Safari/iOS. Nenhum segredo existe na entrega.

## Bloqueios e dependências

- Sem bloqueio para concluir demo e push.
- API real depende de ambiente Supabase/API/worker e seed; coordenar com orquestrador. Publicação é responsabilidade dele.

## Entrega e histórico curto

- 28/10/2026: commits 056eea8, e3b66c0, 953a2ad locais; orquestrador informou integração de 953a2ad e deploy inicial READY em https://pcdnades.vercel.app (estado reportado por ele, ainda não verificado neste chat).
- 28/10/2026: 12 fluxos de navegador passaram; preparo documentação, limite 20s, SPA e este checkpoint para próxima integração.
