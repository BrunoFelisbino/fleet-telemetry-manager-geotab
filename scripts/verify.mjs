import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {Script} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const manifest=JSON.parse(read('addin-config.json'));
assert.equal(manifest.name,'fleetTelemetryManager');
assert.equal(manifest.version,'0.4.8');
const preview=JSON.parse(read('addin-config.preview.json'));
assert.equal(preview.version,'0.4.4');
assert.equal(preview.items.length,6);
for(const item of preview.items)assert.ok(item.url.includes('?v=0.4.4'));
assert.deepEqual(manifest.files,{});
assert.ok(read('addin-config.json').length<5000,'Do not embed the six full pages in JSON');
assert.deepEqual(manifest.items.map(x=>x.url),['dashboard.html','mileage.html','incidents.html','health.html','exceptions.html','trips.html']);
for(const item of preview.items)assert.ok(item.url.startsWith('https://ftmbrunog2026.vercel.app/'));
assert.equal(manifest.isSigned,false);
assert.equal(manifest.items.length,6);
for(const [source,configuration] of [['main',manifest],['preview',preview]]){
  assert.equal(new Set(configuration.items.map(item=>item.url)).size,6,source+' URLs duplicadas');
  assert.equal(new Set(configuration.items.map(item=>item.menuName['pt-BR'])).size,6,source+' rótulos duplicados');
  for(const item of configuration.items){
    assert.equal(item.category,'AddIns',source+' sem categoria na navegação moderna');
    assert.equal(item.path,'ActivityLink/',source+' sem caminho no menu clássico');
    assert.ok(item.menuName.en&&item.menuName['pt-BR'],'Nome do menu ausente');
  }
}

for(const item of manifest.items){assert.ok(item.url.endsWith('.html'));assert.ok(!item.url.includes('://'),'Local Files URL expected');}
const paths=['index.html','assets/app.css','assets/app.js','mileage/index.html','mileage/model.js','mileage/chart.js','mileage/filters.js','mileage/pdf.js','mileage/app.js','mileage/style.css','incidents/model.js','incidents/storage.js','incidents/app.js','incidents/style.css','incidents/index.html','print-options.js','health/index.html','health-pdf.js','exceptions/index.html','exceptions/audit.css','exceptions/audit.js','exceptions/pdf.js','trips/index.html','reports/premium.css','icon.svg'];
for(const p of paths)assert.ok(existsSync(p),'Arquivo ausente: '+p);
for(const p of paths.filter(x=>x.endsWith('.js')))new Script(read(p),{filename:p});
for(const p of paths.filter(x=>x.endsWith('.html'))){
  const page=read(p);
  const scripts=[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for(const m of scripts)new Script(m[1],{filename:p});
  assert.ok(!/(?:src|href)="\.\.?\//.test(page),'Referência relativa inválida para MyGeotab: '+p);
  for(const m of page.matchAll(/(?:src|href)="(https:\/\/fleet-telemetry-manager-geotab\.vercel\.app\/[^"]+)"/g)){
    const asset=m[1].split('?')[0].replace('https://ftmbrunog2026.vercel.app/','');
    assert.ok(existsSync(asset),'Recurso absoluto não encontrado: '+p+' -> '+m[1]);
  }
}
for(const p of ['health/index.html','exceptions/index.html','trips/index.html'])assert.ok(read(p).includes('geotab.addin.fleetTelemetryManager'),'Namespace incorreto: '+p);
const main=read('assets/app.js');
assert.ok(main.includes('idlingDuration')&&main.includes('isDeviceCommunicating'));
assert.ok(!main.includes('localStorage'));
assert.ok(manifest.items.some(x=>x.url==='incidents.html'));
assert.ok(manifest.items.some(x=>x.url==='mileage.html'));
assert.ok(read('mileage/app.js').includes('geotab.addin.fleetTelemetryManager'));
assert.ok(read('mileage/index.html').includes('id="groupSearch"')&&read('mileage/index.html').includes('id="vehicleSearch"'));


for(const path of ['index.html','mileage/index.html','incidents/index.html','health/index.html','exceptions/index.html','trips/index.html']){
  const html=read(path);
  const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(inline.length,1,path+' must have exactly one inline boot script');
  assert.ok(html.includes('geotab.addin.fleetTelemetryManager'),'Missing Geotab add-in API: '+path);
  assert.ok(!/<script defer/.test(html),'Deferred JavaScript can be skipped during page injection');
  new Script(inline[0][1],{filename:path});
}
assert.ok(read('mileage/index.html').includes('FleetMileageDailyChart'));
assert.ok(read('mileage/index.html').includes('id="groupFocusStatus"'));
console.log('OK: v0.4.8, seis páginas reais, manifesto Files, script único e namespace.');
