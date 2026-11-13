# pcdNades

Biblioteca compartilhada de lineups de **Counter-Strike 2**. Encontre uma granada no radar, assista ao vídeo e consulte as instruções para treinar com o time.

[Abrir aplicação](https://pcdnades.vercel.app) · [API](https://pcdnades-api.vercel.app/health) · [Repositório](https://github.com/Lipe-meira/pcdNades)

## Funcionalidades

- Consulta por mapa, tipo de granada e lado T/CT, com lista e marcadores no radar.
- Smokes, flashbangs, molotovs e HE; **Solo Exec** com origem e múltiplos destinos.
- Seleção dos andares superior e inferior da **Nuke**, inclusive para origem e destino em andares diferentes.
- Vídeos com reprodução sem áudio por padrão, instruções e interface em português para desktop e celular.
- Administração com login, cadastro, edição e exclusão; controle de revisão evita sobrescrever uma edição concorrente.
- Upload de MP4, seleção de trecho e reedição do corte de vídeos importados, conforme as capacidades anunciadas pela API.
- Persistência compartilhada em PostgreSQL e vídeos próprios no Supabase Storage, disponíveis entre dispositivos no modo API.

A disponibilidade de upload, recorte, importadores e prévia depende da configuração do ambiente. A interface consulta `GET /api/v1/media/capabilities`; a presença do código na `main` não habilita automaticamente esses recursos.

## Estado do projeto

O frontend e a API têm projetos separados na Vercel. A `main` reúne a biblioteca, o editor, Solo Exec, HE, os andares da Nuke e a reedição de cortes. O acesso de escrita nessa versão é administrativo.

**Publicação colaborativa por apelido está em desenvolvimento no [PR #19](https://github.com/Lipe-meira/pcdNades/pull/19), ainda fora da `main`.** A validação isolada de 12/11 examinou o SHA `352c0e1`: [relatório e evidências](https://github.com/Lipe-meira/pcdNades/blob/2db411718ecbdd1efdaf282e89c5f59573b97fb4/docs/validation/pr19/REPORT.md). Esse parecer é específico daquela versão e não comprova versões posteriores do PR ou prontidão para ativação pública.

O histórico de operação e as pendências estão nos [checkpoints de continuidade](docs/continuity/README.md). Configuração, migrations aplicadas e estado dos serviços devem ser conferidos antes de qualquer implantação.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React, TypeScript e Vite |
| API | TypeScript, Fastify e validação com Zod |
| Dados e autenticação | Supabase Auth, PostgreSQL e políticas RLS |
| Vídeos | Supabase Storage privado, FFmpeg e ffprobe |
| Verificação | Vitest, Playwright, testes do backend e GitHub Actions |
| Hospedagem | Vercel, com projetos separados para frontend e API |

## Executar localmente

Use **Node.js 24.x** e npm. O backend declara Node 24; o frontend aceita Node 22.12 ou superior. Execute os comandos a partir da raiz do repositório, exceto onde indicado.

### Demonstração sem servidor

```powershell
git clone https://github.com/Lipe-meira/pcdNades.git
cd pcdNades
npm --prefix frontend ci
npm --prefix frontend run dev
```

Abra [http://127.0.0.1:5173](http://127.0.0.1:5173). Sem configuração adicional, o frontend usa `demo`: dados e alterações ficam em memória e desaparecem ao recarregar. Os exemplos da demonstração são fictícios; não representam lineups validadas.

### Frontend conectado à API

Crie `frontend/.env.local` com base em [frontend/.env.example](frontend/.env.example):

```dotenv
VITE_DATA_MODE=api
VITE_API_URL=http://127.0.0.1:3001/api/v1
VITE_SUPABASE_URL=<URL do ambiente de desenvolvimento>
VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública do ambiente>
```

Preencha os valores e reinicie o Vite. O prefixo `/api/v1` faz parte de `VITE_API_URL`. O modo API exige configuração completa; falhas de conexão não são substituídas por dados da demonstração.

Variáveis `VITE_*` são públicas no navegador. Nunca coloque nelas `service_role`, chaves secretas, senha administrativa ou tokens de sessão. A origem do frontend precisa constar no CORS do backend.

### Backend

Prepare um **ambiente de desenvolvimento próprio** com Supabase Auth, banco, bucket privado e usuário administrador. Revise a sequência de migrations e o histórico do ambiente; não reaplique migrations em um banco existente sem conferência.

Crie `backend/.env` a partir de [backend/.env.example](backend/.env.example). Configure as credenciais do servidor, `FRONTEND_URL` e `CORS_ORIGINS`. Para respeitar a regra de produto de 20 s, defina `MEDIA_MAX_DURATION_SECONDS=20` explicitamente.

```powershell
npm --prefix backend ci --ignore-scripts
npm --prefix backend run build
cd backend
node --env-file=.env dist/server.js
```

A API usa [http://127.0.0.1:3001](http://127.0.0.1:3001); saúde em `/health` e contrato em `/api/v1`. O build prepara os binários de mídia necessários à plataforma. Uploads ficam desabilitados por padrão e só devem ser ligados depois de configurar e validar banco, Storage e processamento.

O modo padrão `inline-original` valida o MP4 original e processa o recorte solicitado durante o complete. O modo opcional `worker-transcode` exige worker, FFmpeg/ffprobe, `DATABASE_URL` e execução em host adequado; publicar a API não inicia esse worker.

Veja [frontend/README.md](frontend/README.md) e [backend/README.md](backend/README.md) para contratos e detalhes operacionais. Esses documentos também contêm registros históricos; confira configuração e checkpoints antes de seguir instruções antigas.

## Vídeos e importação

Os vídeos ficam armazenados no projeto. Uma importação suportada baixa e guarda uma cópia; não troca silenciosamente para um embed externo.

| Fluxo | Comportamento |
| --- | --- |
| Upload MP4 | Até 50.000.000 bytes; no modo original, vídeo H.264/yuv420p com áudio AAC ou sem áudio |
| Recorte | Quando habilitado, seleção de trecho em fonte de até 180 s/50 MB; saída validada pelo servidor |
| TikTok | Importador experimental, com habilitação explícita, administrador autorizado e limites próprios |
| Instagram Reels | Implementação com habilitação independente; depende de runtime, migrations e validação operacional |
| YouTube Shorts | Download não habilitado; o fluxo oferece upload de MP4 |
| Prévia de fonte importada | Recurso separado, condicionado à configuração e disponibilidade do coletor |

**Duração final de produto: 20 segundos.** Existe uma divergência conhecida: o código/configuração de exemplo ainda adota 90 s como padrão/teto técnico. Configure o backend com 20 s e confira as capacidades retornadas à interface; a atualização deste README não altera código, constraints do banco nem ambientes publicados. O alinhamento completo desses padrões permanece pendente.

Mídias só podem ser publicadas quando estão `ready`. Assinaturas de upload e de leitura têm validade própria; desligar uma flag não revoga URLs já emitidas. Arquivos físicos e metadados precisam de reconciliação para tratar abandonos e órfãos. Não habilite importadores ou execute limpeza com base apenas em testes simulados.

## Mapas e atribuição

O catálogo da demonstração inclui **Mirage, Inferno, Ancient, Cache, Nuke, Dust II e Anubis**. No modo API, o catálogo vem do banco; a migration inicial de mapas contém somente Mirage, Inferno e Ancient, por isso o catálogo completo depende do provisionamento do ambiente.

- Os PNGs em `frontend/public/maps/valve/` têm origem/licença com lacunas documentadas. Os dois radares atuais da Nuke foram fornecidos pelo usuário e adaptados para preservar a calibração; sua procedência ainda precisa ser confirmada. Consulte a [atribuição dos radares PNG](frontend/public/maps/valve/ATTRIBUTION.md).
- As plantas vetoriais de Mirage, Inferno e Ancient por setpos.gg têm licença **CC BY 4.0**, com snapshot e créditos em [frontend/public/maps/ATTRIBUTION.md](frontend/public/maps/ATTRIBUTION.md). Essa licença não se estende aos PNGs.
- Os ícones têm [créditos próprios](frontend/public/maps/icons/ATTRIBUTION.md).

As coordenadas são normalizadas entre 0 e 1 sobre a imagem de referência. Mudar enquadramento ou orientação exige revisar os pontos existentes. Counter-Strike 2 é marca da Valve; o projeto não declara afiliação ou endosso.

## Verificações

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:browser

npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run build
```

Os testes de navegador exigem o Chromium do Playwright; veja o guia do frontend para instalação. As suítes verificam camadas diferentes: respostas controladas ou CI verde não comprovam Auth, PostgREST, Storage, FFmpeg, provedores externos e persistência entre dispositivos. Consulte os relatórios de cada validação para conhecer o ambiente e a cobertura.

## Organização e documentação

```text
frontend/          Interface React, autenticação, biblioteca, editor e assets
backend/           API, processamento de mídia, migrations e testes
docs/              Contratos, operação, relatórios e continuidade
.github/workflows/ Verificações automatizadas do frontend e backend
```

Para continuar o desenvolvimento, leia [AGENTS.md](AGENTS.md), o [guia de continuidade](docs/continuity/README.md) e o [checkpoint do orquestrador](docs/continuity/orchestrator.md). Cada chat usa branch/worktree próprios, registra o trabalho em disco e entrega commits pequenos com descrição em português. Integração e publicação são coordenadas pelo orquestrador.

Documentos úteis:

- [Operação](docs/operations.md) e [implantação/processamento de mídia](docs/media-inline-mvp.md).
- [Importações e limitações](backend/IMPORTS.md), [validação de importação](backend/IMPORT-VALIDATION.md) e [contrato de prévia](docs/preview-contract.md).
- [HE e reprodução sem áudio](docs/HE-VIDEO-MUTED-20261110.md) e [Nuke com dois andares](docs/NUKE-FLOORS-20261111.md).
- [Checklist de publicação](docs/continuity/PRODUCTION-HANDOFF.md), com registros históricos que exigem conferência do ambiente atual.

Planejamento de táticas, colaboração em tempo real, análise de demos e cópia de bibliotecas de terceiros ficam fora do escopo desta versão.
