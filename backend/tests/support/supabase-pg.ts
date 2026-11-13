// Substitui o supabase-js nos testes de API: cada consulta roda em PostgreSQL REAL (PGlite) com o papel e o JWT do
// cliente (anon / authenticated+sub / service_role), então RLS, privilégios, triggers e constraints valem de verdade.
// NÃO é PostgREST, GoTrue nem Storage: cobre só o subconjunto de consulta que o backend usa.
import type {PGlite} from '@electric-sql/pglite';

type Role='anon'|'authenticated'|'service_role';
export type Session={sub:string;anonymous:boolean};
const q=(id:string)=>`"${id.replace(/"/g,'""')}"`;
const jsonParam=(v:unknown)=>v!==null&&typeof v==='object'&&!(v instanceof Date)?JSON.stringify(v):v;

export function createSupabaseOverPg(db:PGlite,sessions:Record<string,Session>){
 let chain:Promise<unknown>=Promise.resolve();
 const stats={queries:0};
 function exec(role:Role,claims:Session|null,sql:string,params:unknown[]):Promise<{rows:any[];affectedRows?:number}>{
  const run=async()=>{
   stats.queries++;
   return db.transaction(async tx=>{
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[claims?.sub??'',claims?JSON.stringify({sub:claims.sub,role,is_anonymous:claims.anonymous}):'']);
    return await tx.query<any>(sql,params);
   });
  };
  const result=chain.then(run,run);chain=result.catch(()=>{});return result;
 }
 const fail=(e:any)=>({data:null,error:{code:e?.code,message:String(e?.message??e)},count:null});

 class Builder implements PromiseLike<any>{
  op:'select'|'insert'|'update'|'delete'='select';cols='*';payload:any;filters:Array<[string,string,unknown]>=[];orders:Array<[string,boolean]>=[];
  offset=0;last?:number;max?:number;mode:'many'|'single'|'maybe'='many';wantCount=false;returning=false;
  constructor(private role:Role,private claims:Session|null,private table:string){}
  select(cols='*',options?:{count?:string}){if(this.op==='select'){this.cols=cols;this.wantCount=!!options?.count;}else{this.returning=true;this.cols=cols;}return this;}
  insert(v:any){this.op='insert';this.payload=v;return this;}
  update(v:any){this.op='update';this.payload=v;return this;}
  delete(){this.op='delete';return this;}
  eq(c:string,v:unknown){this.filters.push([c,'=',v]);return this;}
  neq(c:string,v:unknown){this.filters.push([c,'<>',v]);return this;}
  gt(c:string,v:unknown){this.filters.push([c,'>',v]);return this;}
  lte(c:string,v:unknown){this.filters.push([c,'<=',v]);return this;}
  in(c:string,v:unknown[]){this.filters.push([c,'in',v]);return this;}
  is(c:string,v:null){this.filters.push([c,'is',v]);return this;}
  order(c:string,o:{ascending?:boolean}={}){this.orders.push([c,o.ascending!==false]);return this;}
  range(a:number,b:number){this.offset=a;this.last=b;return this;}
  limit(n:number){this.max=n;return this;}
  abortSignal(){return this;}
  single(){this.mode='single';return this;}
  maybeSingle(){this.mode='maybe';return this;}
  private where(params:unknown[]){
   if(!this.filters.length)return '';
   return ' where '+this.filters.map(([c,op,v])=>{
    if(op==='is')return `${q(c)} is null`;
    if(op==='in'){params.push(v);return `${q(c)} = any($${params.length})`;}
    params.push(jsonParam(v));return `${q(c)} ${op} $${params.length}`;
   }).join(' and ');
  }
  async run(){
   try{
    const params:unknown[]=[];const t=`public.${q(this.table)}`;let sql:string;
    if(this.op==='select'){
     const cols=this.cols==='*'?'*':this.cols.split(',').map(c=>q(c.trim())).join(',');
     sql=`select ${cols} from ${t}${this.where(params)}`;
     if(this.orders.length)sql+=' order by '+this.orders.map(([c,asc])=>`${q(c)} ${asc?'asc':'desc'}`).join(',');
     const limit=this.last!==undefined?this.last-this.offset+1:this.max;
     if(limit!==undefined)sql+=` limit ${limit}`;if(this.offset)sql+=` offset ${this.offset}`;
    }else if(this.op==='insert'){
     const rows=Array.isArray(this.payload)?this.payload:[this.payload];const keys=Object.keys(rows[0]);
     sql=`insert into ${t}(${keys.map(q).join(',')}) values ${rows.map(r=>`(${keys.map(k=>{params.push(jsonParam(r[k]));return `$${params.length}`;}).join(',')})`).join(',')}`;
    }else if(this.op==='update'){
     const keys=Object.keys(this.payload);
     sql=`update ${t} set ${keys.map(k=>{params.push(jsonParam(this.payload[k]));return `${q(k)}=$${params.length}`;}).join(',')}${this.where(params)}`;
    }else sql=`delete from ${t}${this.where(params)}`;
    if(this.op!=='select'&&this.returning)sql+=` returning ${this.cols==='*'?'*':this.cols.split(',').map(c=>q(c.trim())).join(',')}`;
    const r=await exec(this.role,this.claims,sql,params);
    let count:number|null=null;
    if(this.op==='select'&&this.wantCount){const p:unknown[]=[];count=(await exec(this.role,this.claims,`select count(*)::int n from ${t}${this.where(p)}`,p)).rows[0].n;}
    if(this.op!=='select'&&!this.returning)return {data:null,error:null,count};
    if(this.mode==='single'){if(r.rows.length!==1)return {data:null,error:{code:'PGRST116',message:'JSON object requested, multiple (or no) rows returned'},count};return {data:r.rows[0],error:null,count};}
    if(this.mode==='maybe'){if(r.rows.length>1)return {data:null,error:{code:'PGRST116',message:'multiple rows'},count};return {data:r.rows[0]??null,error:null,count};}
    return {data:r.rows,error:null,count};
   }catch(e){return fail(e);}
  }
  then<A,B>(ok?:(v:any)=>A|PromiseLike<A>,bad?:(e:any)=>B|PromiseLike<B>){return this.run().then(ok,bad);}
 }
 class Rpc implements PromiseLike<any>{
  constructor(private role:Role,private claims:Session|null,private name:string,private args:Record<string,unknown>){}
  abortSignal(){return this;}
  async run(){
   try{
    const keys=Object.keys(this.args);const params=keys.map(k=>jsonParam(this.args[k]));
    const r=await exec(this.role,this.claims,`select * from public.${q(this.name)}(${keys.map((k,i)=>`${q(k)} => $${i+1}`).join(',')})`,params);
    const cols=r.rows[0]?Object.keys(r.rows[0]):[];
    return {data:cols.length===1&&cols[0]===this.name?r.rows[0][this.name]:(r.rows[0]??null),error:null};
   }catch(e){return fail(e);}
  }
  then<A,B>(ok?:(v:any)=>A|PromiseLike<A>,bad?:(e:any)=>B|PromiseLike<B>){return this.run().then(ok,bad);}
 }
 const objects=new Set<string>();
 const storage={from:(bucket:string)=>({
  createSignedUploadUrl:async(path:string)=>({data:{signedUrl:`https://storage.test/${bucket}/${path}?token=t`,token:'t'},error:null}),
  createSignedUrl:async(path:string)=>({data:{signedUrl:`https://storage.test/${bucket}/${path}?sig=1`},error:null}),
  info:async(path:string)=>objects.has(path)?{data:{size:1000},error:null}:{data:null,error:{message:'Object not found'}}
 })};
 const client=(role:Role,claims:Session|null,withAuth?:string)=>({
  from:(table:string)=>new Builder(role,claims,table),
  rpc:(name:string,args:Record<string,unknown>={})=>new Rpc(role,claims,name,args),
  storage,
  auth:{getUser:async(token:string)=>{const s=sessions[token];return s?{data:{user:{id:s.sub,is_anonymous:s.anonymous}},error:null}:{data:{user:null},error:{message:'invalid JWT'}};}}
 });
 return {
  stats,objects,
  clients:{public:client('anon',null),service:client('service_role',null),user:(token:string)=>client('authenticated',sessions[token]??null,token)} as any
 };
}
