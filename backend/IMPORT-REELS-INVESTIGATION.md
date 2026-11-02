# Investigação de importação Instagram Reels — 01/11/2026

Estado: diagnóstico em andamento, funcionalidade NÃO implementada/nem habilitada. Não aplicar migrations/deploy nem afetar TikTok em produção. URL de teste autorizada pelo usuário: `https://www.instagram.com/reel/DeILaFXzNvu/` (parâmetro de rastreamento removido pelo normalizador). Testes feitos na máquina Windows local, não na Vercel.

## Evidência real

- yt-dlp 2026.08.19, sem configuração local, plugins, runtime JS remoto ou login/cookies de conta, inspecionou o Reel e reconheceu o ID. JSON não informou duração (`null`), com 13 formatos.
- Download direto do MP4 terminou sem erro HTTP, 8.472.243 bytes. ffprobe confirmou duração 64,664717 segundos, vídeo H.264 e áudio AAC.
- Mesmo arquivo passou pelo FFmpeg do projeto com seleção 30–35s: MP4 final 5 segundos/1.022.944 bytes; ffprobe e decodificação completa passaram.
- Experimento temporário com cópia isolada do proxy existente e allowlist experimental para instagram.com, cdninstagram.com e fbcdn.net: inspeção passou (3 conexões; 215.099 bytes) e download integral passou (4 conexões; 8.741.857 bytes transferidos, arquivo 8.472.243 bytes). Subdomínio observado foi `instagram.fnvt11-1.fna.fbcdn.net`. Esse teste não altera a allowlist versionada nem valida segurança da ampliação para domínios compartilhados, nem demonstra Vercel.
- Arquivos e scripts em `backend/vendor/reels-probe-20261101/`, ignorados e fora do Git; preservados. Não registrar URLs CDN assinadas, cabeçalhos sensíveis, credenciais ou vídeo no repositório. Descartar somente com autorização apropriada.

## Bloqueios técnicos que precisam de implementação

1. O frontend reconhece URL Reels mas mantém plataforma desabilitada; inspeção, contratos, processamento, estado e autorização no backend são específicos para TikTok.
2. Uma inspeção sem duração não pode usar `sourceMetadata` atual. Para esse Reel é necessário inspecionar o arquivo (ffprobe) após download temporário limitado e seguro, antes de oferecer seleção; a função na Vercel é efêmera, portanto é necessário definir como conservar/repetir download, prazo e concorrência sem deixar fonte original no Storage permanente. Não fingir duração nem sucesso.
3. O banco de produção usa `create_tiktok_import`, constraint de snapshot exclusiva `tiktok` e teto de origem de 2h apenas para TikTok. Criar migration NOVA aditiva com permissões, RLS e compatibilidade; não alterar migrations históricas nem aplicar no remoto sem autorização específica. Avaliar exclusão, idempotência e preservação dos registros e objetos existentes.
4. Criar transporte por provedor com proteção SSRF (DNS, IPs, porta, TLS, redirecionamentos e limites), testando se domínios compartilhados como fbcdn.net podem ser limitados com segurança sem permitir acesso a objetos não relacionados. Reavaliar validade dos cookies efêmeros do extrator e não usar contas privadas, autenticação de terceiros, proxies de evasão nem contornar bloqueios.
5. Reutilizar autenticação administrativa, seleção, limites de 30s/50MB, deadline, transcodificação e Storage privado. A flag de Instagram deve ser independente e desligada por padrão; TikTok e upload não podem regredir. A fonte pode ser maior que 30s mas respeita limite de arquivo e tempo do piloto.
6. Testar contra Supabase local real e armazenamento/reprodução com fonte autorizada, preservar teste privado e registros antigos; depois testar execução na infraestrutura real somente dentro das autorizações específicas necessárias. Não marcar integração pronta somente por testes simulados.

## Próximo passo

Implementar e testar primeiro o contrato de duração desconhecida e a inspeção segura em branch dev, com testes RED/GREEN para limites, CDN, falhas e autenticação. Avaliar se a extração em inspeção deve manter um arquivo efêmero ou ser repetida ao importar; na Vercel não presumir que requisições compartilham /tmp. Reconfirmar estado Git e não tocar nos projetos de produção. A importação do Reel ainda NÃO funciona no site.
