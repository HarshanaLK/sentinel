import { buildApp } from './app.js';
import { config } from './config.js';
const app=await buildApp();
await app.listen({host:'127.0.0.1',port:config.PORT});
