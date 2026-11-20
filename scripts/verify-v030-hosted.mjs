import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const read=p=>readFileSync(p,'utf8');
const json=JSON.parse(read('addin-config.v030-hosted.json'));
const v=JSON.parse(read('vercel.json'));
const original=[
  ['index.html','dashboard030.html'],
  ['mileage/index.html','mileage/mileage030.html'],
  ['incidents/index.html','incidents/incidents030.html'],
  ['health/index.html','health/health030.html'],
  ['exceptions/index.html','exceptions/exceptions030.html'],
  ['trips/index.html','trips/trips030.html']
];
assert.equal(json.version,'0.3.1');
assert.equal(json.name,'fleetTelemetryManager');
assert.equal(json.items.length,6);
assert.ok(json.items.every(item=>item.path==='ActivityLink/'));
const urls=new Set();
for(let i=0;i<original.length;i++){
  const [source,target]=original[i],item=json.items[i],url=new URL(item.url);
  assert.equal(url.hostname,'ftmbrunog2026.vercel.app');
  assert.ok(!/[-@#]/.test(item.url),'Geotab incompatible URL: '+item.url);
  assert.equal(url.pathname,'/'+target);
  assert.ok(!urls.has(url.pathname),'Duplicate page path: '+url.pathname);
  urls.add(url.pathname);
  assert.deepEqual(read(source),read(target),'Changed original v0.3.0 source: '+target);
  const page=read(target);
  const scripts = [...page.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(x=>x[1]);
  for (const item of scripts){
    if(!item.startsWith('./')&&!item.startsWith('../'))continue;
    const asset=resolve(dirname(target),item.split('?')[0]);
    assert.ok(existsSync(asset),'Missing relative script: '+target+' -> '+item);
  }
  assert.ok(page.includes('geotab.addin.fleetTelemetryManager') || scripts.some(s=>/^(\.\/|\.\.\/)/.test(s)&&read(resolve(dirname(target),s.split('?')[0])).includes('geotab.addin.fleetTelemetryManager')),'Namespace missing: '+target);
}
assert.ok(v.headers.some(rule=>rule.source==='/(.*)'&&rule.headers.some(h=>h.key==='Access-Control-Allow-Origin'&&h.value==='*')));
assert.ok(json.items.every(item=>item.svgIcon==='https://ftmbrunog2026.vercel.app/icon.svg'));
console.log('OK: six unchanged v0.3.0 HTML routes, original assets, clean URLs, Geotab namespace and Vercel CORS.');
