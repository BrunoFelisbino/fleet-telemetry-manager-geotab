import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const ctx={console,Date,Uint8Array};ctx.globalThis=ctx;
runInNewContext(readFileSync('mileage/model.js','utf8'),ctx,{filename:'mileage/model.js'});
runInNewContext(readFileSync('mileage/pdf.js','utf8'),ctx,{filename:'mileage/pdf.js'});
const M=ctx.FleetMileageModel;
const groups=[{id:'north',name:'Operação Norte',children:[{id:'north-a'}]},
  {id:'north-a',name:'Garagem Norte',children:[]},
  {id:'south',name:'Operação Sul',children:[]}];
const vehicle=(id,groupIds)=>({id,name:'VEÍCULO '+id,groups:groupIds.map(id=>({id}))});
const ds=[vehicle('a',['north-a']),vehicle('b',['south']),vehicle('c',['north','south']),vehicle('d',['north-a'])];
const data=new Map([
 ['a',{deviceId:'a',name:'VEÍCULO a',plate:'AAA1111',groups:['north-a'],km:100,tripCount:2,invalidCount:0,odoStart:120,odoEnd:220,boundaryTrips:0,dailyKm:{'2026-11-01':30,'2026-11-02':70}}],
 ['b',{deviceId:'b',name:'VEÍCULO b',plate:'BBB2222',groups:['south'],km:60,tripCount:1,invalidCount:0,odoStart:100,odoEnd:160,boundaryTrips:0,dailyKm:{'2026-11-02':60}}],
 ['c',{deviceId:'c',name:'VEÍCULO c',plate:'CCC3333',groups:['north','south'],km:50,tripCount:1,invalidCount:0,odoStart:null,odoEnd:null,boundaryTrips:1,dailyKm:{'2026-11-01':50}}],
 ['d',{deviceId:'d',name:'VEÍCULO d',plate:'DDD4444',groups:['north-a'],km:0,tripCount:0,invalidCount:0,odoStart:null,odoEnd:null,boundaryTrips:0,dailyKm:{}}]
]);
const all=M.summarizeFleet(ds,data,groups,['north','south']);
assert.equal(all.vehicles,4);
assert.equal(all.km,210);
assert.equal(all.groupsRows.length,3);
assert.equal(all.groupsRows.reduce((n,g)=>n+g.km,0),210);
const north=M.focusSummary(all,'north');
assert.equal(north.km,100);
assert.equal(north.vehicles,2);
assert.equal(north.stopped,1);
assert.equal(north.trips,2);
assert.equal(north.average,50);
assert.equal(north.withOdometer,1);
assert.equal(north.vehiclesRows.length,2);
assert.deepEqual([...north.vehiclesRows].map(x=>x.deviceId).sort(),['a','d']);
assert.equal(north.groupsRows.length,1);
assert.equal(north.groupsRows[0].name,'Operação Norte');
assert.equal(north.groupsRows[0].km,100);
assert.equal(north.dailyRows.reduce((n,x)=>n+x.km,0),100);
assert.equal(north.dailyRows.find(x=>x.day==='2026-11-02').km,70);
const south=M.focusSummary(all,'south');
assert.equal(south.km,60);
assert.equal(south.vehicles,1);
assert.equal(south.vehiclesRows[0].deviceId,'b');
const multi=M.focusSummary(all,'multiple');
assert.equal(multi.km,50);
assert.equal(multi.vehicles,1);
assert.equal(multi.boundaryTrips,1);
assert.equal(multi.groupsRows[0].name,'Múltiplos grupos selecionados');
assert.equal(north.km+south.km+multi.km,all.km,'Focus splits full result without counting any device twice');
assert.equal(all.km,210,'Viewing groups must never mutate the original summary');
assert.equal(all.vehiclesRows.length,4,'All vehicles remain in memory for Show All');
assert.throws(()=>M.focusSummary(all,'unknown'),/Grupo não disponível/);
assert.throws(()=>M.focusSummary(null,'north'),/consulta completa/);
const period={from:new Date(2026,10,1),to:new Date(2026,10,3),label:'Mês atual'};
const daily=M.dailySeries(north.dailyRows,period);
assert.equal(daily.reduce((n,x)=>n+x.km,0),north.km);
const bytes=ctx.FleetMileagePdf.make({summary:north,period,trend:daily,groupNames:['Operação Norte'],vehicleNames:[],demo:true});
const body=Buffer.from(bytes).toString('latin1');
assert.ok(body.startsWith('%PDF-1.4'));
assert.ok(body.includes('Operação Norte'));
assert.ok(!body.includes('Operação Sul'));
const app=readFileSync('mileage/app.js','utf8');
assert.ok(app.includes('Model.focusSummary(all,chosen.groupId)'));
assert.ok(app.includes("last.groupFocus?[last.groupFocus.name]"));
assert.ok(app.includes("addEventListener('click',selectResultGroup)"));
assert.ok(app.includes("addEventListener('click',clearResultGroup)"));
const html=readFileSync('mileage/index.html','utf8');
assert.ok(html.includes('id="clearGroupFocus"'));
assert.ok(html.includes('id="groupFocusStatus"'));
const css=readFileSync('mileage/style.css','utf8');
assert.ok(css.includes('.group-action.is-dim'));
assert.ok(css.includes('.group-result-row.is-focused'));
console.log('OK: drill-down de grupos, totais, zero-km, evolução, navegação, PDF e isolamento de veículos.');
