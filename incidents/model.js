/* Regras puras de ocorrências: sem API e sem dados de demonstração. */
(function(root){
'use strict';
const STATUS=Object.freeze({open:'aberta',analysis:'em_analise',assigned:'encaminhada',progress:'em_tratamento',closed:'concluida',justified:'justificada',reopened:'reaberta'});
const TRANSITIONS=Object.freeze({
  aberta:['em_analise','encaminhada','justificada'],
  em_analise:['encaminhada','em_tratamento','justificada'],
  encaminhada:['em_tratamento','concluida'],
  em_tratamento:['concluida'],
  concluida:['reaberta'],
  justificada:['reaberta'],
  reaberta:['em_analise','encaminhada']
});
const SEVERITIES=['critica','alta','media','baixa'];
const CATEGORIES=['velocidade','rota','marcha_lenta','conducao','comunicacao','mecanica','uso_nao_autorizado','outros'];
const CLOSED=['concluida','justificada'];
const MS_DAY=86400000;
function isValidDate(s){return typeof s==='string'&&s.length>=10&&Number.isFinite(Date.parse(s));}
function validateCreated(d){
  if(!d||d.kind!=='created'||d.schema!==1)throw Error('Registro de abertura inválido.');
  if(!/^[a-zA-Z0-9_-]{10,64}$/.test(d.caseId||''))throw Error('Identificador inválido.');
  if(!d.groupId||!d.vehicleId||!CATEGORIES.includes(d.category)||!SEVERITIES.includes(d.severity))throw Error('Dados de classificação incompletos.');
  if(!d.summary||d.summary.length>900||!isValidDate(d.ts)||!isValidDate(d.dueAt)||!d.actor)throw Error('Descrição, prazo e autor obrigatórios.');
  if(Date.parse(d.dueAt)<=Date.parse(d.ts))throw Error('O prazo deve ser posterior à abertura.');
  return d;
}
function validateTransition(d){
  if(!d||d.kind!=='transition'||d.schema!==1||!d.caseId||!isValidDate(d.ts)||!d.actor||!d.to||!d.from||!d.notes||d.notes.length>900)throw Error('Tratativa incompleta.');
  if(!TRANSITIONS[d.from]||!TRANSITIONS[d.from].includes(d.to))throw Error('Transição de status inválida.');
  return d;
}
function sanitizeRecord(row){
  const d=row&&row.details;
  if(!d||typeof d!=='object'||d.schema!==1)return null;
  if(d.kind==='created'){try{validateCreated(d);return {id:String(row.id||''),d};}catch(e){return null;}}
  if(d.kind==='transition'){try{validateTransition(d);return {id:String(row.id||''),d};}catch(e){return null;}}
  return null;
}
function buildCases(rows){
  const good=(rows||[]).map(sanitizeRecord).filter(Boolean);
  const starts=good.filter(x=>x.d.kind==='created').sort((a,b)=>Date.parse(a.d.ts)-Date.parse(b.d.ts)||a.id.localeCompare(b.id));
  const actions=good.filter(x=>x.d.kind==='transition');
  const byCase=new Map();
  for(const row of starts){
    const d=row.d;
    if(byCase.has(d.caseId))continue;
    byCase.set(d.caseId,{...d,status:'aberta',closedAt:null,history:[],owner:d.owner||'',updatedAt:d.ts});
  }
  actions.sort((a,b)=>Date.parse(a.d.ts)-Date.parse(b.d.ts)||a.id.localeCompare(b.id));
  for(const row of actions){
    const d=row.d,c=byCase.get(d.caseId);
    if(!c||d.ts<c.ts||d.from!==c.status||!TRANSITIONS[d.from]?.includes(d.to))continue;
    c.status=d.to;c.updatedAt=d.ts;
    if(d.owner)c.owner=d.owner;
    if(CLOSED.includes(d.to))c.closedAt=d.ts;
    if(d.to==='reaberta')c.closedAt=null;
    c.history.push({...d,id:row.id});
  }
  return [...byCase.values()].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
}
function metrics(cases,from,to){
  if(!isValidDate(from)||!isValidDate(to)||Date.parse(from)>Date.parse(to))throw Error('Período inválido.');
  const begin=Date.parse(from),end=Date.parse(to);
  const period=(cases||[]).filter(c=>{const ts=Date.parse(c.ts);return ts>=begin&&ts<=end;});
  const eligible=period.filter(c=>c.dueAt&&(CLOSED.includes(c.status)||Date.parse(c.dueAt)<=end));
  const ontime=eligible.filter(c=>CLOSED.includes(c.status)&&c.closedAt&&Date.parse(c.closedAt)<=Date.parse(c.dueAt)).length;
  const closed=period.filter(c=>CLOSED.includes(c.status)&&c.closedAt);
  const durations=closed.map(c=>(Date.parse(c.closedAt)-Date.parse(c.ts))/3600000).filter(n=>Number.isFinite(n)&&n>=0);
  const ordered=[...cases].sort((a,b)=>Date.parse(a.ts)-Date.parse(b.ts));
  let recurrent=0;
  for(const c of period){
    const t=Date.parse(c.ts);
    if(ordered.some(prev=>prev.caseId!==c.caseId&&prev.vehicleId===c.vehicleId&&prev.category===c.category&&
      prev.status==='concluida'&&prev.closedAt&&Date.parse(prev.closedAt)<t&&t-Date.parse(prev.closedAt)<=30*MS_DAY))recurrent++;
  }
  return {
    total:period.length,
    open:period.filter(c=>!CLOSED.includes(c.status)).length,
    eligible:eligible.length,
    ontime:ontime,
    slaPct:eligible.length?100*ontime/eligible.length:null,
    meanHours:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,
    closed:closed.length,
    recurrent,
    recurrencePct:period.length?100*recurrent/period.length:null,
    start:from,end:to
  };
}
root.TelemetryCaseModel={STATUS,TRANSITIONS,CATEGORIES,SEVERITIES,CLOSED,validateCreated,validateTransition,buildCases,metrics};
})(typeof globalThis!=='undefined'?globalThis:this);
