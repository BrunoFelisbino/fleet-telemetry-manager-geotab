import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const context={console};context.globalThis=context;
runInNewContext(readFileSync('mileage/model.js','utf8'),context);
const M=context.FleetMileageModel;
const now=new Date(2026,10,19,12,0);
const current=M.range('current','','',now);
assert.equal(current.from.getMonth(),10);
assert.equal(current.from.getDate(),1);
assert.equal(current.to.getDate(),19);
const previous=M.range('previous','','',now);
assert.equal(previous.from.getMonth(),9);
assert.equal(previous.from.getDate(),1);
assert.equal(previous.to.getMonth(),9);
assert.equal(previous.to.getDate(),31);
assert.ok((previous.to-previous.from)/86400000>30.99);
const custom=M.range('custom','2026-11-02T08:00','2026-11-08T17:00',now);
assert.equal(custom.from.getDate(),2);
assert.equal(custom.to.getDate(),8);
assert.throws(()=>M.range('custom','2026-11-09T08:00','2026-11-08T17:00',now));
assert.throws(()=>M.range('custom','2024-01-01T00:00','2026-11-08T17:00',now));

const groups=[
 {id:'parent',name:'Operação A',children:[{id:'child'}]},
 {id:'child',name:'Garagem 1',children:[]},
 {id:'other',name:'Operação B',children:[]}
];
const cars=[
 {id:'v1',name:'AAA-0001',licensePlate:'AAA0001',groups:[{id:'child'}]},
 {id:'v2',name:'BBB-0002',licensePlate:'BBB0002',groups:[{id:'other'}]},
 {id:'v3',name:'CCC-0003',groups:[{id:'child'},{id:'other'}]},
 {id:'v4',name:'DDD-0004',groups:[]},
 {id:'v5',name:'BAIXADO',activeTo:'2026-10-01T00:00:00.000Z',groups:[{id:'child'}]}
];
assert.equal(M.devicesInScope(cars,groups,'parent','').length,2);
assert.equal(M.devicesInScope(cars,groups,'parent','v1').length,1);
assert.equal(M.devicesInScope(cars,groups,'','').length,4);
assert.ok(M.groupMembers('parent',groups).has('child'));

const window=M.range('custom','2026-11-01T00:00','2026-11-19T12:00',now);
const t1={id:'t1',start:'2026-11-05T09:00:00.000Z',stop:'2026-11-05T10:00:00.000Z',distance:11,odometer:111000};
const t2={id:'t2',start:'2026-11-06T09:00:00.000Z',stop:'2026-11-06T10:00:00.000Z',distance:12,odometer:123000};
const summary=M.summarizeVehicle(cars[0],[t1,t1,t2],window);
assert.equal(summary.km,23,'Desduplicar viagem por id');
assert.equal(summary.tripCount,2);
assert.equal(summary.odoStart,100);
assert.equal(summary.odoEnd,123);
assert.equal(summary.boundaryTrips,0);
const cross=M.summarizeVehicle(cars[1],[{...t1,id:'cross',start:'2026-10-31T23:45:00.000Z',stop:'2026-11-01T00:30:00.000Z'}],window);
assert.equal(cross.boundaryTrips,1);
const missing=M.summarizeVehicle(cars[2],[{...t1,odometer:null}],window);
assert.equal(missing.odoStart,null);
const empty=M.summarizeVehicle(cars[3],[],window);
assert.equal(empty.km,0);
const data=new Map([['v1',summary],['v2',M.summarizeVehicle(cars[1],[{...t1,id:'alt',distance:7,odometer:107000}],window)],['v3',missing],['v4',empty]]);
const fleet=M.summarizeFleet(cars.slice(0,4),data,groups,'');
assert.equal(fleet.km,41);
assert.equal(fleet.vehicles,4);
assert.equal(fleet.stopped,1);
assert.equal(fleet.average,10.25);
assert.equal(fleet.groupsRows.reduce((s,g)=>s+g.vehicles,0),4,'Nunca contar o mesmo veículo em dois grupos');
assert.equal(fleet.groupsRows.find(x=>x.name==='Múltiplos grupos').vehicles,1);
console.log('OK: mês calendário, filtro hierárquico, viagens desduplicadas, odômetro e agregação sem dupla contagem.');
