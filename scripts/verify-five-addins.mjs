import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Script} from 'node:vm';
import {resolve,dirname} from 'node:path';

const read=p=>readFileSync(p,'utf8');
const pages=[
  'dashboard030.html','index.html',
  'health/health030.html','health/index.html',
  'exceptions/exceptions030.html','exceptions/index.html',
  'incidents/incidents030.html','incidents/index.html',
  'trips/trips030.html','trips/index.html'
];
assert.ok(existsSync('ui/fleet-refresh.css'),'Tema compartilhado ausente');
for(const page of pages){
  const source=read(page);
  const theme='fleet-refresh.css?v=1.0.0';
  assert.equal(source.split(theme).length-1,1,'Tema duplicado ou ausente: '+page);
  assert.ok(source.indexOf(theme)>source.lastIndexOf('</script>'),'Tema foi inserido dentro de um script: '+page);
  assert.ok(source.includes('class="ftm-ui"'),'Escopo do tema ausente: '+page);
  for(const script of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(script[1].trim())new Script(script[1],{filename:page});
  }
  for(const tag of source.matchAll(/href="(\.{1,2}\/ui\/[^"]+)"/g)){
    assert.ok(existsSync(resolve(dirname(page),tag[1].split('?')[0])),'CSS ausente em '+page);
  }
}
assert.ok(!read('mileage/mileage030.html').includes('fleet-refresh.css'),'KM Rodado não pode carregar novo tema');
assert.ok(!read('mileage/index.html').includes('fleet-refresh.css'),'KM Rodado não pode carregar novo tema');
assert.ok(!read('addin-config.json').includes('fleet-refresh.css'),'Manifesto original deve permanecer sem alterações');
const trip=read('trips/trips030.html');
assert.ok(trip.includes('Promise.allSettled'),'Trip deve distinguir falhas de fontes');
assert.ok(trip.includes('Falha na fonte obrigatória Trip'),'Trip não pode mascarar falhas');
assert.ok(trip.includes("return {official:true,dist:trips.reduce"),'PDF deve usar distância de Trip');
assert.ok(!trip.includes('const R=6371'),'Fallback de linha reta removido');
assert.ok(trip.includes("sort((a,b)=>new Date(b.start"),'Viagens recentes primeiro');
for(const page of ['exceptions/exceptions030.html','exceptions/index.html']){
  assert.ok(read(page).includes('Falha ao consultar ExceptionEvent'),'Erro de API não pode virar zero evento');
}
const health=read('health/health030.html');
assert.ok(health.includes('Sem registros de StatusData ou FaultData'),'Health requer evidência');
assert.ok(health.includes('Com StatusData 7d'),'Health precisa mostrar cobertura diagnóstica');
assert.ok(read('incidents/app.js').includes("if(!groupId()){"),'Incidents deve limpar operação quando grupo desmarcado');
assert.ok(read('assets/app.js').includes("partial?'warn':'ok'"),'Dashboard deve rotular consultas parciais');
console.log('OK: cinco Add-Ins revisados; scripts compilam; mileage030 isolado.');
