/* Consulta Geotab: lote por veículo, limite adaptativo, sem truncar o total da frota. */
(function(){
'use strict';
const Model=window.FleetMileageModel;
const $=id=>document.getElementById(id);
const LIMIT=4000,MIN_WINDOW=60000;
let api=null,devices=[],groups=[],loaded=false,loading=false,token=0,last=null,rateSlot=0,bootstrapPromise=null,demoMode=false,filters=null,fullReport=null,focusGroupId=null;
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
  if(bootstrapPromise)return bootstrapPromise;
  bootstrapPromise=(async()=>{
    message('Carregando frota e grupos autorizados...');
    const res=await Promise.allSettled([call('Device',{},50000),call('Group',{},10000)]);
    if(res[0].status==='rejected')throw Error('Sem acesso ao cadastro de veículos: '+String(res[0].reason));
    if(res[1].status==='rejected')throw Error('Sem acesso aos grupos: '+String(res[1].reason));
    devices=res[0].value||[];groups=res[1].value||[];
    if(devices.length>=50000||groups.length>=10000)throw Error('Cadastros no limite de resposta: não é seguro fazer o cálculo sem paginação dos cadastros.');
    fillGroups();fillVehicles();
    loaded=true;
    $('status').textContent='MyGeotab conectado';
    message('Frota carregada ('+devices.length+' cadastros). Escolha os filtros e clique em Consultar.','ok');
  })();
  try{return await bootstrapPromise;}
  finally{bootstrapPromise=null;}
}
function fillGroups(){filters.setData(devices,groups);}
function fillVehicles(){filters.refreshVehicles();}

function localInput(d){const pad=x=>String(x).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());}
function toggleDates(){
  const show=$('periodFilter').value==='custom';
  $('customFromWrap').hidden=!show;$('customToWrap').hidden=!show;
  if(show&&!$('fromInput').value){const d=new Date(),b=new Date(d.getTime()-7*86400000);$('fromInput').value=localInput(b);$('toInput').value=localInput(d);}
}
function invalidate(){
  token++;
  fullReport=null;focusGroupId=null;last=null;
  $('clearGroupFocus').hidden=true;
  $('groupFocusStatus').textContent='Visão completa dos grupos consultados.';
  last=null;loading=false;
  $('cancelBtn').hidden=true;$('loadBtn').disabled=false;
  $('groupCsv').disabled=true;$('vehicleCsv').disabled=true;$('pdfBtn').disabled=true;
  $('progressWrap').hidden=true;
  resetVisual();
  $('scope').textContent='Filtros alterados. Clique em Consultar para carregar os dados da nova seleção.';
  $('status').textContent=api?'Filtros alterados':'Aguardando MyGeotab';
  message('Filtros alterados. Clique em Consultar para atualizar os resultados.');
}
function updateProgress(done,total){
  $('progressFill').style.width=(total?100*done/total:0).toFixed(1)+'%';
  $('progressText').textContent=done+' / '+total+' veículos processados';
}
function resetVisual(){
  $('kpiBox').querySelectorAll('.value').forEach(e=>e.textContent='N/D');
  $('trendChart').innerHTML='<div class="trend-placeholder">Consulte a frota para visualizar a evolução.</div>';
  $('topVehicles').innerHTML='<div class="trend-placeholder">Consulte a frota para visualizar o ranking.</div>';
  $('trendInfo').textContent='Aguardando dados de viagens.';
  $('trendPeriod').textContent='Sem período consultado';
  $('groupChart').innerHTML='';
  $('groupFocusStatus').textContent='Visão completa dos grupos consultados.';
  $('clearGroupFocus').hidden=true;
  $('groupRows').innerHTML='<tr><td colspan="3">Sem resultados consolidados</td></tr>';
  $('vehicleRows').innerHTML='<tr><td colspan="5">Sem resultados consolidados</td></tr>';
  $('notes').innerHTML='<li>Os resultados só são exibidos quando a consulta completa terminar.</li>';
}
function card(title,value,note){return '<article class="kpi"><span>'+safe(title)+'</span><strong class="value">'+safe(value)+'</strong><small class="context">'+safe(note)+'</small></article>';}
function primaryLabel(total){return total.vehicles+' veículo(s) · '+total.trips+' viagens no período · '+total.withOdometer+' com odômetro disponível';}
function renderVisualDashboard(summary,period){
  const trend=Model.dailySeries(summary.dailyRows||[],period);
  const max=Math.max(0,...trend.map(x=>x.km));
  const peak=trend.reduce((a,b)=>b.km>a.km?b:a,trend[0]||{label:'-',km:0});
  const total=trend.reduce((n,x)=>n+x.km,0);
  $('trendPeriod').textContent=period.label;
  $('trendChart').innerHTML=window.FleetMileageDailyChart.svg(trend);
  $('trendChart').setAttribute('aria-label','Evolução diária da quilometragem: '+trend.map(x=>x.label+' '+fmt(x.km,1)+' km').join('; '));
  $('trendInfo').textContent=trend.length+' dias · Pico: '+peak.label+' ('+fmt(max,1)+' km) · Total diário: '+fmt(total,1)+' km';
  const top=summary.vehiclesRows.slice(0,5),maxTop=Math.max(1,...top.map(x=>x.km));
  $('topVehicles').innerHTML=top.length?top.map((v,i)=>
    '<div class="top-row"><div class="top-label"><span title="'+safe(v.name)+'">'+(i+1)+'. '+safe(v.name)+'</span><strong>'+fmt(v.km,1)+' km</strong></div>'+
    '<div class="top-track"><div class="top-fill" style="width:'+Math.min(100,100*v.km/maxTop)+'%"></div></div></div>'
  ).join(''):'<div class="trend-placeholder">Nenhum veículo elegível.</div>';
  return trend;
}
function render(summary,period,selected){
  fullReport={summary,period,selected};
  focusGroupId=null;
  renderFocusedView();
}
function renderFocusedView(){
  if(!fullReport)return;
  const {summary:all,period,selected}=fullReport;
  const focus=focusGroupId===null?null:all.groupsRows.find(g=>String(g.groupId)===String(focusGroupId));
  if(focusGroupId!==null&&!focus){focusGroupId=null;}
  const chosen=focusGroupId===null?null:all.groupsRows.find(g=>String(g.groupId)===String(focusGroupId));
  const summary=chosen?Model.focusSummary(all,chosen.groupId):all;
  const trend=renderVisualDashboard(summary,period);
  last={summary,period,selected,trend,groupFocus:chosen?{id:chosen.groupId,name:chosen.name}:null};
  $('groupFocusStatus').textContent=chosen?'Grupo em foco: '+chosen.name+' · '+summary.vehicles+' veículo(s) e '+fmt(summary.km,1)+' km. Clique em outro grupo para trocar.':'Visão completa dos grupos consultados.';
  $('clearGroupFocus').hidden=!chosen;
  $('kpiBox').innerHTML=[
    card('KM total rodado',fmt(summary.km,1)+' km','Soma das viagens de todos os veículos elegíveis'),
    card('Frota selecionada',String(summary.vehicles),'Todos os veículos do filtro, com e sem viagem'),
    card('Média por veículo',summary.average==null?'N/D':fmt(summary.average,1)+' km','KM total dividido por veículos selecionados'),
    card('Veículos sem viagem',String(summary.stopped),'Sem viagens retornadas no período')
  ].join('');
  // Navegação sempre usa o resultado completo; demais seções mostram somente o grupo em foco.
  const max=Math.max(1,...all.groupsRows.map(g=>g.km));
  const groupClass=g=>!chosen?'':String(g.groupId)===String(chosen.groupId)?' is-focused':' is-dim';
  const selectedGroup=g=>!!chosen&&String(g.groupId)===String(chosen.groupId);
  $('groupChart').innerHTML=all.groupsRows.slice(0,10).map(g=>
    '<button type="button" class="bar-item group-action'+groupClass(g)+'" data-group-id="'+safe(g.groupId)+'" aria-pressed="'+selectedGroup(g)+'" title="Mostrar apenas '+safe(g.name)+'">'+
      '<span class="bar-name">'+safe(g.name)+'</span><span class="bar-rail"><span class="bar-fill" style="width:'+Math.min(100,100*g.km/max)+'%"></span></span><span class="bar-value">'+fmt(g.km,1)+' km</span></button>'
  ).join('')||'<p class="hint">Nenhum grupo identificado.</p>';
  $('groupRows').innerHTML=all.groupsRows.length?all.groupsRows.map(g=>
    '<tr class="group-result-row'+groupClass(g)+'" data-group-id="'+safe(g.groupId)+'"><td><button type="button" class="group-table-button" data-group-id="'+safe(g.groupId)+'" aria-pressed="'+selectedGroup(g)+'" title="Mostrar apenas '+safe(g.name)+'">'+safe(g.name)+'</button></td><td>'+g.vehicles+'</td><td>'+fmt(g.km,1)+'</td></tr>'
  ).join(''):'<tr><td colspan="3">Sem grupo para exibir</td></tr>';
  $('vehicleRows').innerHTML=summary.vehiclesRows.length?summary.vehiclesRows.map(v=>
    '<tr><td><b>'+safe(v.name)+'</b>'+(v.plate?'<span class="data-note">'+safe(v.plate)+'</span>':'')+'</td><td>'+v.tripCount+'</td><td><b>'+fmt(v.km,1)+'</b></td><td>'+(v.odoStart==null?'N/D':fmt(v.odoStart,1))+'</td><td>'+(v.odoEnd==null?'N/D':fmt(v.odoEnd,1))+'</td></tr>'
  ).join(''):'<tr><td colspan="5">Sem veículos elegíveis</td></tr>';
  const notes=[
    'O total corresponde às viagens retornadas pela API Trip dentro da janela filtrada. Não é leitura de odômetro da frota.',
    'A evolução apresenta um ponto por dia; dias sem viagens aparecem com 0 km. Para períodos longos, arraste o gráfico horizontalmente.',
    'Odômetros: Trip.odometer vem em metros. O início é inferido do odômetro da primeira viagem menos sua distância; não é uma medição direta da hora inicial.',
    'Os dados são consultados somente no escopo permitido pela conta MyGeotab e na seleção atual.',
    'Não há contagem duplicada de veículos com vários grupos: eles são exibidos no grupo exclusivo “Múltiplos grupos”.'
  ];
  if(summary.boundaryTrips)notes.push(summary.boundaryTrips+' viagem(ns) cruzaram o limite do período e foram contadas integralmente. No gráfico diário, essas viagens são atribuídas ao primeiro/último dia do intervalo se começaram fora dele.');
  if(summary.withOdometer<summary.vehicles)notes.push(summary.vehicles-summary.withOdometer+' veículo(s) sem odômetro confiável na seleção: exibidos como N/D.');
  $('notes').innerHTML=notes.map(n=>'<li>'+safe(n)+'</li>').join('');
  $('scope').textContent=(demoMode?'SIMULAÇÃO · ':'')+period.label+' · '+dt(period.from)+' até '+dt(period.to)+(chosen?' · Grupo em foco: '+chosen.name:'')+' · '+primaryLabel(summary);
  $('groupCsv').disabled=false;$('vehicleCsv').disabled=false;$('pdfBtn').disabled=false;
  message((demoMode?'SIMULAÇÃO COM DADOS FICTÍCIOS. ':'Consulta completa. ')+(chosen?'Grupo em foco: '+chosen.name+'. ':'')+primaryLabel(summary)+'.',demoMode?'err':'ok');
}
function selectResultGroup(event){
  const target=event.target.closest('[data-group-id]');
  if(!target||!fullReport)return;
  const groupId=String(target.dataset.groupId||'');
  if(!fullReport.summary.groupsRows.some(g=>String(g.groupId)===groupId))return;
  focusGroupId=focusGroupId===groupId?null:groupId;
  renderFocusedView();
}
function clearResultGroup(){
  if(!fullReport)return;
  focusGroupId=null;
  renderFocusedView();
}
function bootDemo(){
  demoMode=true;loaded=true;
  groups=[
    {id:'grupo-norte',name:'Operação Norte',children:[{id:'base-norte'}]},
    {id:'base-norte',name:'Base Norte',children:[]},
    {id:'grupo-sul',name:'Operação Sul',children:[]},
    {id:'grupo-central',name:'Operação Central',children:[]}
  ];
  devices=Array.from({length:12},(_,i)=>({
    id:'teste-'+(i+1),name:'TESTE-'+String(i+1).padStart(3,'0'),licensePlate:'AAA'+String(1000+i),
    groups:i===8?[{id:'base-norte'},{id:'grupo-central'}]:
      [{id:i%3===0?'base-norte':i%3===1?'grupo-sul':'grupo-central'}]
  }));
  fillGroups();fillVehicles();
  $('status').textContent='PRÉVIA FICTÍCIA';
  $('scope').textContent='Dados demonstrativos inventados, sem conexão com uma base Geotab.';
  message('PRÉVIA VISUAL: todos os dados deste modo são fictícios. Para dados reais, instale o Add-In no MyGeotab.','err');
}
function fakeTrips(device){
  const i=Number(device.id.split('-').pop()),result=[];
  if(i===12||i===11)return result; // Duas unidades sem viagem para conferir o KPI.
  const now=new Date(),base=new Date(now.getFullYear(),now.getMonth()-2,1);
  let odometer=115000000+i*6500000,n=0;
  for(let month=0;month<3;month++){
    for(let day=2;day<=27;day+=4){
      const start=new Date(base.getFullYear(),base.getMonth()+month,day,8+(i%4),0);
      const end=new Date(start.getTime()+75*60000);
      if(start.getTime()>now.getTime())continue;
      const km=12+i*3+(day%7);odometer+=km*1000;
      result.push({id:'demo-'+device.id+'-'+(++n),start:start.toISOString(),stop:end.toISOString(),distance:km,odometer});
    }
  }
  return result;
}
function renderDemo(){
  try{
    const period=Model.range($('periodFilter').value,$('fromInput').value,$('toInput').value);
    const ds=filters.scope();
    const map=new Map();
    for(const d of ds){
      const selected=fakeTrips(d).filter(t=>new Date(t.start)<=period.to&&new Date(t.stop)>=period.from);
      map.set(String(d.id),Model.summarizeVehicle(d,selected,period));
    }
    render(Model.summarizeFleet(ds,map,groups,filters.groups()),period,ds);
    $('status').textContent='PRÉVIA FICTÍCIA';
    message('PRÉVIA VISUAL COM DADOS FICTÍCIOS: filtros, totais e ranking calculados sobre veículos de exemplo.','err');
    $('scope').textContent='SIMULAÇÃO · '+period.label+' · '+ds.length+' veículos fictícios. Não representa cliente ou base Geotab.';
    $('notes').insertAdjacentHTML('afterbegin','<li><strong>SIMULAÇÃO:</strong> esta visualização foi gerada apenas para conferir a interface e filtros. Nenhuma informação real foi consultada.</li>');
  }catch(e){message('Filtro da prévia inválido: '+String(e.message||e),'err');}
}
async function load(){
  if(demoMode){renderDemo();return;}
  if(!api){message('Abra este Add-In dentro do MyGeotab para buscar dados reais.','err');return;}
  if(loading){invalidate();}
  const req=++token;
  loading=true;fullReport=null;focusGroupId=null;last=null;$('loadBtn').disabled=true;$('cancelBtn').hidden=false;$('progressWrap').hidden=false;resetVisual();
  try{
    await bootstrap();checkToken(req);
    const period=Model.range($('periodFilter').value,$('fromInput').value,$('toInput').value);
    const ds=filters.scope();
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
    const summary=Model.summarizeFleet(ds,full,groups,filters.groups());
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
function downloadPdf(){
  if(!last||!window.FleetMileagePdf){message('Consulte os dados e tente baixar o PDF novamente.','err');return;}
  const groupNames=last.groupFocus?[last.groupFocus.name]:filters.groups().map(id=>(groups.find(g=>String(g.id)===id)||{}).name||id);
  const vehicleNames=filters.vehicles().map(id=>(devices.find(d=>String(d.id)===id)||{}).name||id);
  try{
    window.FleetMileagePdf.save({...last,groupNames,vehicleNames,demo:demoMode});
    message(demoMode?'PDF de simulação baixado. Os dados são fictícios.':'PDF de quilometragem gerado com a consulta completa e os filtros selecionados.','ok');
  }catch(e){console.error(e);message('Falha ao gerar PDF: '+String(e.message||e),'err');}
}
function start(client){
  api=client||null;
  filters=window.FleetMileageFilters.create({model:Model,onChange:()=>{invalidate();if(demoMode)renderDemo();}});
  filters.init();
  $('loadBtn').addEventListener('click',load);
  $('cancelBtn').addEventListener('click',()=>{invalidate();message('Consulta cancelada. Nenhum resultado parcial será exportado.');});
  $('periodFilter').addEventListener('change',()=>{toggleDates();invalidate();});
  $('fromInput').addEventListener('change',invalidate);
  $('toInput').addEventListener('change',invalidate);
  $('groupCsv').addEventListener('click',()=>exportCsv('groups'));
  $('vehicleCsv').addEventListener('click',()=>exportCsv('vehicles'));
  $('pdfBtn').addEventListener('click',downloadPdf);
  $('groupChart').addEventListener('click',selectResultGroup);
  $('groupRows').addEventListener('click',selectResultGroup);
  $('clearGroupFocus').addEventListener('click',clearResultGroup);
  toggleDates();
  if(api)bootstrap().catch(e=>message('Falha ao carregar frota: '+String(e.message||e),'err'));
  else if(demoMode)bootDemo();
  else message('Abra dentro do MyGeotab para carregar dados reais.','err');
}
if(new URLSearchParams(window.location.search).get('demo')==='1'){demoMode=true;start(null);renderDemo();}
window.geotab=window.geotab||{};window.geotab.addin=window.geotab.addin||{};
window.geotab.addin.fleetTelemetryManager=function(){return {
  initialize:function(client,state,cb){try{start(client);}catch(e){console.error(e);message('Erro ao iniciar: '+String(e.message||e),'err');}if(cb)cb();},
  focus:function(){},blur:function(){}
};};
})();
