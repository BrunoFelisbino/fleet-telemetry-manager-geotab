/* Fleet Telemetry Manager - indicadores do processo "Gerir Telemetria". */
(function () {
  'use strict';
  var api = null, allDevices = [], allGroups = [], currentStatus = [], allRules = [], metaReady = false, report = null;
  var LIMIT_VEHICLES = 50, LIMIT_RECORDS = 5000;
  var el = function (id) { return document.getElementById(id); };
  var safe = function (v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
  var rid = function (v) { return v && typeof v === 'object' ? String(v.id || '') : String(v || ''); };
  var fmt = function (n,d) { return Number(n).toLocaleString('pt-BR',{maximumFractionDigits:d||0,minimumFractionDigits:d||0}); };
  function get(type, search, limit) {
    return new Promise(function (ok, fail) {
      if (!api) return fail(new Error('Sem sessão MyGeotab'));
      var args={typeName:type,search:search||{}};
      if(limit)args.resultsLimit=limit;
      api.call('Get',args,ok,fail);
    });
  }
  function active(d) { return !d.activeTo || new Date(d.activeTo).getTime() > Date.now(); }
  function message(t,kind){el('message').textContent=t;el('message').className='alert'+(kind?' '+kind:'');}
  function durationSeconds(v) {
    if(v == null) return null;
    if(typeof v === 'number') return v;
    var m=String(v).match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
    return m ? Number(m[1]||0)*86400+Number(m[2])*3600+Number(m[3])*60+Number(m[4]) : null;
  }
  function currentDevices(onlyGroup) {
    var group=el('groupFilter').value,vehicle=el('vehicleFilter').value;
    return allDevices.filter(active).filter(function(d){
      var groups=d.groups||[];
      var matches=!group||groups.some(function(x){return rid(x)===group;});
      return matches&&(onlyGroup||!vehicle||String(d.id)===vehicle);
    });
  }
  function populateVehicles() {
    var box=el('vehicleFilter'),previous=box.value;
    box.innerHTML='<option value="">Todos os veículos</option>'+currentDevices(true).sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'pt-BR');}).map(function(d){
      return '<option value="'+safe(d.id)+'">'+safe(d.name||d.licensePlate||d.id)+'</option>';
    }).join('');
    if(Array.from(box.options).some(function(o){return o.value===previous;}))box.value=previous;
  }
  function populateGroups() {
    el('groupFilter').innerHTML='<option value="">Todos os grupos</option>'+allGroups.filter(function(x){return x&&x.id&&x.name;}).sort(function(a,b){
      return String(a.name).localeCompare(String(b.name),'pt-BR');
    }).map(function(g){return '<option value="'+safe(g.id)+'">'+safe(g.name)+'</option>';}).join('');
    populateVehicles();
  }
  function card(label,value,goal,detail) {
    return '<article class="kpi"><span>'+safe(label)+'</span><strong class="value">'+safe(value)+'</strong><small class="target">Meta: '+safe(goal)+'</small><span class="context">'+safe(detail)+'</span></article>';
  }
  function initial() {
    var sections=[
      ['availabilityCards',['Disponibilidade da telemetria','Veículos monitorados']],
      ['treatmentCards',['Alertas tratados no prazo','Tempo médio de tratamento']],
      ['safetyCards',['Excesso de velocidade / 1.000 km','Reincidência de ocorrências']],
      ['efficiencyCards',['Marcha lenta por veículo','Consumo médio de combustível']]
    ];
    sections.forEach(function(s){el(s[0]).innerHTML=s[1].map(function(t){return card(t,'N/D','A definir','Aguardando dados ou fonte adequada.');}).join('');});
  }
  function nowStatus(devices) {
    var map=new Map(currentStatus.map(function(s){return [rid(s.device),s];})),rows=[],known=0,communicating=0;
    devices.forEach(function(d){
      var s=map.get(String(d.id)),ok=!!s&&typeof s.isDeviceCommunicating==='boolean';
      if(ok){known++;if(s.isDeviceCommunicating)communicating++;}
      rows.push({name:d.name||d.licensePlate||d.id,last:s&&s.dateTime,status:ok?s.isDeviceCommunicating:null});
    });
    return {rows:rows,pct:devices.length&&known===devices.length?100*communicating/devices.length:null,known:known,communicating:communicating};
  }
  function renderStatus(s) {
    el('qualitySummary').textContent=s.known+' de '+s.rows.length+' veículos com status disponível; '+s.communicating+' comunicando agora. Este dado não representa disponibilidade mensal.';
    var rows=s.rows.slice().sort(function(a,b){return Number(a.status===true)-Number(b.status===true);});
    el('statusRows').innerHTML=rows.length?rows.map(function(v){
      var d=v.last?new Date(v.last):null,date=d&&!isNaN(d.getTime())?d.toLocaleString('pt-BR'):'N/D';
      return '<tr><td>'+safe(v.name)+'</td><td>'+safe(date)+'</td><td><span class="tag '+(v.status===true?'ok':v.status===false?'err':'')+'">'+(v.status===null?'N/D':v.status?'Comunicando':'Sem comunicação')+'</span></td></tr>';
    }).join(''):'<tr><td colspan="3">Nenhum veículo nesta seleção.</td></tr>';
  }
  async function loadMeta() {
    message('Consultando cadastros, grupos, comunicação e regras...');
    var r=await Promise.allSettled([get('Device',{},50000),get('Group',{},5000),get('DeviceStatusInfo',{},50000),get('Rule',{},5000)]);
    if(r[0].status!=='fulfilled')throw new Error('Falha ao consultar Device: '+String(r[0].reason||''));
    allDevices=r[0].value||[];allGroups=r[1].status==='fulfilled'?r[1].value||[]:[];
    currentStatus=r[2].status==='fulfilled'?r[2].value||[]:[];
    allRules=r[3].status==='fulfilled'?r[3].value||[]:[];
    metaReady=true;populateGroups();
    return r.filter(function(x){return x.status!=='fulfilled';}).length;
  }
  async function getHistory(devices,from,to) {
    var result={trips:[],events:[],errors:0,truncated:false},i=0;
    async function worker(){
      while(i<devices.length){
        var d=devices[i++],filter={deviceSearch:{id:d.id},fromDate:from.toISOString(),toDate:to.toISOString()};
        var r=await Promise.allSettled([
          get('Trip',Object.assign({},filter,{includeOverlappedTrips:true}),LIMIT_RECORDS),
          get('ExceptionEvent',Object.assign({},filter,{includeExceptionCount:true}),LIMIT_RECORDS)
        ]);
        if(r[0].status==='fulfilled'){
          if(r[0].value.length>=LIMIT_RECORDS)result.truncated=true;
          (r[0].value||[]).forEach(function(x){result.trips.push(x);});
        }else result.errors++;
        if(r[1].status==='fulfilled'){
          if(r[1].value.length>=LIMIT_RECORDS)result.truncated=true;
          (r[1].value||[]).forEach(function(x){result.events.push(x);});
        }else result.errors++;
      }
    }
    await Promise.all(Array.from({length:Math.min(4,devices.length)},worker));
    return result;
  }
  function calculate(devices,status,history) {
    var speedRules=new Set(allRules.filter(function(r){return /velocidade|speeding|speed limit/i.test(r.name||'');}).map(function(r){return String(r.id);}));
    var km=0,idle=0,idleRecords=0;
    history.trips.forEach(function(t){
      if(Number.isFinite(Number(t.distance))&&Number(t.distance)>=0)km+=Number(t.distance);
      var n=durationSeconds(t.idlingDuration);
      if(n!==null){idleRecords++;idle+=Math.max(0,n);}
    });
    var speedEvents=history.events.filter(function(e){return speedRules.has(rid(e.rule));}).reduce(function(total,e){
      return total+(e.exceptionCount==null?1:Math.max(0,Number(e.exceptionCount)||0));
    },0);
    return {coverage:status.pct,speed:km>0&&speedRules.size?speedEvents/km*1000:null,idle:idleRecords&&devices.length?idle/3600/devices.length:null,km:km,hasSpeedRules:!!speedRules.size};
  }
  function render(devices,stat,h,complete,issues) {
    var m=calculate(devices,stat,h),val=function(x,d,unit){return x==null?'N/D':fmt(x,d)+unit;};
    el('availabilityCards').innerHTML=
      card('Disponibilidade da telemetria','N/D','≥ 98%','Precisa de histórico de comunicação e tempo previsto.')+
      card('Veículos monitorados',val(m.coverage,1,'%'),'≥ 98%','Situação de comunicação atual; não é disponibilidade mensal.');
    el('treatmentCards').innerHTML=
      card('Alertas tratados no prazo','N/D','≥ 95%','Depende de registros e prazos de tratativas.')+
      card('Tempo médio de tratamento','N/D','≤ 24 h','Depende das datas de abertura e conclusão.');
    el('safetyCards').innerHTML=
      card('Excesso de velocidade / 1.000 km',complete?val(m.speed,2,' eventos'):'N/D','Redução ≥ 10%','ExceptionEvent de velocidade ÷ km de Trip × 1.000.')+
      card('Reincidência de ocorrências','N/D','≤ 5%','Depende de ações corretivas e janela de recorrência.');
    el('efficiencyCards').innerHTML=
      card('Marcha lenta / veículo',complete?val(m.idle,2,' h'):'N/D','Redução ≥ 10%','Trip.idlingDuration / quantidade de veículos.')+
      card('Consumo médio (L/100 km)','N/D','Redução ≥ 5%','Exige combustível medido por fonte confiável.');
    var notes=['Disponibilidade histórica e indicadores de tratativas não podem ser inferidos apenas de dados instantâneos.'];
    if(devices.length>LIMIT_VEHICLES)notes.push('Mais de 50 veículos selecionados: histórico não agregado para evitar números parciais.');
    if(h.truncated)notes.push('Limite de registros atingido: índices históricos marcados como N/D.');
    if(h.errors)notes.push(h.errors+' consulta(s) de viagens/eventos falharam.');
    if(!m.hasSpeedRules)notes.push('Não foi encontrada regra de velocidade pelo nome; configure e valide as regras.');
    if(issues)notes.push('Alguma consulta de metadados falhou; confirme as permissões da conta.');
    el('notes').innerHTML=notes.map(function(n){return '<li>'+safe(n)+'</li>';}).join('');
    el('scope').textContent=devices.length+' veículo(s) elegível(is) · '+el('periodFilter').value+' dias · '+(complete?fmt(m.km,1)+' km em viagens':'Histórico indisponível');
    report={data:m,complete:complete};
    el('exportCsv').disabled=false;el('exportPdf').disabled=false;
  }
  async function refresh() {
    if(!api){message('Abra no MyGeotab para consultar sua frota; nenhuma informação fictícia será carregada.','err');return;}
    el('refreshBtn').disabled=true;
    try{
      var issues=0;
      if(!metaReady)issues=await loadMeta();
      else currentStatus=await get('DeviceStatusInfo',{},50000).catch(function(){issues++;return [];});
      var devices=currentDevices(false),stat=nowStatus(devices);renderStatus(stat);
      var h={trips:[],events:[],errors:0,truncated:false},complete=false;
      if(devices.length&&devices.length<=LIMIT_VEHICLES){
        message('Consultando histórico de '+devices.length+' veículos...');
        var to=new Date(),from=new Date(Date.now()-Number(el('periodFilter').value)*86400000);
        h=await getHistory(devices,from,to);complete=!h.errors&&!h.truncated;
      }
      render(devices,stat,h,complete,issues);
      message(issues||h.errors||h.truncated||devices.length>LIMIT_VEHICLES?'Consulta parcial. Verifique as observações.':'Consulta concluída. Indicadores sem fonte adequada aparecem como N/D.','ok');
      el('state').textContent='MyGeotab conectado';
    }catch(e){console.error(e);message('Falha ao consultar API: '+String(e.message||e),'err');}
    finally{el('refreshBtn').disabled=false;}
  }
  function csvValue(v){var s=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function csvExport(){
    if(!report)return;
    var m=report.data,v=function(n,d){return n==null?'N/D':fmt(n,d);};
    var rows=[['Indicador','Valor','Meta'],['Disponibilidade','N/D','≥ 98%'],
      ['Veículos monitorados',v(m.coverage,1)+'%','≥ 98%'],['Alertas tratados no prazo','N/D','≥ 95%'],
      ['Tempo médio de tratamento','N/D','≤ 24 horas'],['Excesso por 1.000 km',report.complete?v(m.speed,2):'N/D','Redução ≥ 10%'],
      ['Reincidência','N/D','≤ 5%'],['Marcha lenta h/veículo',report.complete?v(m.idle,2):'N/D','Redução ≥ 10%'],
      ['Consumo L/100 km','N/D','Redução ≥ 5%']];
    var csv=rows.map(function(row){return row.map(csvValue).join(';');}).join('\r\n');
    var url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='fleet-telemetry-manager.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  async function pdfExport(){
    if(!report)return;
    var logo=el('printLogo');
    if(window.PrintOptions){
      var opt=await window.PrintOptions.ask({title:'Imprimir indicadores',subtitle:'Escolha se deseja colocar um logo no PDF.'});
      if(!opt)return;
      if(opt.includeLogo&&opt.logo){logo.src=opt.logo;logo.hidden=false;}else{logo.hidden=true;logo.removeAttribute('src');}
    }
    window.print();
  }
  function initialize(client){
    api=client||null;initial();
    el('groupFilter').addEventListener('change',function(){populateVehicles();refresh();});
    el('vehicleFilter').addEventListener('change',refresh);
    el('periodFilter').addEventListener('change',refresh);
    el('refreshBtn').addEventListener('click',refresh);
    el('exportCsv').addEventListener('click',csvExport);
    el('exportPdf').addEventListener('click',pdfExport);
    if(api)refresh();else message('Prévia estática. O acesso aos dados depende da sessão MyGeotab.','err');
  }
  window.geotab=window.geotab||{};window.geotab.addin=window.geotab.addin||{};
  window.geotab.addin.fleetTelemetryManager=function(){return {
    initialize:function(client,state,ready){try{initialize(client);}catch(e){console.error(e);message('Erro ao iniciar: '+String(e.message||e),'err');}if(ready)ready();},
    focus:function(){},blur:function(){}
  };};
}());