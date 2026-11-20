import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';
const read=path=>readFileSync(path,'utf8');
const modelSource=read('mileage/model.js');
const appSource=read('mileage/app.js');
const markup=read('mileage/index.html');
const hosted=read('mileage/mileage030.html');
const style=read('mileage/style.css');
new Script(appSource,{filename:'mileage/app.js'});
assert.equal(markup,hosted,'Hosted recovery route must serve the same updated page.');
for(const id of ['groupCardChoices','groupCardCount','groupCardKm','groupCardVehicles','groupCardFilterHint','trendChart','groupCsv','groupRows']){
  assert.ok(markup.includes('id="'+id+'"'),'Missing UI '+id);
}
assert.ok(!markup.includes('id="groupCardSearch"'),'No text input: second filter must be clickable.');
assert.ok(markup.includes('./app.js?v=0.3.5')&&markup.includes('./style.css?v=0.3.5')&&markup.includes('./model.js?v=0.3.5'));
assert.ok(style.includes('.km-line')&&style.includes('.trend-point-tooltip')&&style.includes('.group-focus-chip'));
assert.ok(appSource.includes("visibleGroupRows().map(x=>[x.name,x.vehicles,x.trips,x.km.toFixed(2)])"),'CSV must use current focus only.');
assert.ok(appSource.includes("window.FleetMileagePdf.save({...last"),'PDF generation must remain intact.');
assert.ok(appSource.includes("focusedGroupId=button.dataset.focusGroup||null;"),'Click must focus one group without changing primary selection.');
assert.ok(!appSource.includes("filters.groups().splice"),'Secondary filter must never mutate the main selection.');
assert.ok(appSource.includes('render(summary,period,ds,full);'),'Real API results must be retained for secondary focus.');
assert.ok(appSource.includes('period,ds,map);'),'Demo results must support the secondary focus.');
assert.ok(appSource.includes('showTrendPoint(Number(dot.dataset.trendIndex))'),'Point click and keyboard must reveal values.');

const modelContext={};
runInNewContext(modelSource,modelContext);
const Model=modelContext.FleetMileageModel;
const groups=[
  {id:'COMURG003',name:'COMURG - 003/2026',children:[]},
  {id:'COMURG001',name:'COMURG - 001/2026',children:[]},
  {id:'SEMAD',name:'SEMAD - 006/2026',children:[]}
];
const devices=[
  {id:'A',name:'A',groups:[{id:'COMURG003'}]},
  {id:'B',name:'B',groups:[{id:'COMURG001'}]},
  {id:'C',name:'C',groups:[{id:'COMURG003'},{id:'COMURG001'}]},
  {id:'D',name:'D',groups:[{id:'SEMAD'}]}
];
const values=[100,80,30,40];
const results=new Map(devices.map((d,i)=>[d.id,{
  name:d.name,plate:'TEST'+i,km:values[i],tripCount:1,invalidCount:0,
  odoStart:1000,odoEnd:1000+values[i],boundaryTrips:0,
  dailyKm:{'2026-11-20':values[i]}
}]));
const all=Model.summarizeFleet(devices,results,groups,['COMURG003','COMURG001','SEMAD']);
assert.equal(all.km,250,'Global km counted once per vehicle');
assert.equal(all.vehicles,4);
assert.ok(all.groupsRows.some(r=>r.name==='Múltiplos grupos selecionados'&&r.km===30),'Global overlap bucket preserved.');
const focus003=Model.summarizeFocusedGroup(devices,results,groups,'COMURG003');
const focus001=Model.summarizeFocusedGroup(devices,results,groups,'COMURG001');
const focusSemad=Model.summarizeFocusedGroup(devices,results,groups,'SEMAD');
assert.equal(focus003.km,130,'003 view includes shared vehicle only once');
assert.equal(focus003.vehicles,2);
assert.equal(focus003.groupsRows.length,1);
assert.equal(focus003.groupsRows[0].name,'COMURG - 003/2026');
assert.equal(focus001.km,110,'001 view includes shared vehicle only once');
assert.equal(focus001.vehicles,2);
assert.equal(focusSemad.km,40);
assert.equal(focusSemad.vehicles,1);
assert.equal(all.km,250,'Clicking a focus does not mutate original summary');
assert.equal(Model.summarizeFocusedGroup(devices,results,groups,null).km,250);
assert.equal(Model.summarizeFocusedGroup(devices,results,groups,'UNKNOWN').km,0);

const safe=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmt=(n,d=1)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const lineStart=appSource.indexOf('function renderLineTrend(');
const next=appSource.indexOf('function focusedGroupSummary(',lineStart);
assert.ok(lineStart>=0&&next>lineStart);
const renderer=new Function('safe','fmt',appSource.slice(lineStart,next)+';return renderLineTrend')(safe,fmt);
const svg=renderer([{label:'01/11',km:5},{label:'03/11',km:33496.4},{label:'05/11',km:0}]);
assert.ok(svg.includes('<svg')&&svg.includes('class="km-line"')&&svg.includes('id="trendPointTooltip"'));
assert.equal((svg.match(/class="km-hit"/g)||[]).length,3,'Every plotted point has a clickable hit target.');
assert.ok(svg.includes('data-trend-index="1"')&&svg.includes('role="button" tabindex="0"'));
assert.ok(svg.includes('33.496,4 km'));
assert.ok(!svg.includes('aria-hidden="true"'),'Interactive graph cannot be hidden from keyboard/screen readers');
assert.ok(!svg.includes('NaN')&&!svg.includes('Infinity'));
assert.ok(renderer([]).includes('Não há dados'));
assert.ok(renderer([{label:'06/11',km:0}]).includes('class="km-hit"'));

const showStart=appSource.indexOf('function showTrendPoint(');
const showEnd=appSource.indexOf('function renderVisualDashboard(',showStart);
assert.ok(showStart>=0&&showEnd>showStart);
const tooltip={hidden:true,innerHTML:'',style:{},offsetWidth:130,offsetHeight:48};
const selected=[];
const dot={classList:{toggle:(name,yes)=>selected.push([name,yes])}};
const hit={getBoundingClientRect:()=>({left:200,top:160,width:24,height:24})};
const container={
  getBoundingClientRect:()=>({left:0,top:0,width:600,height:200}),
  querySelector:selector=>selector.includes('km-hit')?hit:null,
  querySelectorAll:()=>[dot]
};
const fake$=name=>name==='trendChart'?container:name==='trendPointTooltip'?tooltip:null;
const show=new Function('last','$','safe','fmt',appSource.slice(showStart,showEnd)+';return showTrendPoint')({trend:[{label:'03/11',km:33496.4}]},fake$,safe,fmt);
show(0);
assert.equal(tooltip.hidden,false);
assert.ok(tooltip.innerHTML.includes('33.496,4 km'));
assert.ok(tooltip.style.left.endsWith('px')&&tooltip.style.top.endsWith('px'));
assert.ok(selected.some(([name,value])=>name==='is-active'&&value));
console.log('OK: click-to-show KM, keyboard tooltip, secondary fleet focus, shared vehicles, CSV/PDF regressions, hosted route.');
