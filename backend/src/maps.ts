export function mapView(map:any,frontendUrl:string|undefined){
 if(!frontendUrl)throw Object.assign(new Error('FRONTEND_URL_REQUIRED'),{statusCode:503});
 const base=new URL(frontendUrl);
 if(!['http:','https:'].includes(base.protocol))throw new Error('INVALID_FRONTEND_URL');
 return {...map,radar:{...map.radar,imageUrl:new URL(map.radar.imageUrl,base.origin).href}};
}
