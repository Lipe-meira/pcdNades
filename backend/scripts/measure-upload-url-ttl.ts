// Mede a validade EFETIVA das URLs assinadas de upload do ambiente apontado por SUPABASE_URL.
// Emite um único token para um caminho de sonda (`ttl-probe/<uuid>.mp4`): nenhum objeto é criado e nenhum byte é enviado.
// Não imprime o token, a URL assinada nem a chave. Não altera configuração.
//
// Uso (a trava impede medir o ambiente errado por engano):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... CONFIRM_TARGET_HOST=<host de SUPABASE_URL> \
//     npx tsx scripts/measure-upload-url-ttl.ts
// Saída: JSON com ttlSeconds, a suposição antiga (7200 s / 150 min na migration) e se ela é compatível.
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {measureUploadTtl,drainWaitSeconds,UPLOAD_WINDOW_ASSUMPTION} from '../src/signed-url-ttl.js';

const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');process.exit(2);}
const host=new URL(url).host;
if(process.env.CONFIRM_TARGET_HOST!==host){console.error(`Trava: defina CONFIRM_TARGET_HOST=${host} para confirmar que este é o ambiente a medir.`);process.exit(2);}

const storage=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('videos-staging');
const {ttlSeconds}=await measureUploadTtl(storage,`ttl-probe/${randomUUID()}.mp4`);
const windowSeconds=UPLOAD_WINDOW_ASSUMPTION.sqlWindowMinutes*60;
console.log(JSON.stringify({
 target:host,measuredAt:new Date().toISOString(),ttlSeconds,
 assumption:UPLOAD_WINDOW_ASSUMPTION,
 // O SQL trata como "pendente" um awaiting_upload por 150 min. TTL maior que isso deixa uploads possíveis fora da contagem;
 // TTL menor só deixa a janela mais conservadora que o necessário.
 sqlPendingWindowCoversTtl:ttlSeconds<=windowSeconds,
 sqlPendingWindowIsExact:ttlSeconds+1800===windowSeconds,
 suggestedDrainWaitSeconds:drainWaitSeconds({ttlSeconds}),
 note:'Meça também após qualquer troca de versão/configuração do Storage; tokens já emitidos mantêm a validade com que foram emitidos.'
},null,2));
