import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const paths=['index.html','mileage/index.html','incidents/index.html','health/index.html','exceptions/index.html','trips/index.html'];
function getCode(file){
 const html=readFileSync(file,'utf8');
 const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
 assert.equal(scripts.length,1,file+' should have one inline JavaScript bootstrap');
 return scripts[0][1];
}
for(const path of paths){
 const errors=[];
 const elements=new Map();
 const node=id=>{
  if(!elements.has(id)){
   const element={id,innerHTML:'',textContent:'',value:id==='periodFilter'?'1':'',style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},children:[],dataset:{},disabled:false,hidden:false,
     appendChild(){},removeChild(){},addEventListener(){},setAttribute(){},removeAttribute(){},getAttribute(){return ''},
     querySelector(){return null},querySelectorAll(){return []},click(){},scrollIntoView(){}};
   elements.set(id,element);
  }
  return elements.get(id);
 };
 const sandbox={
   console:{log(){},info(){},warn(){},error(...xs){errors.push(xs.map(String).join(' '))}},
   document:{getElementById:node,createElement:()=>node('created'),querySelector:()=>null,querySelectorAll:()=>[],body:node('body'),documentElement:node('html')},
   setTimeout:()=>0,clearTimeout(){},addEventListener(){},removeEventListener(){},
   URL,URLSearchParams,Blob,Date,Intl,Math,Number,String,Array,Object,Error,Promise,Map,Set,JSON,
   location:{href:'https://my.geotab.com/base',search:''},navigator:{language:'pt-BR'},localStorage:{getItem(){return null},setItem(){},removeItem(){}}
 };
 sandbox.window=sandbox;
 node('app').innerHTML=path==='trips/index.html'?'Carregando Fleet Trip 360...':'Carregando...';
 runInNewContext(getCode(path),sandbox,{filename:path,timeout:5000});
 const addin=sandbox.geotab?.addin?.fleetTelemetryManager;
 assert.equal(typeof addin,'function',path+' did not register Geotab namespace');
 const lifecycle=addin();
 for(const method of ['initialize','focus','blur'])assert.equal(typeof lifecycle[method],'function',path+' missing '+method);
 if(path==='trips/index.html'){
   let callbacks=0;
   lifecycle.initialize(null,{},()=>callbacks++);
   assert.equal(callbacks,1,'Trip 360 must notify Geotab initialization callback');
   assert.ok(!node('app').innerHTML.includes('Carregando Fleet Trip 360...'),'Trip 360 must replace loading placeholder immediately');
   assert.ok(node('app').innerHTML.includes('Fleet Trip 360'),'Trip 360 must mount its interface');
   assert.ok(!errors.length,'Trip 360 generated errors in mock initialization: '+errors.join(' | '));
 }
 console.log('OK '+path+': Geotab factory, lifecycle and single script');
}
