import { buildApp } from './application.js';
await buildApp().listen({port:Number(process.env.PORT??3001),host:process.env.HOST??'127.0.0.1'});
