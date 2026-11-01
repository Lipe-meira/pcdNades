import {importFailure} from './import-network.js';
export function beforeDeadline<T>(operation:PromiseLike<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);reject(importFailure('IMPORT_TIMEOUT',504));};
  // Observe even an already-started operation when the deadline has expired.
  Promise.resolve(operation).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  if(signal.aborted){abort();return;}
  signal.addEventListener('abort',abort,{once:true});
 });
}
export function remainingSignal(started:number,budgetMs:number){
 const remaining=Math.ceil(budgetMs-(performance.now()-started));
 return remaining<=0?AbortSignal.abort(importFailure('IMPORT_TIMEOUT',504)):AbortSignal.timeout(remaining);
}
