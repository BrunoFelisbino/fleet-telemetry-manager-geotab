/* UI de ocorrências: usa somente a API da sessão MyGeotab. */
(function(){
'use strict';
const Model=window.TelemetryCaseModel,Store=window.TelemetryCaseStore;
let api=null,actor='',devices=[],groups=[],rules=[],cases=[],selectedCase='',events=[],loading=false,writeReady=false,loaded=false;
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const ref=v=>v&&typeof v==='object'?String(v.id||''):String(v||'');
const moneyNum=(n,d=1)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const dateString=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleString('pt-BR'):'N/D';};
const typeNames={velocidade:'Excesso de velocidade',rota:'Desvio de rota',marcha_lenta:'Marcha lenta',conducao:'Condução de risco',comunicacao:'Falha de comunicação',mecanica:'Indício mecânico',uso_nao_autorizado:'Uso não autorizado',outros:'Outra'};
const stateNames={aberta:'Aberta',em_analise:'Em análise',encaminhada:'Encaminhada',em_tratamento:'Em tratamento',concluida:'Concluída',justificada:'Justificada',reaberta:'Reaberta'};
function msg(v,err){$('message').textContent=v;$('message').className='alert'+(err?' err':' ok');}
function call(type,search,limit=5000){return new Promise((ok,fail)=>api.call('Get',{typeName:type,search:search||{},resultsLimit:limit},ok,fail));}
function groupId(){return $('groupSelect').value;}
function scopedDevices(){const group=groupId();return devices.filter(d=>!d.activeTo||new Date(d.activeTo)>new Date()).filter(d=>(d.groups||[]).some(g=>ref(g)===group));}
function visibleSet(){return new Set(scopedDevices().map(d=>String(d.id)));}
function deviceName(id){const d=devices.find(x=>String(x.id)===String(id));return d?d.name||d.licensePlate||d.id:id;}
function activeGroupIds(){const ignored=new Set(['GroupCompanyId','GroupVehicleId','GroupTrailerId','GroupDriverId']);
  const all=new Set(devices.flatMap(d=>(d.groups||[]).map(ref)));
  return [...all].filter(id=>id&&!ignored.has(id));}
function setGroupOptions(){
  const known=new Map(groups.filter(Boolean).map(g=>[String(g.id),g.name||g.id]));
  $('groupSelect').innerHTML='<option value="">Selecione um grupo operacional</option>'+activeGroupIds().sort((a,b)=>String(known.get(a)||a).localeCompare(String(known.get(b)||b),'pt-BR')).map(id=>'<option value="'+esc(id)+'">'+esc(known.get(id)||id)+'</option>').join('');
}
function setVehicleOptions(){
  $('vehicleSelect').innerHTML='<option value="">Selecione o veículo</option>'+scopedDevices().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR')).map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name||d.licensePlate||d.id)+'</option>').join('');
  $('eventSelect').innerHTML='<option value="">Sem vinculação automática</option>';events=[];
  $('loadEventsBtn').disabled=!api||!groupId()||!$('vehicleSelect').value;
}
function caseStatus(c){
  if(Model.CLOSED.includes(c.status))return c.closedAt&&Date.parse(c.closedAt)<=Date.parse(c.dueAt)?'No prazo':'Fora do prazo';
  return Date.now()>Date.parse(c.dueAt)?'Prazo vencido':'Dentro do prazo';
}
function recordMetrics(){
  if(!loaded){$('incidentKpis').innerHTML=[['Ocorrências','N/D'],['Tratadas no prazo','N/D'],['Tempo de tratamento','N/D'],['Reincidência','N/D']].map(x=>'<article class="kpi"><span>'+x[0]+'</span><strong class="value">'+x[1]+'</strong></article>').join('');return;}
  const days=Number($('periodSelect').value)||30,to=new Date(),from=new Date(Date.now()-days*86400000);
  const m=Model.metrics(cases,from.toISOString(),to.toISOString());
  const details=[
    ['Ocorrências registradas',String(m.total),'Casos abertos no período; '+m.open+' ainda em aberto.'],
    ['Alertas tratados no prazo',m.slaPct==null?'N/D':moneyNum(m.slaPct)+'%','Meta sugerida ≥ 95% · '+m.ontime+' de '+m.eligible+' com prazo vencido ou encerrados.'],
    ['Tempo médio de tratamento',m.meanHours==null?'N/D':moneyNum(m.meanHours,1)+' h','Meta sugerida ≤ 24 h (não críticos) · valor descritivo de casos concluídos.'],
    ['Reincidência registrada',m.recurrencePct==null?'N/D':moneyNum(m.recurrencePct)+'%','Mesmo veículo/natureza após correção em até 30 dias. Meta ≤ 5%.']
  ];
  $('incidentKpis').innerHTML=details.map(x=>'<article class="kpi"><span>'+esc(x[0])+'</span><strong class="value">'+esc(x[1])+'</strong><small class="context">'+esc(x[2])+'</small></article>').join('');
}
function filteredCases(){
  const q=$('searchInput').value.toLowerCase().trim(),st=$('statusFilter').value;
  return cases.filter(c=>!st||c.status===st).filter(c=>!q||[deviceName(c.vehicleId),c.summary,c.owner,c.caseId].join(' ').toLowerCase().includes(q));
}
function renderList(){
  const rows=filteredCases();
  $('casesBody').innerHTML=rows.length?rows.map(c=>{
    const situation=caseStatus(c),style=situation==='Prazo vencido'||situation==='Fora do prazo'?'late':situation==='No prazo'?'ontime':'';
    return '<tr class="case-row '+(selectedCase===c.caseId?'active':'')+'"><td><b>'+esc(deviceName(c.vehicleId))+'</b><div>'+esc(typeNames[c.category]||c.category)+'</div><small>'+esc(c.summary.slice(0,95))+'</small></td><td><span class="chip">'+esc(stateNames[c.status]||c.status)+'</span></td><td><span class="chip '+style+'">'+esc(situation)+'</span><small style="display:block">'+esc(dateString(c.dueAt))+'</small></td><td><button type="button" data-id="'+esc(c.caseId)+'">Ver</button></td></tr>';
  }).join(''):'<tr><td colspan="4">Nenhuma ocorrência registrada na seleção.</td></tr>';
  $('casesBody').querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>selectCase(b.dataset.id)));
}
function selectCase(id){
  selectedCase=id;
  const c=cases.find(x=>x.caseId===id);
  if(!c){$('caseDetail').textContent='Selecione uma ocorrência.';$('transitionForm').hidden=true;$('auditTimeline').innerHTML='';return;}
  $('caseDetail').innerHTML='<strong>'+esc(deviceName(c.vehicleId))+' · '+esc(typeNames[c.category]||c.category)+'</strong><div>'+esc(c.summary)+'</div><div><b>Criticidade:</b> '+esc(c.severity)+' · <b>Responsável:</b> '+esc(c.owner||'Não informado')+'</div><div><b>Abertura:</b> '+esc(dateString(c.ts))+' · <b>Prazo:</b> '+esc(dateString(c.dueAt))+'</div><div><b>Estado atual:</b> '+esc(stateNames[c.status]||c.status)+' · <b>Autor:</b> '+esc(c.actor)+'</div>'+(c.sourceEventId?'<div><b>Evento Geotab:</b> '+esc(c.sourceEventId)+'</div>':'');
  const allowed=Model.TRANSITIONS[c.status]||[];
  $('nextStatusSelect').innerHTML=allowed.map(s=>'<option value="'+esc(s)+'">'+esc(stateNames[s])+'</option>').join('');
  $('nextOwnerInput').value=c.owner||'';$('actionNotes').value='';
  $('transitionForm').hidden=!allowed.length||!writeReady;$('transitionBtn').disabled=!writeReady;
  $('auditTimeline').innerHTML='<li><strong>Abertura</strong> · '+esc(dateString(c.ts))+'<div>'+esc(c.actor)+' · '+esc(c.summary)+'</div></li>'+c.history.map(h=>'<li><strong>'+esc(stateNames[h.to]||h.to)+'</strong> · '+esc(dateString(h.ts))+'<div>'+esc(h.actor)+' · '+esc(h.notes)+'</div>'+(h.owner?'<div>Responsável: '+esc(h.owner)+'</div>':'')+'</li>').join('');
  renderList();
}
async function reload(){
  if(!api)return;
  if(!groupId()){
    cases=[];loaded=false;selectedCase='';events=[];
    recordMetrics();renderList();selectCase('');
    $('downloadBtn').disabled=true;
    $('createBtn').disabled=true;
    msg('Selecione uma operação para consultar ocorrências.');
    return;
  }
  if(loading)return;loading=true;$('reloadBtn').disabled=true;loaded=false;
  try{
    msg('Consultando tratativas no grupo selecionado...');
    const records=await Store.read(api,groupId()),visible=visibleSet();
    cases=Model.buildCases(records).filter(c=>c.groupId===groupId()&&visible.has(String(c.vehicleId)));
    loaded=true;
    recordMetrics();renderList();
    if(selectedCase)selectCase(selectedCase);
    $('downloadBtn').disabled=false;
    $('createBtn').disabled=!writeReady;
    msg(cases.length+' ocorrência(s) disponíveis na operação. Os registros são protegidos pelas permissões da base MyGeotab.');
  }catch(e){
    cases=[];loaded=false;selectedCase='';recordMetrics();renderList();selectCase('');
    $('createBtn').disabled=true;$('downloadBtn').disabled=true;
    msg('Não foi possível consultar AddInData: '+String(e.message||e)+' Verifique permissões ViewAddInData.',true);
  }finally{loading=false;$('reloadBtn').disabled=!groupId();}
}
function linkRecentEvents(){
  $('eventSelect').innerHTML='<option value="">Sem vinculação automática</option>'+events.map(e=>{
    const r=rules.find(x=>ref(x)===ref(e.rule)),name=r?r.name:'Regra não identificada';
    return '<option value="'+esc(e.id)+'">'+esc(name)+' · '+esc(dateString(e.activeFrom))+'</option>';
  }).join('');
}
async function loadEvents(){
  if(!api||!$('vehicleSelect').value)return;
  const id=$('vehicleSelect').value,from=new Date(Date.now()-7*86400000),to=new Date();
  $('loadEventsBtn').disabled=true;
  try{
    const result=await call('ExceptionEvent',{deviceSearch:{id},fromDate:from.toISOString(),toDate:to.toISOString()},200);
    events=(result||[]).filter(x=>x.id);
    linkRecentEvents();msg('Carregados '+events.length+' evento(s). '+(events.length>=200?'Consulta atingiu 200 registros; a lista pode estar incompleta.':''));
  }catch(e){events=[];linkRecentEvents();msg('Não foi possível consultar eventos: '+String(e.message||e),true);}
  finally{$('loadEventsBtn').disabled=false;}
}
async function createIncident(ev){
  ev.preventDefault();
  if(!writeReady||!loaded||!groupId())return;
  const vehicleId=$('vehicleSelect').value;
  if(!visibleSet().has(vehicleId))return msg('Veículo não pertence ao grupo selecionado.',true);
  const eventId=$('eventSelect').value;
  if(eventId&&cases.some(c=>c.sourceEventId===eventId))return msg('Este evento já possui uma ocorrência no grupo.',true);
  if(eventId&&!events.some(e=>e.id===eventId))return msg('Evento selecionado não está disponível na lista atual.',true);
  const ts=new Date().toISOString(),date=new Date($('deadlineInput').value);
  if(!Number.isFinite(date.getTime()))return msg('Prazo de tratativa inválido.',true);
  const detail={schema:1,kind:'created',caseId:Store.uniqueId(),ts,groupId:groupId(),vehicleId,
    category:$('categorySelect').value,severity:$('severitySelect').value,
    summary:$('summaryInput').value.trim(),dueAt:date.toISOString(),
    owner:$('ownerInput').value.trim(),actor,
    sourceEventId:eventId,sourceAt:eventId?(events.find(e=>e.id===eventId)||{}).activeFrom||'':''};
  try{Model.validateCreated(detail);}catch(e){return msg(e.message,true);}
  const btn=$('createBtn');btn.disabled=true;
  try{
    await Store.append(api,groupId(),detail);
    $('summaryInput').value='';$('eventSelect').value='';
    selectedCase=detail.caseId;
    await reload();
  }catch(e){msg('Falha ao salvar ou atualizar: '+String(e.message||e)+'. Confira a lista antes de tentar novamente.',true);}
  finally{btn.disabled=!writeReady||!loaded;}
}
async function saveAction(ev){
  ev.preventDefault();if(!selectedCase||!writeReady||!loaded)return;
  const c=cases.find(x=>x.caseId===selectedCase);
  if(!c)return;
  const target=$('nextStatusSelect').value,notes=$('actionNotes').value.trim(),owner=$('nextOwnerInput').value.trim();
  const detail={schema:1,kind:'transition',caseId:c.caseId,groupId:groupId(),ts:new Date().toISOString(),actor,from:c.status,to:target,notes,owner};
  try{Model.validateTransition(detail);}catch(e){return msg(e.message,true);}
  $('transitionBtn').disabled=true;
  try{
    const latest=Model.buildCases(await Store.read(api,groupId())).find(x=>x.caseId===c.caseId);
    if(!latest||latest.status!==c.status||latest.updatedAt!==c.updatedAt)throw Error('Esta ocorrência foi modificada. Atualize e revise antes de salvar.');
    await Store.append(api,groupId(),detail);
    await reload();
  }catch(e){msg('Tratativa não confirmada: '+String(e.message||e),true);}
  finally{$('transitionBtn').disabled=!writeReady;}
}
function csvCell(v){let s=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function download(){
  if(!loaded)return;
  const table=[['ID','Veículo','Natureza','Criticidade','Estado','Abertura','Prazo','Conclusão','Responsável','Descrição','Autor']];
  for(const c of filteredCases())table.push([c.caseId,deviceName(c.vehicleId),typeNames[c.category]||c.category,c.severity,c.status,c.ts,c.dueAt,c.closedAt||'',c.owner,c.summary,c.actor]);
  const text='\ufeff'+table.map(row=>row.map(csvCell).join(';')).join('\r\n'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download='fleet-telemetry-ocorrencias.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function initialize(client){
  api=client;
  $('reloadBtn').addEventListener('click',reload);
  $('groupSelect').addEventListener('change',async()=>{selectedCase='';setVehicleOptions();await reload();});
  $('vehicleSelect').addEventListener('change',()=>{$('eventSelect').innerHTML='<option value="">Sem vinculação automática</option>';events=[];$('loadEventsBtn').disabled=!$('vehicleSelect').value;});
  $('loadEventsBtn').addEventListener('click',loadEvents);
  $('statusFilter').addEventListener('change',renderList);
  $('searchInput').addEventListener('input',renderList);
  $('periodSelect').addEventListener('change',recordMetrics);
  $('createForm').addEventListener('submit',createIncident);
  $('transitionForm').addEventListener('submit',saveAction);
  $('downloadBtn').addEventListener('click',download);
  if(!api){msg('Abra este Add-In dentro do MyGeotab para consultar e registrar dados reais.',true);return;}
  try{
    actor=await Store.sessionUser(api);
    writeReady=!!actor;
    $('sessionStatus').textContent=actor?'Conectado: '+actor:'Sessão sem identificação';
    const r=await Promise.allSettled([call('Device',{},5000),call('Group',{},5000),call('Rule',{},5000)]);
    if(r[0].status!=='fulfilled')throw Error('Sem permissão para consultar veículos.');
    devices=r[0].value||[];
    if(devices.length>=5000)throw Error('Limite de veículos atingido; não é seguro consultar grupos parciais.');
    groups=r[1].status==='fulfilled'?r[1].value||[]:[];
    rules=r[2].status==='fulfilled'?r[2].value||[]:[];
    setGroupOptions();recordMetrics();
    msg(activeGroupIds().length?'Selecione uma operação para abrir ou acompanhar ocorrências.':'Não há grupos operacionais associados aos veículos visíveis; configure os grupos antes de continuar.',!activeGroupIds().length);
  }catch(e){msg('Falha de inicialização: '+String(e.message||e),true);}
}
window.geotab=window.geotab||{};window.geotab.addin=window.geotab.addin||{};
window.geotab.addin.fleetTelemetryManager=function(){return{
  initialize:function(api,state,cb){initialize(api).catch(e=>msg(String(e.message||e),true));if(cb)cb();},
  focus:function(){},blur:function(){}
};};
})();
