import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const output='dist-v040-geotab';
const filenames=['restore040dashboard.html','restore040mileage.html','restore040incidents.html','restore040health.html','restore040exceptions.html','restore040trips.html'];
const manifest=JSON.parse(readFileSync('addin-config.v040-local-files.json','utf8'));
assert.deepEqual(manifest.items.map(x=>x.url),filenames);
assert.equal(manifest.name,'fleetTelemetryManager');
assert.equal(manifest.items.length,6);
rmSync(output,{recursive:true,force:true});
mkdirSync(join(output,'files','translations'),{recursive:true});
for (const name of filenames) {
 const from=join('geotab',name);
 assert.ok(existsSync(from),'Missing source '+from);
 const html=readFileSync(from,'utf8');
 assert.ok(html.includes('geotab.addin.fleetTelemetryManager'));
 assert.ok(html.length>25000);
 cpSync(from,join(output,'files',name));
}
cpSync('icon.svg',join(output,'files','icon.svg'));
for(const lang of ['en','pt-BR']) {
 const from=join('geotab','translations',lang+'.json');
 cpSync(from,join(output,'files','translations',lang+'.json'));
}
writeFileSync(join(output,'configuration.json'),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(join(output,'LEIA-ME.txt'),[
 'Fleet Telemetry Manager: recuperacao da base v0.4.0 (manifesto v0.4.13)',
 'Os seis modulos foram preparados a partir da v0.4.0, sem alterar as regras de negocio.',
 'Alternativa SEM CORS externo e SEM nova publicacao na Vercel.',
 '',
 '1. MyGeotab > Configuracoes do sistema > Add-Ins: edite o fleetTelemetryManager existente.',
 '2. Salve uma copia do JSON anterior e, se possivel, dos arquivos antigos.',
 '3. Aba Files: envie os seis HTMLs de files/, icon.svg e os dois arquivos em translations/.',
 '   Confira que restore040mileage.html, restore040dashboard.html, e translations/pt-BR.json estao realmente presentes.',
 '   Nao suponha que um ZIP foi extraido automaticamente pela interface; confirme os nomes.',
 '4. Aba Configuration: cole o conteudo de configuration.json.',
 '5. Salve, recarregue o navegador e teste o menu Quilometragem da Frota.',
 '6. Console: procure [Fleet TM v0.4.0 restaurado].',
 '',
 'Se houver 404 em /AddIns/fleetTelemetryManager/restore040mileage.html, faltou arquivo na aba Files.',
 'Se houver erro na API, capture a mensagem sem tokens ou dados privados.',
 'O GitHub Actions nao homologa a instalacao no MyGeotab.',
 ].join('\n')+'\n');
const check=JSON.parse(readFileSync(join(output,'configuration.json'),'utf8'));
assert.equal(check.items.length,6);
for(const item of check.items)assert.ok(existsSync(join(output,'files',item.url)));
console.log('OK: six v0.4.0 standalone pages and local Files manifest packaged.');
