// Empacotamento sem rede: preserva o código da main v0.3.0 e remove dependências locais externas.
import assert from 'node:assert/strict';
import {cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {Script} from 'node:vm';

const OUTPUT = 'dist-v030-geotab';
const pages = [
  ['index.html', 'restore030dashboard.html'],
  ['mileage/index.html', 'restore030mileage.html'],
  ['incidents/index.html', 'restore030incidents.html'],
  ['health/index.html', 'restore030health.html'],
  ['exceptions/index.html', 'restore030exceptions.html'],
  ['trips/index.html', 'restore030trips.html'],
];
const manifest = JSON.parse(readFileSync('addin-config.v030-local-files.json', 'utf8'));
assert.equal(manifest.name, 'fleetTelemetryManager');
assert.equal(manifest.items.length, 6);
assert.deepEqual(manifest.items.map(item => item.url), pages.map(p => p[1]));
assert.equal(new Set(manifest.items.map(i => i.url)).size, 6);
const iconSvg = readFileSync('icon.svg', 'utf8');
const iconData = 'data:image/svg+xml,' + encodeURIComponent(iconSvg);

const isLocal = url => /^\.\.?\//.test(url);
const localPath = (page, url) => {
  const path = resolve(dirname(page), url.split('?')[0].split('#')[0]);
  assert.ok(path.startsWith(resolve('.') + '/'), 'Asset fora do repositório: ' + url);
  assert.ok(existsSync(path), 'Asset ausente: ' + page + ' -> ' + url);
  return path;
};
const attribute = (tag, key) => {
  const m = tag.match(new RegExp('\\b' + key + '\\s*=\\s*(["\x27])([\\s\\S]*?)\\1', 'i'));
  return m ? m[2] : '';
};

rmSync(OUTPUT, {recursive: true, force: true});
mkdirSync(join(OUTPUT, 'files', 'translations'), {recursive: true});
const records = [];
for (const [source, target] of pages) {
  let html = readFileSync(source, 'utf8');
  const cut = html.search(/<\/head\s*>/i);
  assert.ok(cut > 0, 'Página sem </head>: ' + source);
  let head = html.slice(0, cut);
  let tail = html.slice(cut);
  const scripts = [];
  const bundled = [];
  // Só modifica o HEAD verdadeiro. Templates HTML dentro do JavaScript permanecem intactos.
  head = head.replace(/<link\b[^>]*>/gi, tag => {
    const url = attribute(tag, 'href');
    const rel = attribute(tag, 'rel');
    if (!/stylesheet/i.test(rel) || !isLocal(url)) return tag;
    const path = localPath(source, url);
    assert.equal(extname(path), '.css');
    const css = readFileSync(path, 'utf8').replace(/<\/style/gi, '<\\/style');
    bundled.push(path);
    const media = attribute(tag, 'media');
    return '<style' + (media ? ' media="' + media + '"' : '') + '>\n' + css + '\n</style>';
  });
  head = head.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, tag => {
    const url = attribute(tag, 'src');
    if (!isLocal(url)) return tag;
    const path = localPath(source, url);
    assert.equal(extname(path), '.js');
    const code = readFileSync(path, 'utf8');
    new Script(code, {filename: path});
    bundled.push(path);
    scripts.push('\n/* Embedded source: ' + path.replace(/^.*\//, '') + ' */\n' + code);
    return '';
  });
  if (scripts.length) {
    // Um único script em ordem de dependência, sem defer ou requisições CORS para arquivos JS locais.
    const code = scripts.join('\n;\n').replace(/<\/script/gi, '<\\/script');
    head += '\n<script>\n' + code + '\n</script>\n';
  }
  html = head + tail;
  // O ícone dentro do HTML não depende mais do caminho relativo hospedado.
  html = html.replace(/(<img\b[^>]*\bsrc=)(["'])(?:\.\.\/|\.\/)icon\.svg\2/gi, (_, first, quote) => first + quote + iconData + quote);
  assert.ok(html.includes('geotab.addin.fleetTelemetryManager'), 'Namespace ausente: ' + target);
  assert.ok(!/<script[^>]*\bsrc=["']\.\.?\//i.test(html.slice(0, html.search(/<\/head\s*>/i))), 'JS local ainda externo: ' + target);
  assert.ok(!/<link[^>]*\bhref=["']\.\.?\//i.test(html.slice(0, html.search(/<\/head\s*>/i))), 'CSS local ainda externo: ' + target);
  assert.ok(html.length > readFileSync(source, 'utf8').length, 'Pacote não embutiu assets: ' + target);
  writeFileSync(join(OUTPUT, 'files', target), html);
  records.push({source, target, bytes: Buffer.byteLength(html), bundled: bundled.length});
}
cpSync('icon.svg', join(OUTPUT, 'files', 'icon.svg'));
for (const lang of ['en', 'pt-BR']) {
  const file = 'translations/' + lang + '.json';
  assert.ok(existsSync(file));
  cpSync(file, join(OUTPUT, 'files', 'translations', lang + '.json'));
}
writeFileSync(join(OUTPUT, 'configuration.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(OUTPUT, 'LEIA-ME.txt'), [
  'Fleet Telemetry Manager - recuperação do código v0.3.0 (manifesto 0.3.1)',
  'Este pacote NÃO cria outro Add-In; use somente na instalação fleetTelemetryManager existente.',
  'Preserva os seis módulos, filtros, cálculos, relatórios e PDF do commit de origem.',
  'Todos os arquivos CSS e JS locais foram incorporados nos HTMLs.',
  '',
  '1. Faça backup do JSON e arquivos da instalação atual no MyGeotab.',
  '2. Abra Sistema > Configurações > Add-Ins e EDITE fleetTelemetryManager existente.',
  '3. Aba Files: envie os seis restore030*.html da pasta files/ e icon.svg.',
  '4. Envie translations/en.json e translations/pt-BR.json mantendo essa estrutura, se suportada.',
  '5. Confirme os nomes individuais na aba Files (ZIP não significa arquivos importados).',
  '6. Aba Configuration: cole o conteúdo integral de configuration.json e salve.',
  '7. Recarregue MyGeotab e teste primeiro Quilometragem e o Fleet Telemetry Manager.',
  '8. Se falhar, examine Console e Network, sem divulgar tokens, cookies ou credenciais.',
  '',
  'Sem Vercel, GitHub Pages, CORS externo ou cache de URL da versão antiga para carregar os HTMLs.',
  'Leaflet externo (CDN unpkg) continua necessário nos módulos com mapa.',
  'Testes automatizados não substituem teste autenticado de API com permissões reais.',
  '', 
].join('\n'));
for (const item of manifest.items) assert.ok(existsSync(join(OUTPUT, 'files', item.url)));
assert.ok(manifest.items.every(i => !/^https?:/.test(i.url)));
console.log('OK: 6 páginas Geotab standalone geradas sem código externo local.');
console.table(records);
