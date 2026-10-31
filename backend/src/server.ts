import Fastify from 'fastify';
import { configureApp } from './application.js';
// Keep the builder artifact within the same budget as the audited project.
export const config = { maxDuration: 120 };
const app=Fastify({logger:true,bodyLimit:16384});
configureApp(app);
void app.listen({port:Number(process.env.PORT??3001),host:process.env.HOST??'127.0.0.1'}).catch(error=>{app.log.error(error);process.exitCode=1;});
