import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {Script} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const manifest=JSON.parse(read('addin-config.json'));
assert.equal(manifest.name,'fleetTelemetryManager');
assert.equal(manifest.version,'0.4.1');
const preview=JSON.parse(read('addin-config.preview.json'));
assert.equal(preview.version,'0.4.1');
assert.equal(preview.items.length,6);
for(const item of [...manifest.items,...preview.items])assert.ok(item.url.includes('?v=0.4.1'));
for(const item of preview.items)assert.ok(item.url.startsWith('https://fleet-telemetry-manager-geotab.vercel.app/'));
assert.equal(manifest.isSigned,false);
assert.equal(manifest.items.length,6);
for(const item of manifest.items){assert.ok(item.url.startsWith('https://'));assert.ok(item.svgIcon.startsWith('https://'));}
const paths=['index.html','assets/app.css','assets/app.js','mileage/index.html','mileage/model.js','mileage/chart.js','mileage/filters.js','mileage/pdf.js','mileage/app.js','mileage/style.css','incidents/model.js','incidents/storage.js','incidents/app.js','incidents/style.css','incidents/index.html','print-options.js','health/index.html','health-pdf.js','exceptions/index.html','exceptions/audit.css','exceptions/audit.js','exceptions/pdf.js','trips/index.html','reports/premium.css','icon.svg'];
for(const p of paths)assert.ok(existsSync(p),'Arquivo ausente: '+p);
for(const p of paths.filter(x=>x.endsWith('.js')))new Script(read(p),{filename:p});
for(const p of paths.filter(x=>x.endsWith('.html'))){
  const page=read(p);
  const scripts=[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for(const m of scripts)new Script(m[1],{filename:p});
  assert.ok(!/(?:src|href)="\.\.?\//.test(page),'Referência relativa inválida para MyGeotab: '+p);
  for(const m of page.matchAll(/(?:src|href)="(https:\/\/fleet-telemetry-manager-geotab\.vercel\.app\/[^"]+)"/g)){
    const asset=m[1].split('?')[0].replace('https://fleet-telemetry-manager-geotab.vercel.app/','');
    assert.ok(existsSync(asset),'Recurso absoluto não encontrado: '+p+' -> '+m[1]);
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
assert.ok(read('mileage/index.html').includes('./filters.js?v=0.4.1'));
assert.ok(read('mileage/filters.js').includes('selectedGroups')&&read('mileage/filters.js').includes('selectedVehicles'));
assert.ok(read('mileage/index.html').includes('id="pdfBtn"'));
assert.ok(read('mileage/index.html').includes('id="trendChart"'));
assert.ok(read('mileage/index.html').includes('./chart.js?v=0.4.1'));
assert.ok(read('mileage/index.html').includes('./app.js?v=0.4.1'));
assert.ok(read('mileage/index.html').includes('./model.js?v=0.4.1'));
assert.ok(read('mileage/index.html').includes('id="groupFocusStatus"'));
assert.ok(read('mileage/index.html').includes('./pdf.js?v=0.4.1'));
assert.ok(read('incidents/app.js').includes('geotab.addin.fleetTelemetryManager'));
assert.ok(read('incidents/index.html').includes('./app.js?v=0.4.1'));
console.log('OK: manifesto v0.4.1, seis módulos, scripts inline, URLs públicas e namespace.');
