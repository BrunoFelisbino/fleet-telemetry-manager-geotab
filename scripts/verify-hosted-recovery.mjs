import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Script } from 'node:vm';

// This is an alternative to the manual Files upload, not a replacement for v0.4.9.
const manifest = JSON.parse(readFileSync('addin-config.restore-hosted.json', 'utf8'));
const host = 'https://ftmbrunog2026.vercel.app';
const pages = ['index.html', 'mileage/index.html', 'incidents/index.html', 'health/index.html', 'exceptions/index.html', 'trips/index.html'];

assert.equal(manifest.name, 'fleetTelemetryManager');
assert.equal(manifest.version, '0.4.10');
assert.equal(manifest.items.length, pages.length);
assert.deepEqual(manifest.files, {}, 'External hosting should not depend on MyGeotab Files tab');
assert.equal(new Set(manifest.items.map(item => item.url)).size, pages.length);

for (let i = 0; i < pages.length; i++) {
  const page = pages[i];
  const item = manifest.items[i];
  const expectedUrl = host + '/' + page + '?v=0.4.10';
  assert.equal(item.url, expectedUrl, page + ' URL mismatch');
  assert.equal(item.path, 'ActivityLink/');
  assert.equal(item.category, 'AddIns');
  assert.equal(item.svgIcon, host + '/icon.svg');
  assert.ok(item.menuName.en && item.menuName['pt-BR']);
  assert.ok(!/[-@#]/.test(new URL(item.url).hostname + new URL(item.url).pathname), 'Invalid Geotab URL character in ' + page);
  assert.ok(existsSync(page), 'Missing hosted page ' + page);
  const html = readFileSync(page, 'utf8');
  assert.ok(html.length > 25000, 'Full page is missing: ' + page);
  assert.ok(!html.includes('TESTE OK: Add-In carregado e initialize executado'), 'Stale diagnostic page: ' + page);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, 'MyGeotab expects one inline bootstrap in ' + page);
  assert.match(scripts[0][1], /geotab\.addin\.fleetTelemetryManager/);
  new Script(scripts[0][1], { filename: page });
}
console.log('OK: six hosted complete MyGeotab pages with HTTPS, distinct URLs and working JavaScript syntax.');
