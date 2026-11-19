#!/usr/bin/env node
/*
 * Cria pacote para a aba Files do MyGeotab.
 * O manifesto permanece pequeno, com seis URLs locais.
 * Cada HTML preserva o visual e a lógica funcional de sua página original.
 */
import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {Script} from 'node:vm';

const output='dist-geotab';
const version='0.4.9';
const routes=[
  ['index.html','dashboard049.html','Fleet Telemetry Manager','Fleet Telemetry Manager'],
  ['mileage/index.html','mileage049.html','Fleet Mileage','Quilometragem da Frota'],
  ['incidents/index.html','incidents049.html','Incidents & SLA','Ocorrências e SLA'],
  ['health/index.html','health049.html','Fleet Health Score','Fleet Health Score'],
  ['exceptions/index.html','exceptions049.html','Fleet Exception 360','Fleet Exception 360'],
  ['trips/index.html','trips049.html','Fleet Trip 360','Fleet Trip 360']
];

rmSync(output,{recursive:true,force:true});
mkdirSync(join(output,'pages'),{recursive:true});

const manifest={
  name:'fleetTelemetryManager',
  supportEmail:'poze1988@gmail.com',
  version,
  items:[],
  files:{}
};
for(const [source,filename,en,pt] of routes){
  assert.ok(existsSync(source),'Missing source '+source);
  let html=readFileSync(source,'utf8');
  const js=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(js.length,1,source+' should have one real inlined main script');
  assert.match(js[0][1],/geotab\.addin\.fleetTelemetryManager/);
  new Script(js[0][1],{filename:source});
  // Mantém o CSS, os filtros, os KPIs, os mapas e os PDFs originais.
  // Apenas a identificação de versão e o texto antigo de suporte mudam.
  html=html.replace(/\[Fleet TM v0\.4\.4\]/g,'[Fleet TM v'+version+']');
  html=html.replace('Verifique o manifesto v0.4.1, a rede e as permissões do Add-In.','Verifique os arquivos carregados na aba Files do Add-In.');
  html=html.replaceAll('https://ftmbrunog2026.vercel.app/icon.svg','icon.svg');
  writeFileSync(join(output,'pages',filename),html);
  manifest.items.push({
    url:filename,
    path:'ActivityLink/',
    menuName:{en,'pt-BR':pt},
    category:'AddIns'
  });
}

cpSync('icon.svg',join(output,'pages','icon.svg'));
mkdirSync(join(output,'pages','translations'),{recursive:true});
const langPt=Object.fromEntries(routes.map(r=>[r[3],r[3]]));
const langEn=Object.fromEntries(routes.map(r=>[r[2],r[2]]));
writeFileSync(join(output,'pages','translations','pt-BR.json'),JSON.stringify(langPt,null,2)+'\n');
writeFileSync(join(output,'pages','translations','en.json'),JSON.stringify(langEn,null,2)+'\n');
writeFileSync(join(output,'configuration.json'),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(join(output,'LEIA-ME.txt'),[
  'FLEET TELEMETRY MANAGER v'+version,
  'SEIS MODULOS COMPLETOS, UM UNICO ADD-IN',
  '',
  '1. Abra MyGeotab > Configuracoes do Sistema > Add-Ins.',
  '2. Edite o Fleet Telemetry Manager ja instalado (nao crie duplicado).',
  '3. Na aba Files, envie OS ARQUIVOS EXTRAIDOS da pasta pages (6 HTMLs, icon.svg e translations/). NAO envie apenas o ZIP.',
  '4. Na aba Configuration, substitua pelo conteudo de configuration.json.',
  '5. Confirme que dashboard049.html, mileage049.html, incidents049.html, health049.html, exceptions049.html e trips049.html aparecem na aba Files.\n  Salve e recarregue Ctrl+Shift+R.',
  '',
  'A instalacao nao depende da Vercel para servir os HTMLs.',
  'Os mapas usam Leaflet CDN (unpkg.com), que precisa ser acessivel.',
  'Nao declare a instalacao homologada sem teste na conta real.'
].join('\n')+'\n');

const check=JSON.parse(readFileSync(join(output,'configuration.json'),'utf8'));
assert.equal(check.items.length,6);
assert.deepEqual(check.items.map(x=>x.url),routes.map(r=>r[1]));
assert.equal(new Set(check.items.map(x=>x.url)).size,6);
assert.deepEqual(check.files,{});
for(const lang of ['pt-BR','en']) assert.ok(existsSync(join(output,'pages','translations',lang+'.json')));
for(const item of check.items)assert.ok(existsSync(join(output,'pages',item.url)));
console.log('OK: manifest '+version+', six REAL HTML pages, CSS, JS, icons and portable local files.');
