// Generates PRIVATE config only for this synthetic project; does not start/stop services.
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const project='rollout-loopback-20261108',network='pcdnades-rollout-loopback-20261108';
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Docker inspection failed');return r.stdout;};
const names=docker(['ps','-a','--filter',`name=_${project}`,'--format','{{.Names}}']).trim().split(/\r?\n/).filter(Boolean);
assert.equal(names.length,8,'Expected only the eight services of this lab');
const cfg={name:'pcdnades-loopback-compose-20261108',services:{},volumes:{},networks:{lab:{external:true,name:network}}};
for(const c of JSON.parse(docker(['inspect',...names]))){
 const name=c.Name.slice(1);assert.ok(name.endsWith('_'+project));
 const service={image:c.Config.Image,environment:c.Config.Env.map(v=>v.replaceAll('$','$$')),entrypoint:c.Config.Entrypoint,command:c.Config.Cmd,networks:{lab:{aliases:[name]}},volumes:[],ports:[]};
 if(c.Config.Healthcheck){const h=c.Config.Healthcheck;service.healthcheck={test:h.Test,interval:`${h.Interval||30000000000}ns`,timeout:`${h.Timeout||30000000000}ns`,retries:h.Retries||3,start_period:`${h.StartPeriod||0}ns`};}
 for(const m of c.Mounts){assert.equal(m.Type,'volume','Unexpected mount: review manually');assert.ok(m.Name.endsWith(project),'Foreign volume refused');cfg.volumes[m.Name]={external:true,name:m.Name};service.volumes.push({type:'volume',source:m.Name,target:m.Destination,read_only:!m.RW});}
 for(const [target,bindings] of Object.entries(c.HostConfig.PortBindings||{}))for(const b of bindings||[]){const [port,protocol]=target.split('/');service.ports.push({target:Number(port),published:b.HostPort,protocol,host_ip:'127.0.0.1'});}
 cfg.services[name]=service;
}
writeFileSync(new URL('../vendor/rollout-loopback-20261108/compose.private.json',import.meta.url),JSON.stringify(cfg,null,2),{flag:'wx'});
console.log('Private Compose generated; stop only this CLI project, then start Compose and inspect every binding before testing.');
