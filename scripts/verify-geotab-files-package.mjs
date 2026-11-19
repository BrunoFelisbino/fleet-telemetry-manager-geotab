import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {Script} from 'node:vm';

const dir='dist-geotab';
const json=readFileSync(join(dir,'configuration.json'),'utf8');
const manifest=JSON.parse(json);
const filenames=['dashboard.html','mileage.html','incidents.html','health.html','exceptions.html','trips.html'];
assert.equal(manifest.version,'0.4.8');
assert.deepEqual(manifest,JSON.parse(readFileSync('addin-config.files-v0.4.8.json','utf8')),'GitHub manifest must match zipped manifest exactly');
assert.equal(manifest.name,'fleetTelemetryManager');
assert.equal(manifest.items.length,6);
assert.deepEqual(manifest.items.map(x=>x.url),filenames);
assert.deepEqual(manifest.files,{});
assert.ok(json.length<5000,'Do not put source code into manifest: use MyGeotab Files tab instead');
const checks=[
  ['dashboard.html','Fleet Telemetry Manager'],
  ['mileage.html','Quilometragem da Frota'],
  ['incidents.html','Ocorrências e SLA'],
  ['health.html','Fleet Health Score'],
  ['exceptions.html','Fleet Exception 360'],
  ['trips.html','Fleet Trip 360']
];
for(const [path,heading] of checks){
 const html=readFileSync(join(dir,'pages',path),'utf8');
 assert.ok(html.length>25000,path+' must contain the REAL module, not smoke test');
 assert.ok(html.includes(heading),path+' missing page title');
 assert.ok(!html.includes('TESTE OK: Add-In carregado e initialize executado'),path+' is still diagnostic');
 assert.ok(html.includes('[Fleet TM v0.4.8]'),path+' did not update runtime marker');
 assert.ok(html.includes('geotab.addin.fleetTelemetryManager'),path+' missing Geotab lifecycle');
 const js=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
 assert.equal(js.length,1,path+' must contain one ordered inline app script');
 new Script(js[0][1],{filename:path});
 console.log('OK full UI:',path,html.length,'bytes');
}
assert.ok(existsSync(join(dir,'pages','icon.svg')),'Missing brand icon');
assert.ok(statSync(join(dir,'pages','icon.svg')).size>100,'Empty icon');
const trips=readFileSync(join(dir,'pages','trips.html'),'utf8');
assert.ok(trips.includes('loadDevices('),'Real trips application must query vehicle list');
assert.ok(trips.includes('function init(api){shell();'),'Real trips application must mount full interface');
assert.ok(trips.includes('pdf-stage'),'Preserve trips PDF layout');
const mileage=readFileSync(join(dir,'pages','mileage.html'),'utf8');
assert.ok(mileage.includes('mileage-dashboard'),'Preserve mileage dashboard');
console.log('OK v0.4.8: six full original modules, one Add-In, tiny manifest, Files ZIP layout.');
