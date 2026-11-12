// Validade efetiva de URLs assinadas de upload do Supabase Storage.
//
// Não existe um valor universal. O Storage self-hosted lê UPLOAD_SIGNED_URL_EXPIRATION_TIME (alias SIGNED_UPLOAD_URL_EXPIRATION_TIME,
// em segundos) e usa 60 quando ausente (conferido nas imagens v1.80.2 e v1.84.19, rota getSignedUploadURL); a documentação do
// supabase-js fala em 2 horas. O SDK não aceita `expiresIn` em createSignedUploadUrl. O valor de CADA ambiente deve ser medido
// (scripts/measure-upload-url-ttl.ts) antes de qualquer decisão que dependa dele (janela de "pendente", espera de dreno, limpeza).

/** Suposição que o PR #19 gravou na migration 20261112180000 (150 min = 2 h + 30 min). É suposição, NÃO medição. */
export const UPLOAD_WINDOW_ASSUMPTION={assumedTtlSeconds:7200,sqlWindowMinutes:150,measured:false} as const;

/** exp - iat do JWT emitido pelo Storage. Não verifica assinatura e nunca devolve nem registra o token. null se não for confiável. */
export function tokenLifetimeSeconds(token:string):number|null{
 if(typeof token!=='string')return null;
 const parts=token.split('.');if(parts.length!==3)return null;
 let claims:unknown;
 try{claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch{return null;}
 if(claims===null||typeof claims!=='object'||Array.isArray(claims))return null;
 const {iat,exp}=claims as Record<string,unknown>;
 if(!Number.isInteger(iat)||!Number.isInteger(exp))return null;
 const lifetime=(exp as number)-(iat as number);
 return lifetime>0?lifetime:null;
}

type UploadSigner={createSignedUploadUrl:(path:string)=>PromiseLike<{data:{token:string}|null;error:unknown}>};
/** Emite um token para um caminho de sonda (nenhum objeto é criado, nenhum byte enviado) e devolve só a validade efetiva. */
export async function measureUploadTtl(storage:UploadSigner,probePath:string):Promise<{ttlSeconds:number}>{
 const issued=await storage.createSignedUploadUrl(probePath);
 if(issued.error||!issued.data)throw new Error('não foi possível emitir o token de sonda');
 const ttlSeconds=tokenLifetimeSeconds(issued.data.token);
 if(ttlSeconds===null)throw new Error('o token emitido não permite concluir a validade (iat/exp ausentes)');
 return {ttlSeconds};
}

/** Quanto esperar depois da ÚLTIMA emissão possível antes de tratar um objeto como inalcançável por reenvio. Exige TTL medido. */
export function drainWaitSeconds(o:{ttlSeconds:number;clockToleranceSeconds?:number;marginSeconds?:number}):number{
 const {ttlSeconds,clockToleranceSeconds=30,marginSeconds=600}=o;
 if(typeof ttlSeconds!=='number'||!Number.isFinite(ttlSeconds)||ttlSeconds<=0)throw new Error('TTL efetivo medido é obrigatório e deve ser positivo');
 for(const v of [clockToleranceSeconds,marginSeconds])if(!Number.isFinite(v)||v<0)throw new Error('tolerância e margem devem ser números não negativos');
 return ttlSeconds+clockToleranceSeconds+marginSeconds;
}
