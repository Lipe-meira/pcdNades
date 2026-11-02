import {createClient} from '@supabase/supabase-js';
import {runSourcePreviewMaintenance} from '../src/source-preview-supabase.js';
import {serviceFetch} from '../src/service-fetch.js';
const origin=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!origin||!key)throw new Error('Configuração de manutenção ausente.');
const db=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:serviceFetch}});
try{console.log(JSON.stringify({result:'PASS',...await runSourcePreviewMaintenance(db,origin,AbortSignal.timeout(60000))}));}catch{console.error('Coleta incompleta: heartbeat não renovado.');process.exitCode=1;}
