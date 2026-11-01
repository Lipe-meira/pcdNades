import {watchFile,unwatchFile} from 'node:fs';
import {importFailure} from './import-network.js';
// TLS relay counts encrypted transport separately. This guard measures the
// native downloader's actual file, including sources without Content-Length.
export function guardImportFile(path:string,controller:AbortController,maxBytes=50000000){
 const listener=(file:{size:number})=>{if(file.size>maxBytes&&!controller.signal.aborted)controller.abort(importFailure('FILE_TOO_LARGE'));};
 watchFile(path,{interval:50,persistent:false},listener);
 return ()=>unwatchFile(path,listener);
}
