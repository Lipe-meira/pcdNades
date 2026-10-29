// CI only: inspect traced files without importing the server or using credentials.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { access } = require('node:fs/promises');
const { constants } = require('node:fs');

async function main() {
  assert(process.argv[2], 'Informe o diretório do verificador NFT isolado.');
  const externalRequire = createRequire(resolve(process.argv[2], 'package.json'));
  const { nodeFileTrace } = externalRequire('@vercel/nft');
  const expected = process.platform === 'linux'
    ? 'node_modules/@ffprobe-installer/linux-x64/ffprobe'
    : 'node_modules/@ffprobe-installer/win32-x64/ffprobe.exe';
  const { fileList, warnings } = await nodeFileTrace(['dist/server.js'], {
    base: process.cwd(),
    // Same mode as the official NFT CLI: the ESM module uses createRequire.
    mixedModules: true,
  });
  const normalizedFiles = new Set([...fileList].map((file) => file.replaceAll('\\', '/')));
  assert(normalizedFiles.has(expected), `Executável ausente do trace: ${expected}`);
  await access(resolve(expected), process.platform === 'linux' ? constants.X_OK : constants.F_OK);
  console.log(`PASS: executável presente e acessível no trace: ${expected}`);
  console.log(`Avisos de análise do NFT: ${warnings.size}; não substituem a checagem do arquivo.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
