import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
export async function downloadBounded(url:string,path:string,maxBytes:number,signal?:AbortSignal){
 const response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000),redirect:'error'});
 if(!response.ok||!response.body)throw new Error('STORAGE_UNAVAILABLE');
 if(Number(response.headers.get('content-length'))>maxBytes){await response.body.cancel();throw new Error('FILE_TOO_LARGE');}
 let count=0;
 await pipeline(Readable.fromWeb(response.body as any),new Transform({transform(chunk,_encoding,done){count+=chunk.length;done(count>maxBytes?new Error('FILE_TOO_LARGE'):null,chunk);}}),createWriteStream(path));
}
