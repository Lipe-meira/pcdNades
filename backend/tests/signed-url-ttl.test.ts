// Validade EFETIVA das URLs assinadas de upload: nunca assumida (60 s no Storage local 1.84.19, 2 h na documentação do SDK).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tokenLifetimeSeconds,drainWaitSeconds,measureUploadTtl,UPLOAD_WINDOW_ASSUMPTION} from '../src/signed-url-ttl.js';

const b64=(o:unknown)=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=(payload:unknown)=>`${b64({alg:'HS256',typ:'JWT'})}.${b64(payload)}.signature-not-verified`;

test('lê exp-iat do token emitido, sem verificar assinatura nem exigir outras claims',()=>{
 assert.equal(tokenLifetimeSeconds(jwt({url:'videos-staging/a/source.mp4',iat:1000,exp:1060})),60);
 assert.equal(tokenLifetimeSeconds(jwt({iat:1000,exp:8200})),7200);
});

test('token ilegível ou sem iat/exp inteiros e coerentes devolve null (nunca um valor inventado)',()=>{
 for(const bad of ['','abc','a.b.c',jwt({exp:1060}),jwt({iat:1000}),jwt({iat:'1000',exp:1060}),jwt({iat:1000.5,exp:1060}),jwt({iat:1060,exp:1000}),jwt({iat:1000,exp:1000}),jwt(null),jwt([]),`${b64({})}.${'%%%'}.x`])assert.equal(tokenLifetimeSeconds(bad),null,String(bad));
 assert.equal(tokenLifetimeSeconds(undefined as any),null);
});

test('espera de dreno = maior validade efetiva + tolerância + margem; exige validade medida e positiva',()=>{
 assert.equal(drainWaitSeconds({ttlSeconds:60}),60+30+600);
 assert.equal(drainWaitSeconds({ttlSeconds:7200,clockToleranceSeconds:60,marginSeconds:300}),7560);
 for(const ttl of [0,-1,NaN,Infinity,undefined as any,null as any,'60' as any])assert.throws(()=>drainWaitSeconds({ttlSeconds:ttl}),/TTL/);
 assert.throws(()=>drainWaitSeconds({ttlSeconds:60,marginSeconds:-1}));
});

test('a suposição antiga fica explícita e rotulada como suposição, não como medição',()=>{
 assert.equal(UPLOAD_WINDOW_ASSUMPTION.assumedTtlSeconds,7200);assert.equal(UPLOAD_WINDOW_ASSUMPTION.sqlWindowMinutes,150);assert.equal(UPLOAD_WINDOW_ASSUMPTION.measured,false);
});

test('medição emite UM token para um caminho de sonda, não envia nenhum byte e devolve só a validade',async()=>{
 const calls:string[]=[];
 const storage={createSignedUploadUrl:async(path:string)=>{calls.push(path);return {data:{token:jwt({iat:5000,exp:5060}),signedUrl:'https://x/secret?token=abc'},error:null};}};
 const result=await measureUploadTtl(storage as any,'ttl-probe/00000000-0000-4000-8000-000000000000.mp4');
 assert.deepEqual(result,{ttlSeconds:60});assert.deepEqual(calls,['ttl-probe/00000000-0000-4000-8000-000000000000.mp4']);
 assert.ok(!JSON.stringify(result).includes('token'),'o resultado nunca carrega o token nem a URL');
});

test('medição falha de forma explícita quando o token não permite concluir a validade',async()=>{
 await assert.rejects(measureUploadTtl({createSignedUploadUrl:async()=>({data:{token:'opaco'},error:null})} as any,'p/x.mp4'),/validade/);
 await assert.rejects(measureUploadTtl({createSignedUploadUrl:async()=>({data:null,error:{message:'boom'}})} as any,'p/x.mp4'),/emitir/);
});
