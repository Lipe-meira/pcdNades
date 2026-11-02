import {beforeDeadline} from './import-deadline.js';
export type MaintenanceHealth={status:'starting'|'healthy'|'degraded'|'stopped';lastSuccessAt:string|null;lastAttemptAt:string|null;consecutiveFailures:number;durationMs:number;overdue:boolean};
export function maintenanceHealthy(value:unknown,now=Date.now()){
 if(!value||typeof value!=='object'||!Number.isFinite(now))return false;
 const h=value as MaintenanceHealth,attempt=Date.parse(h.lastAttemptAt??''),success=Date.parse(h.lastSuccessAt??'');
 return h.status==='healthy'&&h.consecutiveFailures===0&&[attempt,success].every(t=>Number.isFinite(t)&&t<=now+5000)&&now-attempt<=240000&&now-success<=480000;
}
export async function maintenanceRunner(ports:{sweep:(signal:AbortSignal)=>Promise<unknown>;report:(health:MaintenanceHealth)=>Promise<void>;sleep:(ms:number,signal:AbortSignal)=>Promise<void>;now:()=>number},signal:AbortSignal){
 let lastSuccess:number|null=null,failures=0,lastHealth:MaintenanceHealth|undefined;
 while(!signal.aborted){
  const start=ports.now();let success=false;
  try{const deadline=AbortSignal.any([signal,AbortSignal.timeout(60000)]);await beforeDeadline(ports.sweep(deadline),deadline);if(!signal.aborted){lastSuccess=ports.now();failures=0;success=true;}}catch{failures++;}
  const now=ports.now();lastHealth={status:signal.aborted?'stopped':success?'healthy':'degraded',lastSuccessAt:lastSuccess===null?null:new Date(lastSuccess).toISOString(),lastAttemptAt:new Date(start).toISOString(),consecutiveFailures:failures,durationMs:now-start,overdue:lastSuccess===null||now-lastSuccess>480000};await ports.report(lastHealth);
  if(signal.aborted)break;
  try{await ports.sleep(Math.max(0,180000-(now-start)),signal);}catch{if(!signal.aborted)throw new Error('MAINTENANCE_WAIT_FAILED');}
 }
 if(signal.aborted&&lastHealth?.status!=='stopped')await ports.report({status:'stopped',lastSuccessAt:lastHealth?.lastSuccessAt??null,lastAttemptAt:lastHealth?.lastAttemptAt??null,consecutiveFailures:failures,durationMs:lastHealth?.durationMs??0,overdue:lastSuccess===null||ports.now()-lastSuccess>480000});
}
