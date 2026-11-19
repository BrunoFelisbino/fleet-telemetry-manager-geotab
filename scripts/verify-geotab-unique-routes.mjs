import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Script } from 'node:vm';
const manifest = JSON.parse(readFileSync('addin-config.restore-hosted-routes.json', 'utf8'));
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const host = 'https://ftmbrunog2026.vercel.app';
const routes = [
  ['dashboard.html', 'index.html'],
  ['mileage.html', 'mileage/index.html'],
  ['incidents.html', 'incidents/index.html'],
  ['health.html', 'health/index.html'],
  ['exceptions.html', 'exceptions/index.html'],
  ['trips.html', 'trips/index.html'],
];
assert.equal(manifest.name, 'fleetTelemetryManager');
assert.equal(manifest.version, '0.4.12');
assert.equal(manifest.items.length, 6);
assert.deepEqual(manifest.files, {});
assert.equal(new Set(manifest.items.map(item=>item.url)).size, 6);
assert.equal(new Set(routes.map(([alias])=>alias)).size, 6);
for(let i=0;i<routes.length;i++){
  const [alias,target]=routes[i];
  const item=manifest.items[i];
  assert.equal(item.url,host+'/'+alias);
  assert.equal(item.category,'AddIns');
  assert.equal(item.path,'ActivityLink/');
  assert.equal(item.svgIcon,host+'/icon.svg');
  assert.ok(item.menuName.en && item.menuName['pt-BR']);
  assert.ok(!item.url.includes('?') && !item.url.includes('#'));
  const rule=vercel.rewrites?.find(x=>x.source==='/'+alias);
  assert.ok(rule,'Missing rewrite for '+alias);
  assert.equal(rule.destination,'/'+target);
  assert.ok(existsSync(target),'Missing real module source for '+alias);
  const html=readFileSync(target,'utf8');
  assert.ok(html.length>25000,'Incomplete real UI '+target);
  assert.ok(!html.includes('TESTE OK: Add-In carregado e initialize executado'));
  assert.match(html,/geotab\.addin\.fleetTelemetryManager/);
  const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length,1,'Missing inline bootstrap in '+target);
  new Script(scripts[0][1],{filename:target});
}
const cors=vercel.headers.find(x=>x.source==='/(.*)').headers.find(x=>x.key==='Access-Control-Allow-Origin');
assert.equal(cors.value,'*');
console.log('OK: six unique hosted Geotab page basenames with matching Vercel rewrites, CORS and full UIs');
