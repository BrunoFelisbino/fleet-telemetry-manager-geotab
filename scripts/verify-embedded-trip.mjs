import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';

const config=JSON.parse(readFileSync('addin-config.trip-real-v0.4.6.json','utf8'));
const names=['dashboard.html','mileage.html','incidents.html','health.html','exceptions.html','trips.html'];
assert.equal(config.version,'0.4.6');
assert.equal(config.name,'fleetTelemetryManager');
assert.equal(config.items.length,6);
assert.deepEqual(config.items.map(x=>x.url),names);
assert.deepEqual(Object.keys(config.files),names);
for(const name of names){
 const html=config.files[name];
 assert.equal(typeof html,'string',name+' missing from files');
 const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
 assert.equal(scripts.length,1,name+' must have one inline bootstrap script');
 assert.ok(html.includes('geotab.addin.fleetTelemetryManager'),name+' must register same Add-In namespace');
 new Script(scripts[0][1],{filename:name});
}
const real=config.files['trips.html'];
assert.ok(real.length>30000,'Trip 360 must be the full application, not the test page');
assert.ok(real.includes("function init(api){shell();"),'Trip 360 initialization must mount its UI');
assert.ok(real.includes("Trip 360 v0.4.6"),'Trip 360 bundle version marker missing');
for(const name of names.slice(0,5))assert.ok(config.files[name].includes('TESTE OK:'),name+' should remain a diagnostic page');

const map=new Map();
const node=id=>{
 if(!map.has(id))map.set(id,{
  id,innerHTML:id==='app'?'Carregando Fleet Trip 360...':'',textContent:'',value:id==='periodFilter'?'1':'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},
  children:[],appendChild(){},removeChild(){},setAttribute(){},removeAttribute(){},addEventListener(){},
  querySelector(){return null},querySelectorAll(){return []},click(){},getAttribute(){return null}
 });
 return map.get(id);
};
const errors=[];
const sandbox={
 console:{log(){},info(){},warn(){},error(...msgs){errors.push(msgs.join(' '))}},
 document:{getElementById:node,createElement:()=>node('created'),querySelector(){return null},querySelectorAll(){return []},body:node('body')},
 addEventListener(){},removeEventListener(){},setTimeout:()=>0,clearTimeout(){},
 URL,URLSearchParams,Blob,Date,Intl,Math,Number,String,Array,Object,Error,Promise,Map,Set,JSON,
 location:{href:'https://my.geotab.com/base',search:''},navigator:{language:'pt-BR'}
};
sandbox.window=sandbox;
const code=[...real.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)][0][1];
runInNewContext(code,sandbox,{filename:'trips.html',timeout:5000});
const factory=sandbox.geotab?.addin?.fleetTelemetryManager;
assert.equal(typeof factory,'function','Trip 360 failed to register Geotab factory');
const addin=factory();
assert.equal(typeof addin.initialize,'function');
let callbacks=0;
addin.initialize(null,{},()=>callbacks++);
assert.equal(callbacks,1,'Trip 360 should signal initialize completion');
assert.ok(!node('app').innerHTML.includes('Carregando Fleet Trip 360...'),'Trip 360 must exit loading state');
assert.ok(node('app').innerHTML.includes('Fleet Trip 360'),'Trip 360 must mount real interface');
assert.equal(errors.length,0,'Trip 360 reported JS errors: '+errors.join('; '));
console.log('OK: six embedded pages; full Trip 360 boot and Geotab initialize callback.');
