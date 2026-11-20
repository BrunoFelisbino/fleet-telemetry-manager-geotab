import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {Script} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const manifest=JSON.parse(read('addin-config.json'));
assert.equal(manifest.name,'fleetTelemetryManager');
assert.equal(manifest.version,'0.3.1');
assert.equal(manifest.isSigned,false);
assert.equal(manifest.items.length,6);
for(const item of manifest.items){assert.ok(item.url.startsWith('https://ftmbrunog2026.vercel.app/'));assert.ok(item.svgIcon.startsWith('https://ftmbrunog2026.vercel.app/'));assert.ok(!/[-@#]/.test(item.url));}
const paths=['index.html','assets/app.css','assets/app.js','mileage/index.html','mileage/model.js','mileage/filters.js','mileage/pdf.js','mileage/app.js','mileage/style.css','incidents/model.js','incidents/storage.js','incidents/app.js','incidents/style.css','incidents/index.html','print-options.js','health/index.html','health-pdf.js','exceptions/index.html','exceptions/audit.css','exceptions/audit.js','exceptions/pdf.js','trips/index.html','reports/premium.css','icon.svg'];
for(const p of paths)assert.ok(existsSync(p),'Arquivo ausente: '+p);
for(const p of paths.filter(x=>x.endsWith('.js')))new Script(read(p),{filename:p});
for(const p of paths.filter(x=>x.endsWith('.html'))){
  const page=read(p);
  const scripts=[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for(const m of scripts)new Script(m[1],{filename:p});
  for(const m of page.matchAll(/(?:src|href)="(\.{1,2}\/[^"]+)"/g)){
    const asset=resolve(dirname(p),m[1].split('?')[0]);
    assert.ok(existsSync(asset),'Referência local quebrada: '+p+' -> '+m[1]);
  }
}
for(const p of ['health/index.html','exceptions/index.html','trips/index.html'])assert.ok(read(p).includes('geotab.addin.fleetTelemetryManager'),'Namespace incorreto: '+p);
const main=read('assets/app.js');
assert.ok(main.includes('idlingDuration')&&main.includes('isDeviceCommunicating'));
assert.ok(!main.includes('localStorage'));
assert.ok(manifest.items.some(x=>x.url.includes('/incidents/')));
assert.ok(manifest.items.some(x=>x.url.includes('/mileage/')));
assert.ok(read('mileage/app.js').includes('geotab.addin.fleetTelemetryManager'));
assert.ok(read('mileage/index.html').includes('id="groupSearch"')&&read('mileage/index.html').includes('id="vehicleSearch"'));
assert.ok(read('mileage/index.html').includes('./filters.js?v=0.3.1'));
assert.ok(read('mileage/filters.js').includes('selectedGroups')&&read('mileage/filters.js').includes('selectedVehicles'));
assert.ok(read('mileage/index.html').includes('id="pdfBtn"'));
assert.ok(read('mileage/index.html').includes('id="trendChart"'));
assert.ok(read('mileage/index.html').includes('./pdf.js?v=0.3.2'));
assert.ok(read('incidents/app.js').includes('geotab.addin.fleetTelemetryManager'));
assert.ok(read('incidents/index.html').includes('./app.js?v=0.2.0'));
console.log('OK: manifesto, 6 módulos, scripts inline, assets relativos e namespace.');
