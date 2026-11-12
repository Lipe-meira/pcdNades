// Transparent routing only: Auth, REST and Storage still enforce their own JWT/RLS.
import http from 'node:http';
http.createServer((req,res)=>{
 const routes=[['/auth/v1','auth',9999],['/rest/v1','rest',3000],['/storage/v1','storage',5000]];
 const r=routes.find(([p])=>req.url.startsWith(p));
 if(!r){res.writeHead(404).end();return;}
 const upstream=http.request({host:r[1],port:r[2],path:req.url.slice(r[0].length)||'/',method:req.method,headers:{...req.headers,'x-forwarded-for':req.socket.remoteAddress,host:`${r[1]}:${r[2]}`}},out=>{res.writeHead(out.statusCode,out.headers);out.pipe(res);});
 upstream.on('error',()=>res.writeHead(502).end());req.pipe(upstream);
}).listen(8000,'0.0.0.0');
