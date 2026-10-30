# yt-dlp opcional

Versão fixada **2026.08.19**, artefatos oficiais, sem auto-update, sem alteração do binário e sem instalação global. `scripts/prepare-ytdlp.mjs` só inclui o artefato se `MEDIA_TIKTOK_IMPORT_ENABLED=true` no build; sempre verifica SHA256 e permissões. A API também verifica o hash antes da execução e da capability habilitada. O binário fica em `vendor/`, ignorado pelo Git.

| Plataforma | Artefato | Bytes | SHA256 |
| --- | --- | ---: | --- |
| Windows x64 | yt-dlp.exe | 17840399 | 66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a |
| Linux x64 glibc2.17+ | yt-dlp_linux | 40446224 | 58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a |

Hashes e tamanhos conferidos na [release oficial](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19). O fonte do projeto é Unlicense, mas os executáveis PyInstaller usados aqui combinam código **GPLv3+**, conforme a [seção de licenciamento da versão](https://github.com/yt-dlp/yt-dlp/blob/2026.08.19/README.md#licensing). Preserve as referências ao [código-fonte da versão](https://github.com/yt-dlp/yt-dlp/tree/2026.08.19), à [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html) e às [licenças de terceiros](https://github.com/yt-dlp/yt-dlp/blob/2026.08.19/THIRD_PARTY_LICENSES.txt) ao distribuir os artefatos. O uso dos binários FFmpeg/ffprobe continua documentado em FFPROBE-NOTICE.md.

O smoke Windows validou hash, versão e caminho protegido de metadados. Download do exemplo foi recusado pelo CDN com403; não há aprovação para ativar produção. Não foi executado binário Linux/Vercel nesta entrega. Bundle NFT Windows medido em187.601.154 bytes com o executável opcional; essa medida não comprova compatibilidade Linux, limites de memória ou tempo da Function.
