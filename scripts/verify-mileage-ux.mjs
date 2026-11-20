import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const modelSource=read('mileage/model.js');
const appSource=read('mileage/app.js');
const markup=read('mileage/index.html');
const hosted=read('mileage/mileage030.html');
const style=read('mileage/style.css');
new Script(appSource,{filename:'mileage/app.js'});
assert.equal(markup,hosted,'The restored public route must match the main mileage page.');
for(const id of ['groupCardSearch','groupCardClear','groupCardCount','groupCardFilterHint','trendChart','groupCsv','groupRows']){
  assert.ok(markup.includes('id="'+id+'"'),'Missing UI: '+id);
}
assert.ok(markup.includes('./app.js?v=0.3.4')&&markup.includes('./style.css?v=0.3.4'));
assert.ok(style.includes('.km-line')&&style.includes('.km-point')&&style.includes('.group-card-tools'));
assert.ok(appSource.includes("visibleGroupRows().map(x=>[x.name,x.vehicles,x.trips,x.km.toFixed(2)])"),'CSV must reflect filtered table.');
assert.ok(appSource.includes("window.FleetMileagePdf.save({...last"),'Existing PDF generation must remain intact.');
const modelContext={};
runInNewContext(modelSource,modelContext);
const Model=modelContext.FleetMileageModel;
assert.ok(Model,'Mileage model export missing.');
const rows=[
  {name:'COMURG - 003/2026',km:210926.2,vehicles:90},
  {name:'COMURG - 001/2026',km:92028.2,vehicles:46},
  {name:'Múltiplos grupos',km:1000,vehicles:2},
  {name:'Serviços municipais',km:200,vehicles:1}
];
const names=q=>Array.from(Model.filterGroupRows(rows,q),r=>r.name);
assert.deepEqual(names('COMURG'),['COMURG - 003/2026','COMURG - 001/2026']);
assert.deepEqual(names('003/2026'),['COMURG - 003/2026']);
assert.deepEqual(names('servicos'),['Serviços municipais']);
assert.deepEqual(names('multiplos'),['Múltiplos grupos']);
assert.equal(names('nao-existe').length,0);
assert.equal(names('').length,4);
assert.equal(rows.length,4,'The filter must not modify the source rows.');
const from=appSource.indexOf('function renderLineTrend(');
const to=appSource.indexOf('function visibleGroupRows(',from);
assert.ok(from>=0&&to>from,'Line renderer missing.');
const helper=appSource.slice(from,to);
const safe=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmt=(n,d=1)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const renderLineTrend=new Function('safe','fmt',helper+';return renderLineTrend')(safe,fmt);
const svg=renderLineTrend([{label:'01/11',km:5},{label:'03/11',km:35000},{label:'05/11',km:0}]);
assert.ok(svg.includes('<svg')&&svg.includes('class="km-line"')&&svg.includes('class="km-area"'));
assert.equal((svg.match(/<circle /g)||[]).length,3,'Each trend bucket should expose a tooltip.');
assert.ok(svg.includes('35.000,0 km'),'Tooltip should use original values, not scaled axis numbers.');
assert.ok(svg.includes('01/11')&&svg.includes('05/11'));
assert.ok(!svg.includes('NaN')&&!svg.includes('Infinity'));
assert.ok(renderLineTrend([]).includes('Não há dados'));
assert.ok(renderLineTrend([{label:'06/11',km:0}]).includes('class="km-line"'));
console.log('OK: group-card search and CSV stay in sync, line SVG has labels/tooltips, hosted page matches original, PDF preserved.');
