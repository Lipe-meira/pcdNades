// Reproduces Vercel's listen interception without invoking network or provider services.
import http from 'node:http';
let captured=false;http.Server.prototype.listen=function(){captured=true;return this;};
const imported=import('../dist/server.js').then(()=>true);
const result=await Promise.race([imported,new Promise(resolve=>setTimeout(()=>resolve(false),1500))]);
await new Promise(resolve=>setTimeout(resolve,100));
console.log(JSON.stringify({moduleEvaluated:result,listenCaptured:captured}));
process.exit(result&&captured?0:1);
