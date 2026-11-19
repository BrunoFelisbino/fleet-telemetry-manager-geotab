import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const context={console,crypto:{randomUUID:()=> '6d9478f0-a1bc-4333-9989-08a2c7a61234'}};
context.globalThis=context;
runInNewContext(readFileSync('incidents/model.js','utf8'),context);
runInNewContext(readFileSync('incidents/storage.js','utf8'),context);
const M=context.TelemetryCaseModel,S=context.TelemetryCaseStore;
const ts=(day)=>'2026-11-'+String(day).padStart(2,'0')+'T12:00:00.000Z';
function created(id,day,due,category='velocidade',severity='media',vehicleId='vehicle-a'){
  return {schema:1,kind:'created',caseId:id,groupId:'grp-a',vehicleId,category,severity,
    summary:'Ocorrência sintética '+id,owner:'Manutenção',actor:'teste',ts:ts(day),dueAt:ts(due)};
}
function action(id,day,from,to,notes='Análise feita'){
  return {schema:1,kind:'transition',caseId:id,groupId:'grp-a',ts:ts(day),from,to,actor:'teste',notes,owner:'Operação'};
}
const data=[
  created('case_00000000001',1,3), action('case_00000000001',2,'aberta','encaminhada'),action('case_00000000001',2,'encaminhada','concluida'),
  created('case_00000000002',4,6,'rota'),action('case_00000000002',5,'aberta','encaminhada'),action('case_00000000002',7,'encaminhada','concluida'),
  created('case_00000000003',8,10,'comunicacao'),
  created('case_00000000004',10,12),action('case_00000000004',11,'aberta','encaminhada'),action('case_00000000004',11,'encaminhada','concluida'),
  created('case_00000000005',13,15,'mecanica','critica'),action('case_00000000005',14,'aberta','encaminhada'),action('case_00000000005',14,'encaminhada','concluida'),
  action('case_00000000001',15,'aberta','concluida','Transição forjada')
];
const rows=data.map((details,i)=>({id:String(i+1).padStart(4,'0'),details}));
const cases=M.buildCases(rows);
assert.equal(cases.length,5);
assert.equal(cases.find(c=>c.caseId==='case_00000000001').status,'concluida');
assert.equal(cases.find(c=>c.caseId==='case_00000000001').history.length,2,'Ignorar transição inválida');
const result=M.metrics(cases,ts(1),ts(19));
assert.equal(result.total,5);
assert.equal(result.eligible,5);
assert.equal(result.ontime,3);
assert.equal(result.slaPct,60);
assert.equal(result.meanHours,40,'Ignorar alerta crítico no tempo médio');
assert.equal(result.recurrent,1);
assert.equal(result.recurrencePct,25);
assert.equal(result.open,1);
assert.throws(()=>M.validateCreated({...created('case_00000000006',3,4),dueAt:ts(2)}));
assert.throws(()=>M.validateTransition(action('case_00000000001',20,'aberta','concluida')));

const saved=[];
const api={
  call(method,args,ok,fail){
    if(args.typeName!=='AddInData')return fail(new Error('Tipo inesperado'));
    if(method==='Add'){saved.push({id:String(saved.length+1),...args.entity});return ok(String(saved.length));}
    if(method==='Get'){
      assert.equal(args.search.addInId,S.ADDIN_ID);
      return ok(saved.filter(x=>x.groups.some(g=>g.id===args.search.groups[0].id)));
    }
    fail(new Error('Método não esperado'));
  },
  getSession(cb){cb({userName:'usuario.homologacao'});}
};
assert.equal(await S.sessionUser(api),'usuario.homologacao');
const newRecord=created('case_00000000009',17,20);
await S.append(api,'grp-a',newRecord);
assert.equal(saved.length,1);
assert.equal((await S.read(api,'grp-a')).length,1);
assert.equal((await S.read(api,'grp-b')).length,0);
await assert.rejects(()=>S.append(api,'grp-b',newRecord),/grupo/);
assert.equal(S.uniqueId().length>10,true);
console.log('OK: auditoria append-only, SLA, reincidência, não críticos, grupos e transições.');
