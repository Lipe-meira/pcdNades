import {readFile} from 'node:fs/promises';import {maintenanceHealthy} from '../src/maintenance-runner.js';
let healthy=false;try{const path=process.argv[2]??process.env.MAINTENANCE_HEALTH_FILE;if(path)healthy=maintenanceHealthy(JSON.parse(await readFile(path,'utf8')));}catch{}
console.log(JSON.stringify({healthy}));if(!healthy)process.exitCode=1;
