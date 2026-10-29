export interface MediaLimits { readonly maxBytes: number; readonly maxDurationSeconds: number }
export function readMediaLimits(env: Record<string,string|undefined> = process.env): MediaLimits {
 function positiveInteger(name:string,fallback:number):number {
  const value=env[name];
  if(value===undefined)return fallback;
  if(!/^[1-9][0-9]*$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error(`${name} deve ser um inteiro positivo seguro.`);
  return Number(value);
 }
 const bytes=positiveInteger('MEDIA_MAX_BYTES',50000000);
 if(bytes>50000000)throw new Error('MEDIA_MAX_BYTES deve ser no máximo 50000000.');
 const duration=positiveInteger('MEDIA_MAX_DURATION_SECONDS',90);
 if(duration>90)throw new Error('MEDIA_MAX_DURATION_SECONDS deve ser no máximo 90 segundos.');
 return Object.freeze({maxBytes:bytes,maxDurationSeconds:duration});
}

export function readUploadEnabled(env: Record<string,string|undefined> = process.env): boolean {
 const value=env.MEDIA_UPLOAD_ENABLED;
 if(value===undefined||value==='false')return false;
 if(value==='true')return true;
 throw new Error('MEDIA_UPLOAD_ENABLED deve ser true ou false.');
}
export function readProcessorMode(env:Record<string,string|undefined>=process.env):'inline-original'|'worker-transcode'{
 const value=env.MEDIA_PROCESSOR_MODE??'inline-original';
 if(value!=='inline-original'&&value!=='worker-transcode')throw new Error('MEDIA_PROCESSOR_MODE inválido.');
 return value;
}

export function readTrimmingEnabled(env:Record<string,string|undefined>=process.env):boolean{const value=env.MEDIA_TRIMMING_ENABLED;if(value===undefined||value==='false')return false;if(value==='true')return true;throw new Error('MEDIA_TRIMMING_ENABLED deve ser true ou false.');}
