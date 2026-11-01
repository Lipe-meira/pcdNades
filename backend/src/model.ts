import { z } from 'zod';
const radarPoint=z.object({x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1)}).strict();
export const body = z.object({title:z.string().trim().min(1).max(120),mapId:z.string().min(1),type:z.enum(['smoke','flashbang','molotov']),side:z.enum(['T','CT']),instructions:z.string().trim().min(1).max(10000),target:radarPoint,origin:radarPoint.nullable().optional(),videoId:z.uuid()}).strict();
export const filters=z.object({mapId:z.string().optional(),type:z.enum(['smoke','flashbang','molotov']).optional(),side:z.enum(['T','CT']).optional(),limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).default(0)}).strict();
export const uuid=z.uuid();
export const mediaView=(r:any)=>({id:r.id,status:r.status,sourceType:r.source_type,sourceUrl:r.source_url,sourceId:r.import_source_id??null,clip:r.clip??null,stage:r.stage,error:r.error,metadata:r.metadata,createdAt:r.created_at,updatedAt:r.updated_at});
export const grenadeView=(r:any)=>({id:r.id,title:r.title,mapId:r.map_id,type:r.type,side:r.side,instructions:r.instructions,target:r.target,origin:r.origin_x!=null&&r.origin_y!=null?{x:r.origin_x,y:r.origin_y}:null,video:r.media_assets?mediaView(r.media_assets):null,createdAt:r.created_at,updatedAt:r.updated_at});
export const dbBody=(r:any)=>{
 const {origin,...fields}=r;
 const mapped=Object.fromEntries(Object.entries(fields).map(([k,v])=>[({mapId:'map_id',videoId:'video_id'} as Record<string,string>)[k]??k,v]));
 // Undefined means no change on PATCH; null clears both columns atomically.
 if(origin!==undefined){mapped.origin_x=origin?.x??null;mapped.origin_y=origin?.y??null;}
 return mapped;
};
