export interface MediaLimits { readonly maxBytes: number; readonly maxDurationSeconds: number }
export function readMediaLimits(env: Record<string,string|undefined> = process.env): MediaLimits {
 function positiveInteger(name:string,fallback:number):number {
  const value=env[name];
  if(value===undefined)return fallback;
  if(!/^[1-9][0-9]*$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error(`${name} deve ser um inteiro positivo seguro.`);
  return Number(value);
 }
 const duration=positiveInteger('MEDIA_MAX_DURATION_SECONDS',20);
 if(duration>20)throw new Error('MEDIA_MAX_DURATION_SECONDS deve ser no máximo 20 segundos.');
 return Object.freeze({maxBytes:positiveInteger('MEDIA_MAX_BYTES',50000000),maxDurationSeconds:duration});
}
