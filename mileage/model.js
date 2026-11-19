/* Motor de quilometragem independente de DOM/API. Distância Trip.distance em km, Trip.odometer em metros. */
(function(root){
'use strict';
const MS_DAY=86400000;
function id(v){return v&&typeof v==='object'?String(v.id||''):String(v||'');}
function isActive(d,at=new Date()){return (!d.activeFrom||new Date(d.activeFrom)<=at)&&(!d.activeTo||new Date(d.activeTo)>at);}
function groupMembers(groupId,groups){
  if(!groupId)return null;
  const index=new Map((groups||[]).map(g=>[String(g.id),g]));
  const found=new Set(),pending=[String(groupId)];
  while(pending.length){
    const key=pending.pop();
    if(found.has(key))continue;
    found.add(key);
    const g=index.get(key);
    for(const child of (g&&g.children||[])){const childId=id(child);if(childId&&!found.has(childId))pending.push(childId);}
  }
  return found;
}
function devicesInScope(devices,groups,groupId,vehicleId){
  const allowed=groupMembers(groupId,groups);
  return (devices||[]).filter(d=>isActive(d)).filter(d=>!allowed||(d.groups||[]).some(g=>allowed.has(id(g))))
    .filter(d=>!vehicleId||String(d.id)===String(vehicleId));
}
function devicesInMultiScope(devices,groups,selectedGroups,selectedVehicles){
  const groupIds=[...new Set((selectedGroups||[]).map(id).filter(Boolean))];
  const vehicleIds=new Set((selectedVehicles||[]).map(id).filter(Boolean));
  const allowed=groupIds.length?new Set():null;
  if(allowed)for(const groupId of groupIds)for(const member of groupMembers(groupId,groups)||[])allowed.add(member);
  return (devices||[]).filter(d=>isActive(d)).filter(d=>
    !allowed||(d.groups||[]).some(g=>allowed.has(id(g)))
  ).filter(d=>!vehicleIds.size||vehicleIds.has(String(d.id)));
}
function selectedGroupForVehicle(vehicle,groups,selectedGroups){
  const selected=[...new Set((selectedGroups||[]).map(id).filter(Boolean))];
  if(!selected.length)return null;
  const attached=new Set(vehicle.groups||[]);
  const matching=selected.filter(g=>[...groupMembers(g,groups)].some(member=>attached.has(member)));
  if(matching.length>1)return {id:'multiple',name:'Múltiplos grupos selecionados'};
  if(matching.length===1){
    const group=groups.find(g=>String(g.id)===matching[0]);
    return {id:matching[0],name:group?String(group.name):matching[0]};
  }
  return {id:'unassigned-selected',name:'Grupo não identificado'};
}
function localDate(y,m,d){return new Date(y,m,d,0,0,0,0);}
function range(preset,customStart,customEnd,clock=new Date()){
  const now=new Date(clock);
  let from,to;
  if(preset==='current'){from=localDate(now.getFullYear(),now.getMonth(),1);to=now;}
  else if(preset==='previous'){from=localDate(now.getFullYear(),now.getMonth()-1,1);to=new Date(localDate(now.getFullYear(),now.getMonth(),1).getTime()-1);}
  else if(preset==='custom'){from=new Date(customStart);to=new Date(customEnd);}
  else if(['7','30','90'].includes(String(preset))){to=now;from=new Date(now.getTime()-Number(preset)*MS_DAY);}
  else throw Error('Selecione um período válido.');
  if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||from>=to)throw Error('Intervalo de datas inválido.');
  if(to.getTime()-from.getTime()>366*MS_DAY)throw Error('Período máximo: 366 dias.');
  if(to.getTime()>now.getTime()+MS_DAY)throw Error('A data final não pode estar no futuro.');
  return {from,to,label:preset==='current'?'Mês atual':preset==='previous'?'Mês anterior':preset==='custom'?'Personalizado':'Últimos '+preset+' dias'};
}
function tripIdentity(t){
  if(t.id)return 'id:'+String(t.id);
  return 't:'+String(t.start||'')+'/'+String(t.stop||'')+'/'+String(t.distance||0);
}
function dateOf(t,which){const value=which==='start'?(t.start||t.startDateTime):(t.stop||t.nextTripStart||t.stopDateTime);return new Date(value).getTime();}
function boundaryTrip(t,range){
  const a=dateOf(t,'start'),b=dateOf(t,'stop');
  return Number.isFinite(a)&&Number.isFinite(b)&&(a<range.from.getTime()||b>range.to.getTime());
}
function summarizeVehicle(device,trips,period){
  const unique=new Map();
  for(const trip of trips||[])unique.set(tripIdentity(trip),trip);
  const list=[...unique.values()].filter(t=>Number.isFinite(dateOf(t,'start'))).sort((a,b)=>dateOf(a,'start')-dateOf(b,'start'));
  let totalKm=0,validCount=0,invalid=0,overlap=0;
  for(const t of list){
    const km=Number(t.distance);
    if(!Number.isFinite(km)||km<0){invalid++;continue;}
    validCount++;totalKm+=km;
    if(boundaryTrip(t,period))overlap++;
  }
  const odometerTrips=list.filter(t=>t.odometer!==null&&t.odometer!==undefined&&t.odometer!==''&&Number.isFinite(Number(t.odometer))&&Number(t.odometer)>=0);
  let odometerStart=null,odometerEnd=null,odometerOrigin='';
  if(odometerTrips.length===list.length&&list.length>0&&invalid===0){
    const first=list[0],last=list[list.length-1];
    // API fornece odômetro ao fim da viagem, não leitura de entrada no período.
    const inferred=Number(first.odometer)/1000-Number(first.distance||0);
    const final=Number(last.odometer)/1000;
    if(Number.isFinite(inferred)&&inferred>=0&&final>=inferred&&inferred<1e9){
      odometerStart=inferred;odometerEnd=final;odometerOrigin='Inicial inferido da primeira viagem; final informado pela Geotab';
    }
  }
  return {deviceId:String(device.id),name:String(device.name||device.licensePlate||device.id),plate:String(device.licensePlate||''),
    groups:(device.groups||[]).map(id),km:totalKm,tripCount:validCount,invalidCount:invalid,
    boundaryTrips:overlap,odoStart:odometerStart,odoEnd:odometerEnd,odoOrigin:odometerOrigin};
}
function primaryGroup(vehicle,groups,selectedGroup){
  if(Array.isArray(selectedGroup)){const matched=selectedGroupForVehicle(vehicle,groups,selectedGroup);if(matched)return matched;}
  if(selectedGroup){const group=(groups||[]).find(g=>String(g.id)===String(selectedGroup));return {id:String(selectedGroup),name:group?String(group.name):String(selectedGroup)};}
  const map=new Map((groups||[]).map(g=>[String(g.id),g]));
  const attached=vehicle.groups.filter(g=>map.has(String(g))&&g!=='GroupCompanyId');
  if(attached.length===0)return{id:'none',name:'Sem grupo definido'};
  // Dupla contagem de veículo em grupos é vedada. Grupo múltiplo recebe bucket exclusivo.
  if(attached.length>1)return{id:'multiple',name:'Múltiplos grupos'};
  const g=map.get(String(attached[0]));return{id:String(g.id),name:String(g.name||g.id)};
}
function summarizeFleet(devices,data,groups,selectedGroup){
  const rows=(devices||[]).map(d=>data.get(String(d.id))||summarizeVehicle(d,[],{from:new Date(0),to:new Date()}));
  const withKm=rows.filter(r=>r.invalidCount===0);
  let km=0,trips=0,stopped=0,odometerAvailable=0,boundary=0;
  const buckets=new Map();
  for(const r of withKm){
    km+=r.km;trips+=r.tripCount;if(!r.tripCount)stopped++;
    if(r.odoStart!=null&&r.odoEnd!=null)odometerAvailable++;
    boundary+=r.boundaryTrips;
    const group=primaryGroup(r,groups,selectedGroup),key=group.id;
    if(!buckets.has(key))buckets.set(key,{groupId:key,name:group.name,km:0,vehicles:0,trips:0});
    const groupRow=buckets.get(key);groupRow.km+=r.km;groupRow.trips+=r.tripCount;groupRow.vehicles++;
  }
  return {km,trips,vehicles:rows.length,stopped,average:rows.length?km/rows.length:null,
    withOdometer:odometerAvailable,boundaryTrips:boundary,vehiclesRows:rows.slice().sort((a,b)=>b.km-a.km),
    groupsRows:[...buckets.values()].sort((a,b)=>b.km-a.km)};
}
root.FleetMileageModel={MS_DAY,id,isActive,groupMembers,devicesInScope,devicesInMultiScope,range,tripIdentity,boundaryTrip,summarizeVehicle,summarizeFleet};
})(typeof globalThis!=='undefined'?globalThis:this);
