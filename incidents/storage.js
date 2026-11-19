/* AddInData é a única persistência do módulo. Cada ação cria uma linha imutável. */
(function(root){
'use strict';
// ID exclusivo desta solução, conforme a codificação recomendada pela Storage API da Geotab.
const ADDIN_ID='a2UzOGI0NTgtMGNmNC00MTg';
const MAX_ROWS=5000;
const MAX_DETAILS=9000;
function call(api,method,type,object,limit){
  return new Promise(function(ok,fail){
    if(!api||typeof api.call!=='function')return fail(Error('Sessão MyGeotab indisponível.'));
    const params={typeName:type};
    params[method==='Get'?'search':'entity']=object;
    if(limit)params.resultsLimit=limit;
    try{api.call(method,params,ok,fail);}catch(e){fail(e);}
  });
}
function sessionUser(api){
  return new Promise(function(ok){
    if(!api||typeof api.getSession!=='function')return ok('');
    try{api.getSession(function(session){ok(session&&typeof session.userName==='string'?session.userName:'');});}
    catch(e){ok('');}
  });
}
function uniqueId(){
  if(!root.crypto||typeof root.crypto.randomUUID!=='function')throw Error('Navegador sem gerador seguro de identificadores.');
  return 'ftm_'+root.crypto.randomUUID().replace(/-/g,'');
}
function checkGroup(groupId){if(!/^[\w-]{2,100}$/.test(String(groupId||'')))throw Error('Selecione um grupo operacional válido.');}
async function read(api,groupId){
  checkGroup(groupId);
  const result=await call(api,'Get','AddInData',{addInId:ADDIN_ID,groups:[{id:groupId}]},MAX_ROWS);
  if(!Array.isArray(result))throw Error('Resposta de AddInData inválida.');
  if(result.length>=MAX_ROWS)throw Error('Limite de 5.000 registros alcançado. Não é seguro calcular métricas parciais.');
  return result.filter(row=>row&&row.details&&row.details.groupId===groupId);
}
async function append(api,groupId,details){
  checkGroup(groupId);
  if(!details||details.groupId!==groupId)throw Error('Operação sem correspondência de grupo.');
  const length=JSON.stringify(details).length;
  if(length>MAX_DETAILS)throw Error('Registro ultrapassa o tamanho permitido.');
  return call(api,'Add','AddInData',{addInId:ADDIN_ID,groups:[{id:groupId}],details});
}
root.TelemetryCaseStore={ADDIN_ID,read,append,sessionUser,uniqueId};
})(typeof globalThis!=='undefined'?globalThis:this);
