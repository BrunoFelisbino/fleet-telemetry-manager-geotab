/* Consulta Geotab: lote por veículo, limite adaptativo, sem truncar o total da frota. */
(function(){
'use strict';
const Model=window.FleetMileageModel;
const $=id=>document.getElementById(id);
const LIMIT=4000,MIN_WINDOW=60000;
let api=null,devices=[],groups=[],loaded=false,loading=false,token=0,last=null,rateSlot=0,bootstrapPromise=null,demoMode=false,filters=null;
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
  last=null;loading=false;
  $('cancelBtn').hidden=true;$('loadBtn').disabled=false;
  $('groupCsv').disabled=true;$('vehicleCsv').disabled=true;$('pdfBtn').disabled=true;
  $('groupCardSearch').disabled=true;
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
  $('trendChart').innerHTML='<div class="trend-placeholder">Consulte a frota para visualizar a evolução.</div>';
  $('topVehicles').innerHTML='<div class="trend-placeholder">Consulte a frota para visualizar o ranking.</div>';
  $('trendInfo').textContent='Aguardando dados de viagens.';
  $('trendPeriod').textContent='Sem período consultado';
  $('groupChart').innerHTML='';
  $('groupCardCount').textContent='Aguardando consulta';
  $('groupCardSearch').disabled=true;
  $('groupCardClear').hidden=!$('groupCardSearch').value;
  $('groupRows').innerHTML='<tr><td colspan="3">Sem resultados consolidados</td></tr>';
  $('vehicleRows').innerHTML='<tr><td colspan="5">Sem resultados consolidados</td></tr>';
  $('notes').innerHTML='<li>Os resultados só são exibidos quando a consulta completa terminar.</li>';
}
function card(title,value,note){return '<article class="kpi"><span>'+safe(title)+'</span><strong class="value">'+safe(value)+'</strong><small class="context">'+safe(note)+'</small></article>';}
function primaryLabel(total){return total.vehicles+' veículo(s) · '+total.trips+' viagens no período · '+total.withOdometer+' com odômetro disponível';}
function renderLineTrend(trend){
  if(!trend.length)return '<div class="trend-placeholder">Não há dados de viagens neste período.</div>';
  const width=800,height=215,left=55,right=14,top=14,bottom=34;
  const plotWidth=width-left-right,plotHeight=height-top-bottom,baseline=top+plotHeight;
  const max=Math.max(1,...trend.map(row=>Number(row.km)||0));
  const ceiling=max*1.12;
  const x=i=>left+(trend.length===1?plotWidth/2:plotWidth*i/(trend.length-1));
  const y=value=>top+plotHeight*(1-Math.max(0,Number(value)||0)/ceiling);
  const pt=trend.map((row,i)=>[x(i),y(row.km)]);
  const n=value=>Number(value).toFixed(1);
  const axis=value=>value>=1000?fmt(value/1000,value>=10000?0:1)+' mil':fmt(value,0);
  const line=pt.map(([xx,yy],i)=>(i?'L':'M')+n(xx)+' '+n(yy)).join(' ');
  const area='M'+n(pt[0][0])+' '+n(baseline)+' '+line.replace(/^M/,' L')+' L'+n(pt[pt.length-1][0])+' '+n(baseline)+' Z';
  const grid=Array.from({length:5},(_,i)=>{
    const yy=top+plotHeight*i/4,km=ceiling*(1-i/4);
    return '<line class="km-grid" x1="'+left+'" y1="'+n(yy)+'" x2="'+(width-right)+'" y2="'+n(yy)+'"/>'+
      '<text class="km-axis" x="'+(left-8)+'" y="'+n(yy+4)+'" text-anchor="end">'+safe(axis(km))+'</text>';
  }).join('');
  const tickStep=Math.max(1,Math.ceil((trend.length-1)/7));
  const labels=trend.map((row,i)=>{
    if(i!==0&&i!==trend.length-1&&i%tickStep!==0)return '';
    const anchor=i===0?'start':i===trend.length-1?'end':'middle';
    return '<text class="km-axis km-date" x="'+n(x(i))+'" y="'+(height-8)+'" text-anchor="'+anchor+'">'+safe(row.label.split('–')[0])+'</text>';
  }).join('');
  const marks=trend.map((row,i)=>{
    const label=safe(row.label+': '+fmt(row.km,1)+' km');
    return '<circle class="km-point" cx="'+n(pt[i][0])+'" cy="'+n(pt[i][1])+'" r="4" tabindex="0" aria-label="'+label+'"><title>'+label+'</title></circle>';
  }).join('');
  return '<svg class="km-trend-svg" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    '<defs><linearGradient id="kmTrendShade" x1="0" y1="0" x2="0" y2="1">'+
    '<stop offset="0%" stop-color="#48c7ec" stop-opacity=".30"/>'+
    '<stop offset="100%" stop-color="#48c7ec" stop-opacity="0"/></linearGradient></defs>'+
    grid+'<path class="km-area" d="'+area+'" fill="url(#kmTrendShade)"/>'+
    '<path class="km-line" d="'+line+'" fill="none"/>'+marks+labels+'</svg>';
}
function visibleGroupRows(){
  return last?Model.filterGroupRows(last.summary.groupsRows,$('groupCardSearch').value):[];
}
function renderGroupCard(){
  const rows=visibleGroupRows();
  const max=Math.max(1,...rows.map(g=>g.km));
  $('groupChart').innerHTML=rows.slice(0,10).map(g=>
    '<div class="bar-item"><span class="bar-name" title="'+safe(g.name)+'">'+safe(g.name)+'</span><div class="bar-rail"><div class="bar-fill" style="width:'+Math.min(100,100*g.km/max)+'%"></div></div><span class="bar-value">'+fmt(g.km,1)+' km</span></div>'
  ).join('')||'<p class="hint">'+(last?'Nenhum grupo corresponde ao filtro.':'Nenhum grupo identificado.')+'</p>';
  $('groupRows').innerHTML=rows.length?rows.map(g=>
    '<tr><td>'+safe(g.name)+'</td><td>'+g.vehicles+'</td><td>'+fmt(g.km,1)+'</td></tr>'
  ).join(''):'<tr><td colspan="3">Nenhum grupo encontrado</td></tr>';
  $('groupCardCount').textContent=last?rows.length+' de '+last.summary.groupsRows.length+' grupo(s)':'Aguardando consulta';
  $('groupCardClear').hidden=!$('groupCardSearch').value;
  $('groupCsv').disabled=!last||rows.length===0;
}

function renderVisualDashboard(summary,period){
  const trend=Model.trendBuckets(summary.dailyRows||[],period,16);
  const max=Math.max(0,...trend.map(x=>x.km));
  $('trendPeriod').textContent=period.label;
  $('trendChart').innerHTML=renderLineTrend(trend);
  $('trendChart').setAttribute('aria-label','Quilometragem do período: '+trend.map(x=>x.label+' '+fmt(x.km,1)+' km').join('; '));
  $('trendInfo').textContent=trend.length+' intervalos · Maior intervalo: '+fmt(max,1)+' km';
  const top=summary.vehiclesRows.slice(0,5),maxTop=Math.max(1,...top.map(x=>x.km));
  $('topVehicles').innerHTML=top.length?top.map((v,i)=>
    '<div class="top-row"><div class="top-label"><span title="'+safe(v.name)+'">'+(i+1)+'. '+safe(v.name)+'</span><strong>'+fmt(v.km,1)+' km</strong></div>'+
    '<div class="top-track"><div class="top-fill" style="width:'+Math.min(100,100*v.km/maxTop)+'%"></div></div></div>'
  ).join(''):'<div class="trend-placeholder">Nenhum veículo elegível.</div>';
  return trend;
}
function render(summary,period,selected){
  const trend=renderVisualDashboard(summary,period);
  last={summary,period,selected,trend};
  $('kpiBox').innerHTML=[
    card('KM total rodado',fmt(summary.km,1)+' km','Soma das viagens de todos os veículos elegíveis'),
    card('Frota selecionada',String(summary.vehicles),'Todos os veículos do filtro, com e sem viagem'),
    card('Média por veículo',summary.average==null?'N/D':fmt(summary.average,1)+' km','KM total dividido por veículos selecionados'),
    card('Veículos sem viagem',String(summary.stopped),'Sem viagens retornadas no período')
  ].join('');
  $('groupCardSearch').disabled=false;
  renderGroupCard();
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
  $('groupCsv').disabled=false;$('vehicleCsv').disabled=false;$('pdfBtn').disabled=false;
  message('Consulta completa. '+primaryLabel(summary)+'.','ok');
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
  loading=true;$('loadBtn').disabled=true;$('cancelBtn').hidden=false;$('progressWrap').hidden=false;resetVisual();
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
    ? [['Grupo','Veículos','Viagens','KM rodado'],...visibleGroupRows().map(x=>[x.name,x.vehicles,x.trips,x.km.toFixed(2)])]
    : [['Veículo','Placa','Viagens','KM rodado','Odômetro inicial estimado km','Odômetro final km','Origem'],...last.summary.vehiclesRows.map(x=>[x.name,x.plate,x.tripCount,x.km.toFixed(2),x.odoStart==null?'N/D':x.odoStart.toFixed(2),x.odoEnd==null?'N/D':x.odoEnd.toFixed(2),x.odoOrigin])];
  const content='\ufeff'+rows.map(row=>row.map(csvValue).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download='quilometragem-'+which+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadPdf(){
  if(!last||!window.FleetMileagePdf){message('Consulte os dados e tente baixar o PDF novamente.','err');return;}
  const groupNames=filters.groups().map(id=>(groups.find(g=>String(g.id)===id)||{}).name||id);
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
  $('groupCardSearch').addEventListener('input',renderGroupCard);
  $('groupCardClear').addEventListener('click',()=>{$('groupCardSearch').value='';renderGroupCard();$('groupCardSearch').focus();});
  $('groupCsv').addEventListener('click',()=>exportCsv('groups'));
  $('vehicleCsv').addEventListener('click',()=>exportCsv('vehicles'));
  $('pdfBtn').addEventListener('click',downloadPdf);
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
