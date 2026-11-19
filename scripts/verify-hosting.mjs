import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const host='https://fleet-telemetry-manager-geotab.vercel.app';
const config=JSON.parse(read('vercel.json'));
assert.equal(config.version,2);
const rule=config.headers.find(x=>x.source==='/(.*)');
assert.ok(rule,'CORS must cover all static Add-In assets');
const headers=Object.fromEntries(rule.headers.map(h=>[h.key.toLowerCase(),h.value]));
assert.equal(headers['access-control-allow-origin'],'*','MyGeotab origin needs cross-origin GET of public code');
assert.ok(headers['access-control-allow-methods'].includes('GET'));
for(const filename of ['addin-config.json','addin-config.preview.json']){
 const manifest=JSON.parse(read(filename));
 assert.equal(manifest.version,'0.4.2');
 assert.equal(manifest.items.length,6);
 assert.ok(manifest.items.every(x=>x.category==='AddIns'),'Os seis módulos precisam da categoria AddIns');
 assert.equal(manifest.name,'fleetTelemetryManager');
 const routes=['index.html','mileage/index.html','incidents/index.html','health/index.html','exceptions/index.html','trips/index.html'];
 for(let i=0;i<routes.length;i++){
   const item=manifest.items[i];
   assert.equal(item.url,host+'/'+routes[i]+'?v=0.4.2','Every Add-In page must use the verified public host');
   assert.equal(item.svgIcon,host+'/icon.svg','Public icon must share CORS-enabled host');
   assert.ok(existsSync(routes[i]));
 }
}
const pages=['index.html','mileage/index.html','incidents/index.html','health/index.html','exceptions/index.html','trips/index.html'];
for(const path of pages){
 const html=read(path);
 assert.ok(!html.includes('brunofelisbino.github.io'),'Do not reference GitHub Pages in loaded modules');
 assert.ok(!/(?:src|href)="\.\.?\//.test(html),'Relative URLs break when HTML is injected into MyGeotab: '+path);
 for(const match of html.matchAll(/(?:src|href)="(https:\/\/fleet-telemetry-manager-geotab\.vercel\.app\/[^"]+)"/g)){
   const file=match[1].slice(host.length+1).split('?')[0];
   assert.ok(existsSync(file),'Missing public static file '+file+' referenced by '+path);
 }
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Script(match[1],{filename:path});
 const dir=path.includes('/')?path.split('/')[0]:'';
 for(const lang of ['pt-BR','en']){
   assert.ok(existsSync((dir?dir+'/':'')+'translations/'+lang+'.json'),'Missing translation for '+path);
 }
}
const trip=read('trips/index.html');
assert.ok(trip.includes("function init(api){shell();"),'Trip page should mount UI before handling missing API');
assert.ok(trip.includes('inicialização não recebida do MyGeotab'),'Trip must not stay indefinitely on loading');
console.log('OK: v0.4.2 URLs, menu categories, cross-origin headers and translations.');
