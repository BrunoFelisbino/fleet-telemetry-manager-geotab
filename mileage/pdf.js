/* PDF nativo, sem bibliotecas externas: gera download direto com resumo, gráficos e tabelas. */
(function(root){
'use strict';
const W=595.28,H=841.89,L=36,R=W-36,CW=R-L,DK='#111111';
const cp1252=new Map([[0x20ac,128],[0x201a,130],[0x0192,131],[0x201e,132],[0x2026,133],[0x2020,134],[0x2021,135],[0x02c6,136],[0x2030,137],[0x0160,138],[0x2039,139],[0x0152,140],[0x017d,142],[0x2018,145],[0x2019,146],[0x201c,147],[0x201d,148],[0x2022,149],[0x2013,150],[0x2014,151],[0x02dc,152],[0x2122,153],[0x0161,154],[0x203a,155],[0x0153,156],[0x017e,158],[0x0178,159]]);
function toWinAnsi(value){
  let out='';
  for(const char of String(value==null?'':value)){
    const n=char.codePointAt(0);
    if(n===10||n===13||n===9){out+=' ';continue;}
    if(n>=32&&n<=126||n>=160&&n<=255){out+=String.fromCharCode(n);continue;}
    if(cp1252.has(n)){out+=String.fromCharCode(cp1252.get(n));continue;}
    out+=n===0x2192?'>':n===0x2265?'>=':n===0x2264?'<=':'?';
  }
  return out;
}
function literal(v){return '('+toWinAnsi(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')+')';}
function n(v){return Number(v).toFixed(2);}
function fmt(value,dec=1){return Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:dec,maximumFractionDigits:dec});}
function shorten(v,max){const s=String(v==null?'':v);return s.length>max?s.slice(0,max-1)+'…':s;}
function create(){
  const pages=[];
  function newPage(){const p={ops:[]};pages.push(p);return p;}
  function rect(p,x,y,w,h,gray=0.94){p.ops.push(n(gray)+' g '+n(x)+' '+n(H-y-h)+' '+n(w)+' '+n(h)+' re f');}
  function stroke(p,x1,y1,x2,y2,gray=0.86){p.ops.push(n(gray)+' G 0.7 w '+n(x1)+' '+n(H-y1)+' m '+n(x2)+' '+n(H-y2)+' l S');}
  function text(p,x,y,value,size=10,weight=false,gray=0.15){
    p.ops.push(n(gray)+' g BT /F'+(weight?'2':'1')+' '+n(size)+' Tf 1 0 0 1 '+n(x)+' '+n(H-y-size)+' Tm '+literal(value)+' Tj ET');
  }
  function pageHead(p,section,detail,demo=false){
    rect(p,0,0,W,7,0.10);
    text(p,L,30,'FLEET TELEMETRY MANAGER',11,true,0.10);
    text(p,L,48,'Relatório de quilometragem da frota',9,false,0.37);
    text(p,L,75,section.toUpperCase(),17,true,0.10);
    if(detail)text(p,L,102,shorten(detail,110),8,false,0.40);
    stroke(p,L,122,R,122,0.82);
    if(demo){rect(p,R-148,28,148,21,0.92);text(p,R-140,32,'SIMULAÇÃO · DADOS FICTÍCIOS',7,true,0.27);}
  }
  function heading(p,y,label){text(p,L,y,label.toUpperCase(),10,true,0.18);stroke(p,L,y+18,R,y+18,0.85);}
  function table(p,columns,rows,{top=150,rowHeight=19,colWidths}={}){
    let y=top;
    const widths=colWidths||columns.map(()=>CW/columns.length);
    rect(p,L,y,CW,25,0.90);
    let x=L;
    columns.forEach((col,i)=>{text(p,x+8,y+7,shorten(col,Math.floor((widths[i]-16)/5.1)),8,true,0.22);x+=widths[i];});
    y+=25;
    for(let i=0;i<rows.length;i++){
      const row=rows[i];if(i%2===1)rect(p,L,y,CW,rowHeight,0.965);
      x=L;
      for(let j=0;j<row.length;j++){
        const max=Math.max(2,Math.floor((widths[j]-14)/4.6));
        text(p,x+8,y+5,shorten(row[j],max),8,false,j===0?0.16:0.31);
        x+=widths[j];
      }
      stroke(p,L,y+rowHeight,R,y+rowHeight,0.91);
      y+=rowHeight;
    }
    return y;
  }
  function footer(p,pageNumber,totalPages){
    stroke(p,L,796,R,796,0.86);
    text(p,L,806,'Fonte: viagens (Trip) da sessão MyGeotab. Resultados limitados à seleção consultada.',7,false,0.42);
    text(p,R-85,806,'Página '+pageNumber+' / '+totalPages,7,false,0.35);
  }
  function bytesFromString(s){const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)&255;return a;}
  function finalize(){
    pages.forEach((p,i)=>footer(p,i+1,pages.length));
    const objects=['','',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    ],pageIds=[];
    for(const p of pages){
      const stream=p.ops.join('\n')+'\n';
      const contentId=objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
      const pageId=objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+n(W)+' '+n(H)+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+contentId+' 0 R >>');
      pageIds.push(pageId);
    }
    objects[0]='<< /Type /Catalog /Pages 2 0 R >>';
    objects[1]='<< /Type /Pages /Kids ['+pageIds.map(x=>x+' 0 R').join(' ')+'] /Count '+pageIds.length+' >>';
    let output='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets=[0];
    objects.forEach((o,i)=>{offsets.push(output.length);output+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
    const xref=output.length;
    output+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
    for(let i=1;i<=objects.length;i++)output+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    output+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
    return bytesFromString(output);
  }
  return {pages,newPage,rect,stroke,text,heading,table,pageHead,finalize};
}
function make(report){
  if(!report||!report.summary||!report.period||!Array.isArray(report.summary.vehiclesRows))throw Error('Consulte a frota antes de gerar o PDF.');
  const {summary,period}=report,groups=report.groupNames||[],cars=report.vehicleNames||[],trend=report.trend||[],demo=!!report.demo;
  const C=create(),p=C.newPage();
  const selection=(groups.length?'Grupos: '+groups.join(', '):'Grupos: frota total')+' | '+(cars.length?'Veículos: '+cars.join(', '):'Veículos: todos');
  C.pageHead(p,'Resumo executivo',period.label+' · '+new Date(period.from).toLocaleDateString('pt-BR')+' a '+new Date(period.to).toLocaleDateString('pt-BR'),demo);
  C.text(p,L,136,shorten(selection,104),8,false,0.40);
  const cards=[['KM TOTAL',fmt(summary.km,1)+' km'],['VEÍCULOS',String(summary.vehicles)],['MÉDIA / VEÍCULO',fmt(summary.average||0,1)+' km'],['SEM VIAGEM',String(summary.stopped)]];
  const gap=9,w=(CW-3*gap)/4;
  cards.forEach((card,i)=>{
    const x=L+i*(w+gap);
    C.rect(p,x,160,w,83,0.948);
    C.text(p,x+10,172,card[0],8,true,0.42);
    C.text(p,x+10,197,shorten(card[1],16),15,true,0.10);
  });
  C.heading(p,267,'Evolução diária da quilometragem');
  const maxTrend=Math.max(1,...trend.map(d=>d.km)),space=CW/Math.max(1,trend.length);
  C.stroke(p,L,457,R,457,0.72);
  trend.forEach((d,i)=>{
    const x=L+i*space+space*0.17,bw=Math.max(.7,Math.min(13,space*0.66)),height=(Math.max(0,d.km)/maxTrend)*132;
    C.rect(p,x,456-height,bw,Math.max(.6,height),0.22);
    if(trend.length<=12||i%Math.ceil(trend.length/10)===0)C.text(p,x-1,466,shorten(d.label,10),6,false,0.42);
  });
  C.text(p,L,292,'Maior dia: '+fmt(maxTrend,1)+' km | '+trend.length+' dias no gráfico',8,false,0.38);
  C.heading(p,500,'Grupos com maior quilometragem');
  const maxGroup=Math.max(1,...summary.groupsRows.map(x=>x.km));
  summary.groupsRows.slice(0,5).forEach((row,i)=>{
    const y=532+i*32;
    C.text(p,L,y,shorten(row.name,28),9,false,0.24);
    C.rect(p,L+175,y+1,240,9,0.92);
    C.rect(p,L+175,y+1,240*(row.km/maxGroup),9,0.26);
    C.text(p,R-96,y,fmt(row.km,1)+' km',9,true,0.18);
  });
  if(!summary.groupsRows.length)C.text(p,L,540,'Nenhum grupo disponível nesta seleção.',10,false,0.50);
  C.heading(p,728,'Integridade do relatório');
  C.text(p,L,756,'Viagens no período: '+summary.trips+' | Odômetros disponíveis: '+summary.withOdometer+'/'+summary.vehicles+' | Viagens em limite de datas: '+summary.boundaryTrips,8,false,0.37);
  C.text(p,L,772,'Odômetro inicial é estimado. Viagens que cruzam o período são contabilizadas integralmente.',8,false,0.37);

  const dateDetail=period.label+' · '+new Date(period.from).toLocaleDateString('pt-BR')+' até '+new Date(period.to).toLocaleDateString('pt-BR');
  const pageRows=(items,chunk)=>{const out=[];for(let i=0;i<items.length;i+=chunk)out.push(items.slice(i,i+chunk));return out.length?out:[[]];};
  for(const [ix,batch] of pageRows(summary.groupsRows,29).entries()){
    const q=C.newPage();C.pageHead(q,'Quilometragem por grupo',dateDetail,demo);
    C.text(q,L,137,'Distribuição exclusiva: cada veículo é contabilizado uma vez.',8,false,0.43);
    C.table(q,['Grupo / operação','Veículos','Viagens','KM rodado'],batch.map(g=>[g.name,String(g.vehicles),String(g.trips),fmt(g.km,1)]),
      {top:159,rowHeight:20,colWidths:[263,72,72,116]});
  }
  for(const [ix,batch] of pageRows(summary.vehiclesRows,29).entries()){
    const q=C.newPage();C.pageHead(q,'Ranking por veículo',dateDetail,demo);
    C.text(q,L,135,'Odôm. inicial*: estimado da primeira viagem; odôm. final: informado pela Geotab.',8,false,0.43);
    C.table(q,['Veículo / placa','Viagens','KM rodado','Odôm. ini.*','Odôm. final'],batch.map(v=>[
      v.name+(v.plate?' / '+v.plate:''),String(v.tripCount),fmt(v.km,1),
      v.odoStart==null?'N/D':fmt(v.odoStart,1),v.odoEnd==null?'N/D':fmt(v.odoEnd,1)
    ]),{top:159,rowHeight:20,colWidths:[205,57,84,89,88]});
  }
  return C.finalize();
}
function save(report){
  const bytes=make(report),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');
  const date=new Date();
  const pad=n=>String(n).padStart(2,'0');
  a.href=url;a.download='quilometragem-frota-'+date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'.pdf';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  return bytes.length;
}
root.FleetMileagePdf={make,save};
})(typeof globalThis!=='undefined'?globalThis:this);
