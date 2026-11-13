// Inventário/dry-run dos objetos do bucket videos-staging contra media_assets. SOMENTE LEITURA: não existe opção de exclusão.
// Lê o banco em transação READ ONLY duas vezes (com intervalo) e só considera confirmado o que ficou idêntico nas duas leituras.
//
//   DATABASE_URL=postgres://... CONFIRM_TARGET_HOST=<host do DATABASE_URL> \
//     npx tsx scripts/storage-inventory.ts --signed-url-ttl-seconds <TTL medido> [--stability-seconds 30] [--out relatorio.json]
//
// --signed-url-ttl-seconds é OBRIGATÓRIO e deve vir de scripts/measure-upload-url-ttl.ts (não há valor padrão de propósito).
// O relatório lista caminhos EXATOS, tamanhos e motivos; guarde-o como manifesto antes de qualquer decisão humana posterior.
import pg from 'pg';
import {writeFile} from 'node:fs/promises';
import {buildInventory,loadSnapshot} from '../src/storage-inventory.js';

const args=process.argv.slice(2);
const flag=(name:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const ttl=Number(flag('--signed-url-ttl-seconds')),stability=Number(flag('--stability-seconds')??'30'),out=flag('--out');
if(!Number.isFinite(ttl)||ttl<=0){console.error('Informe --signed-url-ttl-seconds com o TTL efetivo medido (scripts/measure-upload-url-ttl.ts).');process.exit(2);}
if(!Number.isFinite(stability)||stability<1){console.error('--stability-seconds deve ser >= 1: candidato só é confirmado com duas leituras separadas.');process.exit(2);}
const url=process.env.DATABASE_URL;if(!url){console.error('Defina DATABASE_URL.');process.exit(2);}
const host=new URL(url).host;
if(process.env.CONFIRM_TARGET_HOST!==host){console.error(`Trava: defina CONFIRM_TARGET_HOST=${host} para confirmar o banco a inventariar.`);process.exit(2);}

const client=new pg.Client({connectionString:url,application_name:'pcdnades-storage-inventory-readonly'});
await client.connect();
try{
 const first=await loadSnapshot(client);
 await new Promise(r=>setTimeout(r,stability*1000));
 const second=await loadSnapshot(client);
 const report=buildInventory(second,{now:new Date(),signedUploadTtlSeconds:ttl,previous:first});
 const text=JSON.stringify({target:host,stabilitySeconds:stability,...report},null,2);
 if(out)await writeFile(out,text,{flag:'wx'});else console.log(text);
 const c=report.accounting.contributor;
 console.error(`dry-run: ${report.totals.objects} objetos, ${report.totals.bytes} B; colaborativo físico ${c.physicalBytes} B x cobrado ${c.chargedBytes} B (fora da cobrança: ${c.unaccountedBytes} B); candidatos confirmados: ${report.totals.candidateBytes} B. Nada foi alterado.`);
}finally{await client.end();}
