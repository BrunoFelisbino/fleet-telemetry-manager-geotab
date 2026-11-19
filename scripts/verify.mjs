import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const manifest=JSON.parse(read('addin-config.json'));
assert.equal(manifest.name,'fleetTelemetryManager');
assert.equal(manifest.version,'0.1.0');
assert.equal(manifest.isSigned,false);
assert.equal(manifest.items.length,4);
for(const item of manifest.items){assert.ok(item.url.startsWith('https://'));assert.ok(item.svgIcon.startsWith('https://'));}
const paths=['index.html','assets/app.css','assets/app.js','print-options.js','health/index.html','health-pdf.js','exceptions/index.html','exceptions/audit.css','exceptions/audit.js','exceptions/pdf.js','trips/index.html','reports/premium.css','icon.svg'];
for(const p of paths)assert.ok(existsSync(p),'Arquivo ausente: '+p);
for(const p of paths.filter(x=>x.endsWith('.js')))new Script(read(p),{filename:p});
for(const p of ['health/index.html','exceptions/index.html','trips/index.html'])assert.ok(read(p).includes('geotab.addin.fleetTelemetryManager'),'Namespace incorreto: '+p);
const main=read('assets/app.js');assert.ok(main.includes('idlingDuration'));assert.ok(main.includes('isDeviceCommunicating'));
assert.ok(!main.includes('localStorage'));
console.log('OK: manifesto, componentes, scripts e namespace.');
