import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const context={console,Date,Uint8Array};
context.globalThis=context;
for(const path of ['mileage/model.js','mileage/filters.js','mileage/pdf.js']){
  runInNewContext(readFileSync(path,'utf8'),context,{filename:path});
}
const Model=context.FleetMileageModel,Pdf=context.FleetMileagePdf,Filter=context.FleetMileageFilters;
assert.equal(typeof Pdf.make,'function');
assert.equal(typeof Filter.filterOptions,'function');
const options=[{label:'Frota São Paulo',id:'sp'},{label:'Caminhão ABC1234',plate:'ABC-1234',id:'truck'}];
assert.equal(Filter.filterOptions(options,'sao').length,1,'Search ignores accents');
assert.equal(Filter.filterOptions(options,'abc1234').length,1,'Name search includes vehicle name');
assert.equal(Filter.filterOptions(options,'ABC-1234').length,1,'Search includes license plate');
const period={from:new Date(2026,10,1),to:new Date(2026,10,19),label:'Mês atual'};
const daily=[{day:'2026-11-02',km:12},{day:'2026-11-08',km:7},{day:'2026-11-12',km:31}];
const trend=Model.trendBuckets(daily,period,7);
assert.ok(trend.length<=7);
assert.equal(trend.reduce((n,x)=>n+x.km,0),50,'Chart total equals mileage sum');
const rows=Array.from({length:70},(_,i)=>({
  name:'TESTE '+i,plate:'ABC'+String(i+1000),km:i*5,tripCount:i,
  odoStart:i===0?null:12000+i,odoEnd:i===0?null:12100+i
}));
const report={summary:{
  km:70*69*5/2,vehicles:70,trips:2415,stopped:1,average:172.5,
  withOdometer:69,boundaryTrips:2,dailyRows:daily,
  groupsRows:[{name:'Operação 01',km:7500,vehicles:30,trips:1000},{name:'Operação 02',km:4575,vehicles:40,trips:1415}],
  vehiclesRows:rows
},period,trend,groupNames:['Operação 01','Operação 02'],vehicleNames:[],demo:true};
const bytes=Pdf.make(report);
const content=Buffer.from(bytes).toString('latin1');
assert.ok(content.startsWith('%PDF-1.4'));
assert.ok(content.endsWith('%%EOF'));
assert.match(content,/\/Count 5\b/,'1 dashboard + 1 groups + 3 vehicle pages');
assert.match(content,/SIMULA/);
assert.match(content,/KM TOTAL/);
assert.match(content,/Ve.culos/);
assert.match(content,/\/Font/);
assert.match(content,/xref\n0 /);
const xrefIndex=content.lastIndexOf('xref\n0 ');
const ref=content.match(/startxref\n(\d+)\n%%EOF$/);
assert.equal(Number(ref?.[1]),xrefIndex,'Cross reference offset must point to xref table');
assert.throws(()=>Pdf.make(null),/Consulte a frota/);
console.log('OK: filtros com busca, evolução KM, PDF multi-página, encoding e xref.');
