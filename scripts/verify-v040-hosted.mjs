import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { Script } from "node:vm";

const host = "https://ftmbrunog2026.vercel.app";
const files = ["dashboard", "mileage", "incidents", "health", "exceptions", "trips"];
const manifest = JSON.parse(readFileSync("addin-config.v040-recovery.json", "utf8"));
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
assert.equal(manifest.name, "fleetTelemetryManager");
assert.equal(manifest.version, "0.4.13");
assert.deepEqual(manifest.files, {});
assert.equal(manifest.items.length, files.length);
const unique = new Set(manifest.items.map(item => item.url));
assert.equal(unique.size, files.length);
const headers = vercel.headers.find(entry => entry.source === "/(.*)")?.headers;
assert.ok(headers && headers.some(h => h.key.toLowerCase() === "access-control-allow-origin" && h.value === "*"), "CORS header is missing");

for (let i = 0; i < files.length; i++) {
  const filename = "restore040" + files[i] + ".html";
  const path = "geotab/" + filename;
  const html = readFileSync(path, "utf8");
  const item = manifest.items[i];
  assert.equal(item.url, host + "/" + path);
  assert.ok(!/[-@#?]/.test(new URL(item.url).pathname + new URL(item.url).hostname), "Geotab URL contains invalid character");
  assert.equal(item.path, "ActivityLink/");
  assert.equal(item.category, "AddIns");
  assert.equal(item.svgIcon, host + "/icon.svg");
  assert.ok(item.menuName.en && item.menuName["pt-BR"]);
  assert.ok(html.length > 25000, "Full original module missing: " + path);
  assert.ok(html.includes("geotab.addin.fleetTelemetryManager"), "Missing Geotab namespace in " + path);
  assert.ok(html.includes("[Fleet TM v0.4.0 restaurado]"), "Missing recovery runtime marker");
  assert.ok(!html.includes("TESTE OK: Add-In carregado"), "Diagnostic placeholder leaked");
  assert.ok(!/<(?:script|link|img)\b[^>]*(?:src|href)\s*=\s*["']\.\.?\//i.test(html), "MyGeotab would resolve a relative asset incorrectly: " + path);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const inline = scripts.filter(x => !/\bsrc=/.test(x[1]));
  assert.equal(inline.length, 1, "Expected one inline bootstrap in " + path);
  new Script(inline[0][2], { filename: path });
  const external = scripts.filter(x => /\bsrc=/.test(x[1]));
  assert.ok(external.length <= 1, "Unexpected external scripts in " + path);
  assert.ok(external.every(x => /unpkg\.com\/leaflet/.test(x[1])), "Only optional Leaflet CDN is allowed");
  for (const lang of ["pt-BR", "en"]) assert.ok(existsSync("geotab/translations/" + lang + ".json"), "Missing translation");
  console.log("OK: " + path + " (" + html.length + " bytes)");
}
console.log("PASS: pristine v0.4.0 sources packaged with same-origin resources, CORS, six distinct Add-In URLs.");
