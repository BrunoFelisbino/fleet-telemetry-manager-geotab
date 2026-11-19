/* Buscador multisseleção reutilizável para filtros de quilometragem. */
(function(root){
'use strict';
const LIMIT_OPTIONS=150;
const $=id=>document.getElementById(id);
const safe=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const normalized=v=>String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function create({model,onChange}){
  let groups=[],vehicles=[],selectedGroups=new Set(),selectedVehicles=new Set(),activeOptions={groups:[],vehicles:[]};
  const selected=type=>type==='groups'?selectedGroups:selectedVehicles;
  const heading=type=>type==='groups'?'group':'vehicle';
  function availableVehicles(){return model.devicesInMultiScope(vehicles,groups,[...selectedGroups],[]);}
  function labelGroup(id){const g=groups.find(g=>String(g.id)===String(id));return g?String(g.name||g.id):String(id);}
  function labelVehicle(id){const v=vehicles.find(v=>String(v.id)===String(id));return v?String(v.name||v.licensePlate||v.id):String(id);}
  function list(type){
    if(type==='groups')return activeOptions.groups;
    return activeOptions.vehicles;
  }
  function close(type){
    const name=heading(type),popover=$(name+'Popover'),button=$(name+'Toggle');
    popover.hidden=true;button.setAttribute('aria-expanded','false');
  }
  function open(type){
    const name=heading(type),popover=$(name+'Popover'),button=$(name+'Toggle');
    close(type==='groups'?'vehicles':'groups');
    popover.hidden=false;button.setAttribute('aria-expanded','true');
    $(name+'Search').focus();
    renderOptions(type);
  }
  function renderOptions(type){
    const name=heading(type),q=normalized($(name+'Search').value);
    const available=list(type);
    const matching=available.filter(item=>!q||normalized(item.label+' '+(item.plate||'')).includes(q));
    const shown=matching.slice(0,LIMIT_OPTIONS),chosen=selected(type);
    $(name+'Options').innerHTML=shown.length?shown.map(item=>
      '<label class="picker-option"><input type="checkbox" value="'+safe(item.id)+'"'+(chosen.has(item.id)?' checked':'')+'><span class="option-label" title="'+safe(item.label)+'">'+safe(item.label)+'</span></label>'
    ).join(''):'<div class="picker-empty">Nenhum resultado. Tente outro nome ou placa.</div>';
    const plural=type==='groups'?'grupos':'veículos';
    $(name+'OptionCount').textContent=matching.length>LIMIT_OPTIONS?'Mostrando '+LIMIT_OPTIONS+' de '+matching.length+' '+plural+'. Digite para refinar.':matching.length+' '+plural+' encontrados';
  }
  function renderChips(type){
    const name=heading(type),chosen=selected(type),label=type==='groups'?labelGroup:labelVehicle;
    $(name+'Caption').textContent=chosen.size?chosen.size+' '+(type==='groups'?'grupo(s)':'veículo(s)')+' selecionado(s)':type==='groups'?'Frota total acessível':'Todos os veículos';
    $(name+'Chips').innerHTML=[...chosen].map(id=>
      '<span class="filter-chip"><span class="chip-label" title="'+safe(label(id))+'">'+safe(label(id))+'</span><button type="button" data-remove="'+safe(id)+'" aria-label="Remover '+safe(label(id))+'">×</button></span>'
    ).join('');
  }
  function renderAll(){
    renderChips('groups');renderChips('vehicles');
    renderOptions('groups');renderOptions('vehicles');
    const grp=selectedGroups.size?selectedGroups.size+' grupo(s)':'frota total';
    const veh=selectedVehicles.size?selectedVehicles.size+' veículo(s)':'todos os veículos';
    $('activeFilters').textContent='Consulta: '+grp+' · '+veh+'. '+(!selectedGroups.size&&!selectedVehicles.size?'Nenhum filtro específico aplicado.':'Seleção múltipla ativa.');
  }
  function refreshVehicles(){
    const allowed=new Set(availableVehicles().map(v=>String(v.id)));
    for(const id of [...selectedVehicles])if(!allowed.has(id))selectedVehicles.delete(id);
    activeOptions.vehicles=availableVehicles().map(v=>({id:String(v.id),label:String(v.name||v.licensePlate||v.id),plate:String(v.licensePlate||'')}))
      .sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
    renderAll();
  }
  function setData(deviceData,groupData){
    vehicles=(deviceData||[]).filter(v=>model.isActive(v));groups=groupData||[];
    const seen=new Set(vehicles.flatMap(v=>(v.groups||[]).map(model.id)));
    activeOptions.groups=groups.filter(g=>g.id&&g.name&&[...model.groupMembers(g.id,groups)].some(id=>seen.has(id)))
      .map(g=>({id:String(g.id),label:String(g.name)})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
    const allowed=new Set(activeOptions.groups.map(g=>g.id));
    for(const id of [...selectedGroups])if(!allowed.has(id))selectedGroups.delete(id);
    refreshVehicles();
  }
  function notify(type){
    if(type==='groups')refreshVehicles();else renderAll();
    if(typeof onChange==='function')onChange();
  }
  function init(){
    for(const type of ['groups','vehicles']){
      const name=heading(type);
      $(name+'Toggle').addEventListener('click',()=>$(name+'Popover').hidden?open(type):close(type));
      $(name+'Search').addEventListener('input',()=>renderOptions(type));
      $(name+'Options').addEventListener('change',event=>{
        const input=event.target;
        if(!input||input.type!=='checkbox')return;
        const id=input.value,valid=list(type).some(item=>item.id===id);
        if(!valid)return;
        if(input.checked)selected(type).add(id);else selected(type).delete(id);
        notify(type);
      });
      $(name+'Chips').addEventListener('click',event=>{
        const btn=event.target.closest('button[data-remove]');
        if(!btn)return;
        selected(type).delete(btn.dataset.remove);
        notify(type);
      });
      $(name+'Clear').addEventListener('click',()=>{
        selected(type).clear();notify(type);
      });
      $(name+'Popover').addEventListener('keydown',event=>{
        if(event.key==='Escape'){close(type);$(name+'Toggle').focus();event.preventDefault();}
      });
    }
    document.addEventListener('click',event=>{
      for(const type of ['groups','vehicles']){
        const name=heading(type);
        if(!$(name+'Picker').contains(event.target))close(type);
      }
    });
    renderAll();
  }
  return {init,setData,refreshVehicles,groups:()=>[...selectedGroups],vehicles:()=>[...selectedVehicles],
    scope:()=>model.devicesInMultiScope(vehicles,groups,[...selectedGroups],[...selectedVehicles])};
}
root.FleetMileageFilters={create};
})(typeof globalThis!=='undefined'?globalThis:this);
