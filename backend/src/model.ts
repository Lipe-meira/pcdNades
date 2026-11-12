import { z } from 'zod';
const radarPoint=z.object({x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1)}).strict();
// Andares: ids estáveis gravados no banco. Só mapas listados em `levelMaps` aceitam andar (espelha private.map_has_levels).
const level=z.enum(['upper','lower']);
export const levelMaps:Record<string,readonly string[]>={nuke:['upper','lower']};
const fields = z.object({title:z.string().trim().min(1).max(120),mapId:z.string().min(1),type:z.enum(['smoke','flashbang','molotov','he','solo_exec']),destinations:z.array(radarPoint.extend({type:z.enum(['smoke','flashbang','molotov','he']),level:level.nullable().optional()})).min(1).max(12).nullable().optional(),side:z.enum(['T','CT']),instructions:z.string().trim().min(1).max(10000),target:radarPoint,origin:radarPoint.nullable().optional(),originLevel:level.nullable().optional(),targetLevel:level.nullable().optional(),videoId:z.uuid()}).strict();
export const body=fields;
type Lv=z.infer<typeof fields>;
// Regras de andar. `complete` (criação) exige andares em mapas com andares; no PATCH só valida o que foi enviado.
function checkLevels(v:Partial<Lv>,ctx:z.RefinementCtx,complete:boolean){
 const add=(message:string)=>ctx.addIssue({code:'custom',message});
 const anyLevel=v.originLevel||v.targetLevel||v.destinations?.some(d=>d.level);
 if(v.mapId!==undefined&&!(v.mapId in levelMaps)){if(anyLevel)add('Este mapa não possui andares.');return;}
 if(v.mapId===undefined||!(v.mapId in levelMaps))return;
 if((complete||v.target!==undefined)&&!v.targetLevel)add('Informe o andar do destino.');
 if((complete||v.origin!==undefined)&&v.origin&&!v.originLevel)add('Informe o andar da origem.');
 if(v.origin===null&&v.originLevel)add('Andar da origem exige uma origem.');
 if(v.type==='solo_exec'&&v.destinations?.some(d=>!d.level))add('Informe o andar de cada destino do Solo Exec.');
 if(v.type==='solo_exec'&&v.destinations?.length&&v.targetLevel&&v.destinations[0].level&&v.targetLevel!==v.destinations[0].level)add('Andar do destino principal deve coincidir com o primeiro destino.');
}
export const createBody=fields.superRefine((v,ctx)=>{if(v.type==='solo_exec'&&(!v.origin||!v.destinations?.length))ctx.addIssue({code:'custom',message:'Solo Exec precisa de origem e destinos.'});if(v.type==='solo_exec'&&v.destinations?.length&&(v.target.x!==v.destinations[0].x||v.target.y!==v.destinations[0].y))ctx.addIssue({code:'custom',message:'Destino principal deve coincidir com o primeiro ponto.'});if(v.type!=='solo_exec'&&v.destinations?.length)ctx.addIssue({code:'custom',message:'Destinos múltiplos são exclusivos de Solo Exec.'});checkLevels(v,ctx,true);});
export const patchBody=fields.partial().superRefine((v,ctx)=>{if(v.type==='solo_exec'&&(v.origin===null||v.destinations===null))ctx.addIssue({code:'custom',message:'Solo Exec precisa de origem e destinos.'});if(v.type&&v.type!=='solo_exec'&&v.destinations?.length)ctx.addIssue({code:'custom',message:'Destinos múltiplos são exclusivos de Solo Exec.'});if(v.target&&v.destinations?.length&&(v.target.x!==v.destinations[0].x||v.target.y!==v.destinations[0].y))ctx.addIssue({code:'custom',message:'Destino principal deve coincidir com o primeiro ponto.'});checkLevels(v,ctx,false);});
export const filters=z.object({mapId:z.string().optional(),type:z.enum(['smoke','flashbang','molotov','he','solo_exec']).optional(),side:z.enum(['T','CT']).optional(),limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).default(0)}).strict();
export const uuid=z.uuid();
export const pageQuery=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).default(0)}).strict();
// Apelido: só exibição, nunca identidade nem permissão. Sem controles/formatação invisível; nomes que imitam a equipe são reservados.
const reservedNicknames=new Set(['admin','administrador','administrator','moderador','moderator','mod','equipe','staff','pcdnades','sistema','system','suporte','oficial']);
const nickname=z.string().refine(v=>!/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(v),'Apelido inválido.')
 .transform(v=>v.normalize('NFC').trim().replace(/ {2,}/g,' '))
 .pipe(z.string().min(2).max(24).regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u).refine(v=>!reservedNicknames.has(v.toLowerCase().replace(/[ ._-]/g,'')),'Apelido reservado.'));
export const nicknameBody=z.object({nickname}).strict();
export const mediaView=(r:any)=>({id:r.id,status:r.status,sourceType:r.source_type,sourceUrl:r.source_url,sourceId:r.import_source_id??null,clip:r.clip??null,stage:r.stage,error:r.error,metadata:r.metadata,createdAt:r.created_at,updatedAt:r.updated_at});
export const grenadeView=(r:any)=>({id:r.id,revision:r.revision,title:r.title,mapId:r.map_id,type:r.type,side:r.side,instructions:r.instructions,target:r.target,destinations:r.destinations??undefined,origin:r.origin_x!=null&&r.origin_y!=null?{x:r.origin_x,y:r.origin_y}:null,originLevel:r.origin_level??null,targetLevel:r.target_level??null,video:r.media_assets?mediaView(r.media_assets):null,author:r.authorNickname!=null?{nickname:r.authorNickname}:null,createdAt:r.created_at,updatedAt:r.updated_at});
export const dbBody=(r:any)=>{
 const {origin,...fields}=r;
 const mapped=Object.fromEntries(Object.entries(fields).map(([k,v])=>[({mapId:'map_id',videoId:'video_id',originLevel:'origin_level',targetLevel:'target_level'} as Record<string,string>)[k]??k,v]));
 // Undefined means no change on PATCH; null clears both columns atomically.
 if(origin!==undefined){mapped.origin_x=origin?.x??null;mapped.origin_y=origin?.y??null;}
 return mapped;
};
