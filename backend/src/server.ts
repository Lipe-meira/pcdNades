import Fastify from 'fastify';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { configureApp } from './application.js';
import {registerImportPreflight} from './import-preflight.js';
// Keep the builder artifact within the same budget as the audited project.
export const config = { maxDuration: 120 };
const app=Fastify({logger:true,bodyLimit:16384});
configureApp(app);
registerImportPreflight(app);
export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  await app.ready();
  app.server.emit('request', request, response);
}
if (process.env.VERCEL !== '1') {
  void app.listen({port:Number(process.env.PORT??3001),host:process.env.HOST??'127.0.0.1'}).catch(error=>{app.log.error(error);process.exitCode=1;});
}
