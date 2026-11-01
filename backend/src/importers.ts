import {z} from 'zod';
export type ImportProvider='youtube'|'tiktok'|'instagram';
export type Clip={startSeconds:number;endSeconds:number};
export const clipSchema=z.object({startSeconds:z.number().finite().min(0),endSeconds:z.number().finite().positive()}).strict().refine(v=>v.endSeconds-v.startSeconds>=0.1-1e-8&&v.endSeconds-v.startSeconds<=90&&v.endSeconds<=180&&[v.startSeconds,v.endSeconds].every(n=>Math.abs(n*1000-Math.round(n*1000))<1e-6),{message:'Escolha intervalo de 0,1 a 90 segundos, em fonte até 180 segundos e precisão de 0,001 segundo.'});
export const importRequest=z.object({sourceUrl:z.string().min(1).max(2048),clip:clipSchema.optional()}).strict();
export const completeRequest=z.object({}).strict();
export const uploadRequest=z.object({clip:clipSchema.optional()}).strict();
export type SourceLink={provider:ImportProvider;sourceUrl:string;canonicalUrl:string;videoId:string;shortLink:boolean};
export class SourceUrlError extends Error {readonly statusCode=400;readonly code='INVALID_SOURCE_URL';constructor(){super('Informe um link HTTPS válido de Shorts, TikTok ou Instagram Reels.');}}
export function recognizeSource(input:string):SourceLink{
 if(input!==input.trim()||input.length>2048||/[\s\\\u0000-\u001f\u007f]/u.test(input))throw new SourceUrlError();
 let u:URL;try{u=new URL(input);}catch{throw new SourceUrlError();}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||/%/.test(u.pathname)||!/^https:\/\/[a-z0-9.-]+\//i.test(input))throw new SourceUrlError();
 const host=u.hostname;let provider:ImportProvider,videoId:string,shortLink=false,match:RegExpMatchArray|null;
 if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)&&(match=u.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/))){provider='youtube';videoId=match[1];u.hostname='www.youtube.com';u.pathname=`/shorts/${videoId}`;}
 else if(['www.tiktok.com','tiktok.com','m.tiktok.com'].includes(host)&&(match=u.pathname.match(/^\/@[A-Za-z0-9._]{1,64}\/video\/([0-9]{10,24})\/?$/))){provider='tiktok';videoId=match[1];u.hostname='www.tiktok.com';}
 else if(['vm.tiktok.com','vt.tiktok.com'].includes(host)&&(match=u.pathname.match(/^\/([A-Za-z0-9]{4,32})\/?$/))){provider='tiktok';videoId=match[1];shortLink=true;}
 else if(['instagram.com','www.instagram.com'].includes(host)&&(match=u.pathname.match(/^\/reel\/([A-Za-z0-9_-]{3,64})\/?$/))){provider='instagram';videoId=match[1];u.hostname='www.instagram.com';u.pathname=`/reel/${videoId}/`;}
 else throw new SourceUrlError();
 u.search='';return {provider,videoId,shortLink,sourceUrl:input,canonicalUrl:u.href};
}
export const importerCapabilities=Object.freeze({
 youtube:{enabled:false,reasonCode:'PLATFORM_UNSUPPORTED',message:'Download do YouTube não habilitado: exige método e aprovação aplicáveis. Envie um MP4 autorizado.'},
 tiktok:{enabled:false,reasonCode:'PLATFORM_UNSUPPORTED',message:'Importação do TikTok desativada neste ambiente. A integração experimental ainda depende da validação do download. Envie um MP4 autorizado.'},
 instagram:{enabled:false,reasonCode:'PLATFORM_UNSUPPORTED',message:'Importação do Instagram não habilitada. É necessária integração oficial com conta autorizada. Envie um MP4 autorizado.'}
});
export interface ImportedFile {path:string;sourceUrl:string;provider:ImportProvider;}
export interface MediaImporter {readonly provider:ImportProvider;readonly enabled:boolean;download(sourceUrl:URL,signal:AbortSignal):Promise<ImportedFile>;}
export class UnavailableImporter implements MediaImporter {readonly enabled=false;constructor(readonly provider:ImportProvider){}async download(_sourceUrl:URL,_signal:AbortSignal):Promise<ImportedFile>{throw Object.assign(new Error(importerCapabilities[this.provider].message),{code:'PLATFORM_UNSUPPORTED',statusCode:422});}}
export const importers:readonly MediaImporter[]=['youtube','tiktok','instagram'].map(p=>new UnavailableImporter(p as ImportProvider));
export function disabledImport(input:unknown):never {const request=importRequest.parse(input);const source=recognizeSource(request.sourceUrl);throw Object.assign(new Error(importerCapabilities[source.provider].message),{code:'PLATFORM_UNSUPPORTED',statusCode:422});}
