/* Consulta Geotab: lote por veículo, limite adaptativo, sem truncar o total da frota. */
(function(){
'use strict';
const Model=window.FleetMileageModel;
const $=id=>document.getElementById(id);
const LIMIT=4000,MIN_WINDOW=60000;
let api=null,devices=[],groups=[],loaded=false,loading=false,token=0,last=null,rateSlot=0,initializing=false;
const safe=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmt=(n,d=1)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const dt=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleString('pt-BR'):'N/D';};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function message(value,kind=''){const e=$('message');e.textContent=value;e.className='alert'+(kind?' '+kind:'');}
function call(type,search,limit){
  return new Promise((resolve,reject)=>{
    if(!api)return reject(Error('Sessão MyGeotab indisponível'));
    try{api.call('Get',{typeName:type,search:search||{},resultsLimit:limit||LIMIT},resolve,reject);}
    catch(e){reject(e);}
  });
}
function checkToken(req){if(req!==token)throw Error('CONSULTA_CANCELADA');}
async function pace(req){
  checkToken(req);
  const now=Date.now();
  const allowed=Math.max(now,rateSlot);
  rateSlot=allowed+170;
  if(allowed>now)await wait(allowed-now);
  checkToken(req);
}
async function tripsInWindow(device,from,to,req,depth=0){
  checkToken(req);await pace(req);
  const search={deviceSearch:{id:device.id},fromDate:from.toISOString(),toDate:to.toISOString(),includeOverlappedTrips:true};
  let trips;
  for(let attempt=0;attempt<2;attempt++){
    try{trips=await call('Trip',search,LIMIT);break;}
    catch(e){if(attempt===1)throw e;await wait(1100);checkToken(req);}
  }
  checkToken(req);
  if(!Array.isArray(trips))throw Error('A Geotab não retornou uma lista de viagens.');
  if(trips.length<LIMIT)return trips;
  const width=to.getTime()-from.getTime();
  if(width<=MIN_WINDOW||depth>=16)throw Error('Limite de viagens atingido em janela pequena para '+(device.name||device.id)+'.');
  const mid=new Date(Math.floor((from.getTime()+to.getTime())/2));
  // As consultas podem repetir viagens que cruzam as janelas: desduplicação por Trip.id.
  const a=await tripsInWindow(device,from,mid,req,depth+1);
  const b=await tripsInWindow(device,mid,to,req,depth+1);
  return a.concat(b);
}
async function bootstrap(){
  if(loaded)return;
  if(initializing)return;
  initializing=true;message('Carregando frota e grupos autorizados...');
  try{
    const res=await Promise.allSettled([call('Device',{},50000),call('Group',{},10000)]);
    if(res[0].status==='rejected')throw Error('Sem acesso ao cadastro de veículos: '+String(res[0].reason));
    if(res[1].status==='rejected')throw Error('Sem acesso aos grupos: '+String(res[1].reason));
    devices=res[0].value||[];groups=res[1].value||[];
    if(devices.length>=50000||groups.length>=10000)throw Error('Cadastros no limite de resposta: não é seguro fazer o cálculo sem paginação dos cadastros.');
    fillGroups();fillVehicles();
    loaded=true;
    $('status').textContent='MyGeotab conectado';
    message('Frota carregada ('+devices.length+' cadastros). Escolha os filtros e clique em Consultar.','ok');
  }finally{initializing=false;}
}
function fillGroups(){
  const active=devices.filter(d=>Model.isActive(d));
  const seen=new Set(active.flatMap(d=>(d.groups||[]).map(Model.id)));
  const relevant=groups.filter(g=>g.id&&g.name&&Model.groupMembers(g.id,groups)&&
    [...Model.groupMembers(g.id,groups)].some(id=>seen.has(id)));
  relevant.sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));
  $('groupFilter').innerHTML='<option value="">Frota total acessível</option>'+relevant.map(g=>
    '<option value="'+safe(g.id)+'">'+safe(g.name)+'</option>').join('');
}
function fillVehicles(){
  const previous=$('vehicleFilter').value;
  const scoped=Model.devicesInScope(devices,groups,$('groupFilter').value,'');
  $('vehicleFilter').innerHTML='<option value="">Todos os veículos</option>'+scoped.sort((a,b)=>String(a.name||a.licensePlate||'').localeCompare(String(b.name||b.licensePlate||''),'pt-BR')).map(d=>
    '<option value="'+safe(d.id)+'">'+safe(d.name||d.licensePlate||d.id)+'</option>').join('');
  if([...$('vehicleFilter').options].some(v=>v.value===previous))$('vehicleFilter').value=previous;
}
function localInput(d){const pad=x=>String(x).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());}
function toggleDates(){
  const show=$('periodFilter').value==='custom';
  $('customFromWrap').hidden=!show;$('customToWrap').hidden=!show;
  if(show&&!$('fromInput').value){const d=new Date(),b=new Date(d.getTime()-7*86400000);$('fromInput').value=localInput(b);$('toInput').value=localInput(d);}
}
function invalidate(){
  token++;
  last=null;loading=false;
  $('cancelBtn').hidden=true;$('loadBtn').disabled=false;
  $('groupCsv').disabled=true;$('vehicleCsv').disabled=true;
  $('progressWrap').hidden=true;
  $('status').textContent=api?'Filtros alterados':'Aguardando MyGeotab';
  message('Filtros alterados. Clique em Consultar para atualizar os resultados.');
}
function updateProgress(done,total){
  $('progressFill').style.width=(total?100*done/total:0).toFixed(1)+'%';
  $('progressText').textContent=done+' / '+total+' veículos processados';
}
function resetVisual(){
  $('kpiBox').querySelectorAll('.value').forEach(e=>e.textContent='N/D');
  $('groupChart').innerHTML='';
  $('groupRows').innerHTML='<tr><td colspan="3">Sem resultados consolidados</td></tr>';
  $('vehicleRows').innerHTML='<tr><td colspan="5">Sem resultados consolidados</td></tr>';
  $('notes').innerHTML='<li>Os resultados só são exibidos quando a consulta completa terminar.</li>';
}
function card(title,value,note){return '<article class="kpi"><span>'+safe(title)+'</span><strong class="value">'+safe(value)+'</strong><small class="context">'+safe(note)+'</small></article>';}
function primaryLabel(total){return total.vehicles+' veículo(s) · '+total.trips+' viagens no período · '+total.withOdometer+' com odômetro disponível';}
function render(summary,period,selected){
  last={summary,period,selected};
  $('kpiBox').innerHTML=[
    card('KM total rodado',fmt(summary.km,1)+' km','Soma das viagens de todos os veículos elegíveis'),
    card('Frota selecionada',String(summary.vehicles),'Todos os veículos do filtro, com e sem viagem'),
    card('Média por veículo',summary.average==null?'N/D':fmt(summary.average,1)+' km','KM total dividido por veículos selecionados'),
    card('Veículos sem viagem',String(summary.stopped),'Sem viagens retornadas no período')
  ].join('');
  const max=Math.max(1,...summary.groupsRows.map(g=>g.km));
  $('groupChart').innerHTML=summary.groupsRows.slice(0,10).map(g=>
    '<div class="bar-item"><span class="bar-name" title="'+safe(g.name)+'">'+safe(g.name)+'</span><div class="bar-rail"><div class="bar-fill" style="width:'+Math.min(100,100*g.km/max)+'%"></div></div><span class="bar-value">'+fmt(g.km,1)+' km</span></div>'
  ).join('')||'<p class="hint">Nenhum grupo identificado.</p>';
  $('groupRows').innerHTML=summary.groupsRows.length?summary.groupsRows.map(g=>
    '<tr><td>'+safe(g.name)+'</td><td>'+g.vehicles+'</td><td>'+fmt(g.km,1)+'</td></tr>'
  ).join(''):'<tr><td colspan="3">Sem grupo para exibir</td></tr>';
  $('vehicleRows').innerHTML=summary.vehiclesRows.length?summary.vehiclesRows.map(v=>
    '<tr><td><b>'+safe(v.name)+'</b>'+(v.plate?'<span class="data-note">'+safe(v.plate)+'</span>':'')+'</td><td>'+v.tripCount+'</td><td><b>'+fmt(v.km,1)+'</b></td><td>'+(v.odoStart==null?'N/D':fmt(v.odoStart,1))+'</td><td>'+(v.odoEnd==null?'N/D':fmt(v.odoEnd,1))+'</td></tr>'
  ).join(''):'<tr><td colspan="5">Sem veículos elegíveis</td></tr>';
  const notes=[
    'O total corresponde às viagens retornadas pela API Trip dentro da janela filtrada. Não é leitura de odômetro da frota.',
    'Odômetros: Trip.odometer vem em metros. O início é inferido do odômetro da primeira viagem menos sua distância; não é uma medição direta da hora inicial.',
    'Os dados são consultados somente no escopo permitido pela conta MyGeotab e na seleção atual.',
    'Não há contagem duplicada de veículos com vários grupos: eles são exibidos no grupo exclusivo “Múltiplos grupos”.'
  ];
  if(summary.boundaryTrips)notes.push(summary.boundaryTrips+' viagem(ns) cruzaram o limite do período e foram contadas integralmente; o KM exato apenas dentro do limite exige telemetria de fronteira.');
  if(summary.withOdometer<summary.vehicles)notes.push(summary.vehicles-summary.withOdometer+' veículo(s) sem odômetro confiável na seleção: exibidos como N/D.');
  $('notes').innerHTML=notes.map(n=>'<li>'+safe(n)+'</li>').join('');
  $('scope').textContent=period.label+' · '+dt(period.from)+' até '+dt(period.to)+' · '+primaryLabel(summary);
  $('groupCsv').disabled=false;$('vehicleCsv').disabled=false;
  message('Consulta completa. '+primaryLabel(summary)+'.','ok');
}
async function load(){
  if(!api){message('Abra este Add-In dentro do MyGeotab para buscar dados reais.','err');return;}
  if(loading){invalidate();}
  const req=++token;
  loading=true;$('loadBtn').disabled=true;$('cancelBtn').hidden=false;$('progressWrap').hidden=false;resetVisual();
  try{
    await bootstrap();checkToken(req);
    const period=Model.range($('periodFilter').value,$('fromInput').value,$('toInput').value);
    const ds=Model.devicesInScope(devices,groups,$('groupFilter').value,$('vehicleFilter').value);
    const full=new Map();let i=0,done=0;
    updateProgress(0,ds.length);
    message('Consultando '+ds.length+' veículo(s). A conclusão depende do volume de viagens...');
    const workers=Array.from({length:Math.min(3,ds.length)},async()=>{
      while(i<ds.length){
        checkToken(req);
        const d=ds[i++];
        const trips=await tripsInWindow(d,period.from,period.to,req);
        checkToken(req);
        const result=Model.summarizeVehicle(d,trips,period);
        if(result.invalidCount)throw Error('Distâncias inválidas para '+(d.name||d.id)+'. Consulta interrompida para evitar total parcial.');
        full.set(String(d.id),result);
        done++;updateProgress(done,ds.length);
      }
    });
    await Promise.all(workers);checkToken(req);
    if(done!==ds.length)throw Error('Consulta incompleta: nem todos os veículos foram processados.');
    const summary=Model.summarizeFleet(ds,full,groups,$('groupFilter').value);
    render(summary,period,ds);
    $('status').textContent='Consulta concluída';
  }catch(e){
    if(req!==token)return;
    resetVisual();
    message(e.message==='CONSULTA_CANCELADA'?'Consulta cancelada.':'Consulta não concluída: '+String(e.message||e)+'. Nenhum total parcial foi apresentado.','err');
    $('status').textContent='Sem dados completos';
  }finally{
    if(req===token){loading=false;$('loadBtn').disabled=false;$('cancelBtn').hidden=true;$('progressWrap').hidden=true;}
  }
}
function csvValue(v){let s=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportCsv(which){
  if(!last)return;
  const rows=which==='groups'
    ? [['Grupo','Veículos','Viagens','KM rodado'],...last.summary.groupsRows.map(x=>[x.name,x.vehicles,x.trips,x.km.toFixed(2)])]
    : [['Veículo','Placa','Viagens','KM rodado','Odômetro inicial estimado km','Odômetro final km','Origem'],...last.summary.vehiclesRows.map(x=>[x.name,x.plate,x.tripCount,x.km.toFixed(2),x.odoStart==null?'N/D':x.odoStart.toFixed(2),x.odoEnd==null?'N/D':x.odoEnd.toFixed(2),x.odoOrigin])];
  const content='\ufeff'+rows.map(row=>row.map(csvValue).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download='quilometragem-'+which+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function start(client){
  api=client||null;
  $('loadBtn').addEventListener('click',load);
  $('cancelBtn').addEventListener('click',()=>{invalidate();message('Consulta cancelada. Nenhum resultado parcial será exportado.');});
  $('groupFilter').addEventListener('change',()=>{fillVehicles();invalidate();});
  $('vehicleFilter').addEventListener('change',invalidate);
  $('periodFilter').addEventListener('change',()=>{toggleDates();invalidate();});
  $('fromInput').addEventListener('change',invalidate);
  $('toInput').addEventListener('change',invalidate);
  $('groupCsv').addEventListener('click',()=>exportCsv('groups'));
  $('vehicleCsv').addEventListener('click',()=>exportCsv('vehicles'));
  toggleDates();
  if(api)bootstrap().catch(e=>message('Falha ao carregar frota: '+String(e.message||e),'err'));
  else message('Abra dentro do MyGeotab. Esta página não contém dados de clientes nem demonstrações fictícias.','err');
}
window.geotab=window.geotab||{};window.geotab.addin=window.geotab.addin||{};
window.geotab.addin.fleetTelemetryManager=function(){return {
  initialize:function(client,state,cb){try{start(client);}catch(e){console.error(e);message('Erro ao iniciar: '+String(e.message||e),'err');}if(cb)cb();},
  focus:function(){},blur:function(){}
};};
})();
