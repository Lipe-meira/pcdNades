import Fastify from 'fastify';
import { configureApp } from './application.js';
const app=Fastify({logger:true,bodyLimit:16384});
configureApp(app);
void app.listen({port:Number(process.env.PORT??3001),host:process.env.HOST??'127.0.0.1'}).catch(error=>{app.log.error(error);process.exitCode=1;});
