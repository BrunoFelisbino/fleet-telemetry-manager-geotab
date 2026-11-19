import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const config=JSON.parse(readFileSync('addin-config.trip-api-v0.4.7.json','utf8'));
const files=['dashboard.html','mileage.html','incidents.html','health.html','exceptions.html','trips.html'];
assert.equal(config.version,'0.4.7');
assert.equal(config.items.length,6);
assert.equal(Object.keys(config.files).length,6);
assert.deepEqual(config.items.map(i=>i.url),files);
for(const file of files){
 const html=config.files[file],scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
 assert.equal(scripts.length,1,'Only one inline script in '+file);
 new Script(scripts[0][1],{filename:file});
}
const html=config.files['trips.html'];
assert.ok(html.includes('typeName:\x27Device\x27'),'Device API call');
assert.ok(html.includes('typeName:\x27Trip\x27'),'Trip API call');
assert.ok(readFileSync('addin-config.trip-api-v0.4.7.json','utf8').length<10000,'keep below 10KB as controlled regression test');
const map=new Map();
function node(id){
 if(!map.has(id)){
  const o={id,disabled:id==='run',value:'',textContent:'',children:[],appendChild(child){this.children.push(child);},onclick:null};
  map.set(id,o);
 }
 return map.get(id);
}
const calls=[];
const mockApi={call(method,params,ok,err){
  calls.push({method,params});
  if(params.typeName==='Device')return ok([{id:'device1',name:'Veículo fictício'}]);
  if(params.typeName==='Trip')return ok([{id:'trip1',start:'2026-11-18T09:00:00Z',distance:13.5}]);
  err(new Error('Unknown API type'));
}};
const context={
 console:{log(){},info(){},warn(){},error(){}},
 document:{getElementById:node,createElement:()=>({value:'',textContent:''})},
 window:null,Date,Math,Number,String,Array,Object,Error,JSON
};
context.window=context;
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
runInNewContext(scripts[0][1],context,{filename:'trips.html',timeout:5000});
const entry=context.geotab?.addin?.fleetTelemetryManager;
assert.equal(typeof entry,'function');
const lifecycle=entry();
for(const fn of ['initialize','focus','blur'])assert.equal(typeof lifecycle[fn],'function');
let done=0;lifecycle.initialize(mockApi,{},()=>done++);
assert.equal(done,1);
assert.equal(calls[0].params.typeName,'Device');
assert.equal(calls[0].params.resultsLimit,20);
assert.equal(node('run').disabled,false);
node('devices').value='device1';node('run').onclick();
assert.equal(calls[1].params.typeName,'Trip');
assert.equal(calls[1].params.search.deviceSearch.id,'device1');
assert.equal(calls[1].params.resultsLimit,30);
assert.ok(node('msg').textContent.includes('API Trip OK: 1'));
console.log('OK v0.4.7: JSON <10 KB, six pages, MyGeotab initialize, Device Get and Trip Get.');
