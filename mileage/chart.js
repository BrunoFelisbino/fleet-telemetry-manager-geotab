/* Gráfico SVG diário, independente de bibliotecas e com contraste acessível. */
(function(root){
'use strict';
function safe(v){
  return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmt(v,dec=1){
  return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
}
function tickLabel(value){
  if(value===0)return '0';
  if(value>=1000)return fmt(value/1000,value>=10000?0:1)+' mil';
  return fmt(value,0);
}
function svg(daily){
  const rows=Array.isArray(daily)?daily:[];
  if(!rows.length)return '<div class="trend-placeholder">Sem dados no período consultado.</div>';
  const count=rows.length, width=Math.max(620,64+count*34),height=244;
  const left=54,right=14,top=18,bottom=198,plotHeight=bottom-top,usable=width-left-right;
  const slot=usable/count,barWidth=Math.min(23,slot*0.66);
  const peak=Math.max(0,...rows.map(r=>Number(r.km)||0));
  const magnitude=Math.pow(10,Math.floor(Math.log10(Math.max(1,peak))));
  const step=Math.max(1,Math.ceil(peak/(4*magnitude))*magnitude);
  const axisMax=step*4;
  const every=count<=31?1:count<=62?2:count<=120?4:7;
  const parts=[
    '<svg class="daily-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" style="min-width:'+width+'px" role="img" aria-label="Quilometragem diária: '+count+' dias">'
  ];
  for(let i=0;i<=4;i++){
    const value=i*step,y=bottom-(value/axisMax)*plotHeight;
    parts.push('<line class="daily-gridline" x1="'+left+'" x2="'+(width-right)+'" y1="'+y.toFixed(2)+'" y2="'+y.toFixed(2)+'"/>');
    parts.push('<text class="daily-axis-text" x="'+(left-8)+'" y="'+(y+3).toFixed(2)+'" text-anchor="end">'+safe(tickLabel(value))+'</text>');
  }
  rows.forEach((row,i)=>{
    const km=Math.max(0,Number(row.km)||0),x=left+i*slot+slot/2,y=bottom-(km/axisMax)*plotHeight;
    const h=Math.max(0,(km/axisMax)*plotHeight),label=String(row.label||row.day||'');
    const title=label+': '+fmt(km,1)+' km';
    parts.push('<g class="daily-bar">');
    if(km>0)parts.push('<rect class="daily-bar-rect" x="'+(x-barWidth/2).toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+barWidth.toFixed(2)+'" height="'+h.toFixed(2)+'" rx="3"><title>'+safe(title)+'</title></rect>');
    else parts.push('<circle class="daily-zero-dot" cx="'+x.toFixed(2)+'" cy="'+bottom+'" r="2"><title>'+safe(title)+'</title></circle>');
    if(i%every===0||i===count-1)parts.push('<text class="daily-date-label" x="'+x.toFixed(2)+'" y="221" text-anchor="middle">'+safe(label)+'</text>');
    parts.push('</g>');
  });
  parts.push('<text class="daily-unit" x="'+left+'" y="12">KM / DIA</text></svg>');
  return parts.join('');
}
root.FleetMileageDailyChart={svg,tickLabel};
})(typeof globalThis!=='undefined'?globalThis:this);
