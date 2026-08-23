/* ============ Colsubsidio · Nodo Kennedy · BI Operativo (Quick Go) ============ */

const COLORS = {navy:'#0B2A4A',blue:'#2E6FCE',blueL:'#6FA8E0',blueXl:'#AFD0F0',
  gold:'#F0A500',red:'#E4572E',green:'#1FAE6E',muted:'#6B7A90'};
let trabOrientation = 'v';

let RAW = [];        // cleaned rows straight from CSV
let FILTERED = [];   // rows after applying filters
let charts = {};

/* ---------------- Parsing helpers ---------------- */
// All numeric fields in this export use a plain dot as decimal separator
// and no thousand separators (e.g. Km "10", minutes "72.20", price "14802").
function num(v){
  if(v===undefined||v===null||v==='') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
const money = num;
function parseFechaCreacion(s){
  if(!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if(!m) return null;
  const [_,d,mo,y,h,mi] = m;
  return new Date(+y, +mo-1, +d, +h, +mi);
}
function fmtCOP(v){return '$'+Math.round(v).toLocaleString('es-CO');}
function fmtCOPk(v){return Math.abs(v)>=1000000?'$'+(v/1000000).toFixed(2)+'M':Math.abs(v)>=1000?'$'+(v/1000).toFixed(0)+'K':'$'+Math.round(v);}
function fmtMin(v){
  if(!v||isNaN(v)) return '-';
  const h = Math.floor(v/60), m = Math.round(v%60);
  return h>0 ? `${h}h ${m}m` : `${m}m`;
}
// Mediana en vez de promedio para los tiempos: un pequeno % de servicios con
// horas/dias de retraso (probablemente casos atipicos del sistema) inflan
// muchisimo el promedio simple y no representan el tiempo tipico real.
function median(arr){
  if(!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  const mid = Math.floor(s.length/2);
  return s.length%2 ? s[mid] : (s[mid-1]+s[mid])/2;
}
function medianBy(rows, key){
  return median(rows.filter(r=>r[key]>0).map(r=>r[key]));
}
function fmtDate(d){
  if(!d) return '-';
  return d.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+
         d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
}
// Fecha local en formato YYYY-MM-DD (evitar toISOString: convierte a UTC y
// puede correr el dia en zonas horarias negativas como Colombia).
function dayKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Semanas del proyecto: Semana 1 inicia el 19 de mayo de 2026 (fecha de arranque,
// un martes) y cierra el domingo siguiente; de ahi en adelante semanas completas
// de lunes a domingo. Fechas anteriores al arranque se agrupan en la Semana 1.
const PROJECT_START = new Date(2026, 4, 19);
function projectWeekInfo(d){
  const clamped = d < PROJECT_START ? PROJECT_START : d;
  const diffDays = Math.floor((clamped - PROJECT_START) / 86400000);
  const startDow = PROJECT_START.getDay(); // 0=Dom..6=Sab
  const daysToFirstSunday = (7 - startDow) % 7;
  let weekIndex, weekStart, weekEnd;
  if(diffDays <= daysToFirstSunday){
    weekIndex = 1;
    weekStart = PROJECT_START;
    weekEnd = new Date(PROJECT_START.getTime() + daysToFirstSunday*86400000);
  } else {
    const week2Monday = new Date(PROJECT_START.getTime() + (daysToFirstSunday+1)*86400000);
    const weeksAfter = Math.floor((diffDays - daysToFirstSunday - 1) / 7);
    weekIndex = 2 + weeksAfter;
    weekStart = new Date(week2Monday.getTime() + weeksAfter*7*86400000);
    weekEnd = new Date(weekStart.getTime() + 6*86400000);
  }
  return {weekIndex, weekStart, weekEnd};
}
function fmtDM(d){return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');}
function projectWeekLabel(d){
  const {weekIndex, weekStart, weekEnd} = projectWeekInfo(d);
  return `S${weekIndex} · ${fmtDM(weekStart)}–${fmtDM(weekEnd)}`;
}

/* ---------------- Load data ---------------- */
function setStatus(msg, cls){
  const el = document.getElementById('dataStatus');
  el.textContent = msg;
  el.className = cls||'';
}

function loadDefault(){
  setStatus('Cargando datos por defecto...');
  const url = new URL('data/data.csv', document.baseURI).href;
  Papa.parse(url, {
    download:true, header:true, delimiter:';', skipEmptyLines:true, worker:false,
    complete: res => onData(res.data, 'data/data.csv (repositorio)'),
    error: () => {
      setStatus('No se pudo cargar data/data.csv automáticamente. Súbelo manualmente con el botón de arriba.', 'err');
      document.getElementById('emptyState').style.display='flex';
    }
  });
}

function onData(rows, sourceLabel){
  const clean = rows.filter(r => r['ID Servicio'] && /^\d+$/.test(String(r['ID Servicio']).trim()));
  if(clean.length===0){
    setStatus('El archivo no contiene filas válidas.', 'err');
    return;
  }
  RAW = clean.map(r => {
    const fecha = parseFechaCreacion(r['Fecha de creación']);
    return {
      id: r['ID Servicio'],
      fecha,
      estado: (r['Estado']||'').trim(),
      trabajador: (r['Nombre Trabajador']||'').trim() || 'Sin asignar',
      precioTotal: money(r['Precio Total']),
      ganancias: money(r['Ganancias']),
      valorDeclarado: money(r['Valor Declarado']),
      km: num(r['Total (Km)']),
      paradas: num(r['Cantidad Paradas']),
      minAsignado: num(r['Minutos Tiempo Asignado']),
      minPrimeraParada: num(r['Minutos Tiempo Primera Parada']),
      minFinalizacion: num(r['Minutos Tiempo Finalización']),
      razonCancelacion: (r['Razon de Cancelacion']||'').trim(),
    };
  }).filter(r => r.fecha);

  // El proyecto arranco oficialmente el 19 de mayo de 2026; servicios anteriores
  // (pilotaje/pre-lanzamiento) quedan fuera del BI para no mezclar periodos.
  const antesDelArranque = RAW.filter(r => r.fecha < PROJECT_START).length;
  RAW = RAW.filter(r => r.fecha >= PROJECT_START);

  document.getElementById('emptyState').style.display='none';
  document.getElementById('dashboard').style.display='block';
  document.getElementById('ctxBar').style.display='flex';
  setStatus(`✓ ${RAW.length.toLocaleString('es-CO')} servicios cargados — ${sourceLabel}` +
    (antesDelArranque ? ` (se excluyeron ${antesDelArranque} previos al 19 may, pre-lanzamiento)` : ''), 'ok');

  const now = new Date();
  document.getElementById('updatedLabel').textContent =
    'Actualizado ' + now.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});

  const fechas = RAW.map(r=>r.fecha).sort((a,b)=>a-b);
  document.getElementById('fDesde').value = dayKey(fechas[0]);
  document.getElementById('fHasta').value = dayKey(fechas[fechas.length-1]);
  populateMonthFilter(fechas);

  applyFilters();
}

/* ---------------- Month filter ---------------- */
function populateMonthFilter(fechasSorted){
  const sel = document.getElementById('fMes');
  const prev = sel.value;
  sel.innerHTML = '<option value="">Todos los meses</option>';
  const seen = new Set();
  fechasSorted.forEach(f=>{
    const key = f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0');
    if(seen.has(key)) return;
    seen.add(key);
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = MESES_ES[f.getMonth()]+' '+f.getFullYear();
    sel.appendChild(opt);
  });
  if(seen.has(prev)) sel.value = prev;
}

function applyMonthFilter(){
  const val = document.getElementById('fMes').value;
  const fechasAll = RAW.map(r=>r.fecha).sort((a,b)=>a-b);
  if(!val){
    document.getElementById('fDesde').value = dayKey(fechasAll[0]);
    document.getElementById('fHasta').value = dayKey(fechasAll[fechasAll.length-1]);
  } else {
    const [y,m] = val.split('-').map(Number);
    document.getElementById('fDesde').value = dayKey(new Date(y, m-1, 1));
    document.getElementById('fHasta').value = dayKey(new Date(y, m, 0));
  }
  applyFilters();
}

/* ---------------- Filters ---------------- */
function applyFilters(){
  const desde = document.getElementById('fDesde').value ? new Date(document.getElementById('fDesde').value+'T00:00:00') : null;
  const hasta = document.getElementById('fHasta').value ? new Date(document.getElementById('fHasta').value+'T23:59:59') : null;
  const estado = document.getElementById('fEstado').value;
  const kmRange = document.getElementById('fKm').value;
  const trabajador = document.getElementById('fTrabajador').value.trim().toLowerCase();
  const kmBuckets = [[0,4],[5,10],[11,20],[21,Infinity]];

  FILTERED = RAW.filter(r=>{
    if(desde && r.fecha < desde) return false;
    if(hasta && r.fecha > hasta) return false;
    if(estado && r.estado !== estado) return false;
    if(kmRange!==''){
      const [min,max] = kmBuckets[+kmRange];
      if(r.km<min || r.km>max) return false;
    }
    if(trabajador && !r.trabajador.toLowerCase().includes(trabajador)) return false;
    return true;
  });
  renderAll();
}

/* ---------------- KPIs ---------------- */
function renderKPIs(){
  const n = FILTERED.length;
  const fin = FILTERED.filter(r=>r.estado==='Finalizado');
  const canc = FILTERED.filter(r=>r.estado==='Cancelado');
  const avgKm = n ? FILTERED.reduce((a,r)=>a+r.km,0)/n : 0;
  const avgValorDecl = n ? FILTERED.reduce((a,r)=>a+r.valorDeclarado,0)/n : 0;
  const medianTiempoEntrega = medianBy(fin, 'minFinalizacion');
  const trabajadoresActivos = new Set(FILTERED.filter(r=>r.trabajador!=='Sin asignar').map(r=>r.trabajador)).size;
  // Mediana, no promedio: un pequeno % de servicios con valor muy alto (mensajeria
  // con valor declarado alto) y otro % en $0 (cancelados/sin cobro) distorsionan
  // el promedio simple muy por encima de la tarifa real pactada.
  const medianTicket = median(FILTERED.map(r=>r.precioTotal));

  document.getElementById('kTotal').textContent = n.toLocaleString('es-CO');
  document.getElementById('kFin').textContent = fin.length.toLocaleString('es-CO');
  document.getElementById('kFinPct').textContent = n ? (fin.length/n*100).toFixed(1)+'% del total' : '';
  document.getElementById('kCanc').textContent = canc.length.toLocaleString('es-CO');
  document.getElementById('kCancPct').textContent = n ? (canc.length/n*100).toFixed(1)+'% del total' : '';
  document.getElementById('kTiempoEntrega').textContent = fmtMin(medianTiempoEntrega);
  document.getElementById('kKm').textContent = avgKm.toFixed(1)+' km';
  document.getElementById('kTicket').textContent = fmtCOP(medianTicket);
  document.getElementById('kValorDecl').textContent = fmtCOPk(avgValorDecl);
  document.getElementById('kTrabajadores').textContent = trabajadoresActivos.toLocaleString('es-CO');
}

/* ---------------- Charts ---------------- */
function dc(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function mk(id,cfg){dc(id);const el=document.getElementById(id);if(!el)return;charts[id]=new Chart(el,cfg);}
Chart.defaults.color = COLORS.muted;
Chart.defaults.font.family = "'Barlow',sans-serif";
Chart.defaults.borderColor = 'rgba(11,42,74,.08)';

// Tooltip legible en todas las graficas: fondo solido, texto claro, siempre visible al pasar el cursor.
const TOOLTIP_BASE = {enabled:true, backgroundColor:'rgba(11,42,74,.96)', titleColor:'#fff', bodyColor:'#fff',
  padding:10, cornerRadius:8, titleFont:{family:"'Barlow Condensed',sans-serif",weight:'700',size:12},
  bodyFont:{family:"'Barlow',sans-serif",size:12}, displayColors:true};

function renderCharts(){
  // Evolución por día: finalizados (verde) vs cancelados (rojo), apiladas,
  // para ver el volumen diario y el % de cumplimiento de un vistazo.
  const byDayFin = {}, byDayCanc = {}, byDayOtro = {};
  FILTERED.forEach(r=>{
    const k=dayKey(r.fecha);
    if(r.estado==='Finalizado') byDayFin[k]=(byDayFin[k]||0)+1;
    else if(r.estado==='Cancelado') byDayCanc[k]=(byDayCanc[k]||0)+1;
    else byDayOtro[k]=(byDayOtro[k]||0)+1;
  });
  const days = [...new Set([...Object.keys(byDayFin),...Object.keys(byDayCanc),...Object.keys(byDayOtro)])].sort();
  mk('chEvol',{type:'bar',data:{labels:days,datasets:[
    {label:'Finalizados',data:days.map(d=>byDayFin[d]||0),backgroundColor:COLORS.green,stack:'s'},
    {label:'Cancelados',data:days.map(d=>byDayCanc[d]||0),backgroundColor:COLORS.red,stack:'s'},
  ]},
    options:{responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:12}},
        tooltip:{...TOOLTIP_BASE,callbacks:{footer:items=>{
          const fin = items.find(i=>i.dataset.label==='Finalizados')?.parsed.y||0;
          const canc = items.find(i=>i.dataset.label==='Cancelados')?.parsed.y||0;
          const tot = fin+canc;
          return tot ? `Cumplimiento: ${(fin/tot*100).toFixed(1)}%` : '';
        }}}},
      scales:{x:{stacked:true,ticks:{maxTicksLimit:10}},
        y:{stacked:true,beginAtZero:true,grid:{color:'rgba(11,42,74,.06)'}}}}});

  // Estado
  const fin = FILTERED.filter(r=>r.estado==='Finalizado').length;
  const canc = FILTERED.filter(r=>r.estado==='Cancelado').length;
  const otros = FILTERED.length - fin - canc;
  const estadoLabels=['Finalizado','Cancelado']; const estadoData=[fin,canc]; const estadoColors=[COLORS.green,COLORS.red];
  if(otros>0){estadoLabels.push('Otro');estadoData.push(otros);estadoColors.push(COLORS.blueXl);}
  mk('chEstado',{type:'doughnut',data:{labels:estadoLabels,datasets:[{data:estadoData,backgroundColor:estadoColors,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:12}},
        tooltip:{...TOOLTIP_BASE,callbacks:{label:c=>{
          const tot=c.dataset.data.reduce((a,b)=>a+b,0);
          const pct=tot?(c.parsed/tot*100).toFixed(1):0;
          return `${c.label}: ${c.parsed.toLocaleString('es-CO')} (${pct}%)`;
        }}}}}});

  // Rango de km (con porcentajes) + tabla de detalle
  const km = kmStats();
  const kmColors = [COLORS.blue, COLORS.blueL, COLORS.gold, COLORS.navy];
  mk('chKm',{type:'doughnut',data:{
    labels:km.map((k,i)=>`${k.label} (${k.pct.toFixed(1)}%)`),
    datasets:[{data:km.map(k=>k.n),backgroundColor:kmColors,borderWidth:0,hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'56%',
      plugins:{legend:{position:'bottom',labels:{boxWidth:9,padding:8,font:{size:10.5}}},
        tooltip:{...TOOLTIP_BASE,callbacks:{label:c=>{
          const k2=km[c.dataIndex];
          return `${k2.label}: ${k2.n.toLocaleString('es-CO')} (${k2.pct.toFixed(1)}%)`;
        }}}}}});
  renderKmTable(km, kmColors);

  // Distribucion del tiempo de entrega (segregado por rango, no solo un promedio)
  const tiempo = tiempoStats();
  const tiempoColors = [COLORS.green, COLORS.blue, COLORS.blueL, COLORS.gold, COLORS.red];
  mk('chTiempo',{type:'doughnut',data:{
    labels:tiempo.map(t=>`${t.label} (${t.pct.toFixed(1)}%)`),
    datasets:[{data:tiempo.map(t=>t.n),backgroundColor:tiempoColors,borderWidth:0,hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'56%',
      plugins:{legend:{position:'bottom',labels:{boxWidth:9,padding:8,font:{size:10.5}}},
        tooltip:{...TOOLTIP_BASE,callbacks:{label:c=>{
          const t2=tiempo[c.dataIndex];
          return `${t2.label}: ${t2.n.toLocaleString('es-CO')} (${t2.pct.toFixed(1)}%)`;
        }}}}}});
  renderTiempoTable(tiempo, tiempoColors);

  // Top 20 Quickers por volumen historico (todo el proyecto, no aplica filtros de fecha/estado)
  const trabCount = {};
  RAW.forEach(r=>{if(r.trabajador!=='Sin asignar') trabCount[r.trabajador]=(trabCount[r.trabajador]||0)+1;});
  const topTrabSorted = Object.entries(trabCount).sort((a,b)=>b[1]-a[1]).slice(0,20);
  const topTrab = trabOrientation==='h' ? [...topTrabSorted].reverse() : topTrabSorted;
  mk('chTrabajadores',{type:'bar',data:{labels:topTrab.map(e=>e[0]),datasets:[{data:topTrab.map(e=>e[1]),
    backgroundColor:COLORS.blue,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:trabOrientation==='h'?'y':'x',
      plugins:{legend:{display:false},tooltip:{...TOOLTIP_BASE}},
      scales:trabOrientation==='h'?{x:{beginAtZero:true}}:{y:{beginAtZero:true},x:{ticks:{maxRotation:60,minRotation:60}}}}});

  // Motivos de cancelación
  const cancCount = {};
  FILTERED.filter(r=>r.estado==='Cancelado').forEach(r=>{
    const razon = r.razonCancelacion || 'Sin especificar';
    cancCount[razon]=(cancCount[razon]||0)+1;
  });
  const topCanc = Object.entries(cancCount).sort((a,b)=>b[1]-a[1]).slice(0,8).reverse();
  mk('chCancel',{type:'bar',data:{labels:topCanc.map(e=>e[0]),datasets:[{data:topCanc.map(e=>e[1]),
    backgroundColor:COLORS.red,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
      plugins:{legend:{display:false},tooltip:{...TOOLTIP_BASE}},
      scales:{x:{beginAtZero:true}}}});

  // Ingresos por semana (semana de proyecto: lunes-domingo, S1 arranca 19 mayo)
  const bySem = {}, semOrder = {};
  FILTERED.forEach(r=>{
    const info = projectWeekInfo(r.fecha), k = projectWeekLabel(r.fecha);
    bySem[k] = (bySem[k]||0) + r.precioTotal;
    semOrder[k] = info.weekIndex;
  });
  const sems = Object.keys(bySem).sort((a,b)=>semOrder[a]-semOrder[b]);
  mk('chIngresosSemana',{type:'bar',data:{labels:sems,datasets:[{data:sems.map(s=>bySem[s]),
    backgroundColor:COLORS.navy,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
      tooltip:{...TOOLTIP_BASE,callbacks:{label:c=>fmtCOP(c.parsed.y)}}},scales:{y:{ticks:{callback:v=>fmtCOPk(v)}}}}});
}

/* ---------------- KM breakdown ---------------- */
function kmStats(){
  const buckets = [
    {label:'0–4 km', min:0, max:4},
    {label:'5–10 km', min:5, max:10},
    {label:'11–20 km', min:11, max:20},
    {label:'21 km+', min:21, max:Infinity},
  ];
  const total = FILTERED.length;
  return buckets.map(b=>{
    const rows = FILTERED.filter(r => r.km>=b.min && r.km<=b.max);
    const finRows = rows.filter(r=>r.estado==='Finalizado');
    const n = rows.length;
    const facturado = rows.reduce((a,r)=>a+r.precioTotal,0);
    return {
      label:b.label, n,
      pct: total ? n/total*100 : 0,
      kmProm: n ? rows.reduce((a,r)=>a+r.km,0)/n : 0,
      tAsign: medianBy(finRows,'minAsignado'),
      tFin: medianBy(finRows,'minFinalizacion'),
      ticket: median(rows.map(r=>r.precioTotal)),
      facturado,
    };
  });
}

function renderKmTable(km, colors){
  const total = FILTERED.length;
  const finTotal = FILTERED.filter(r=>r.estado==='Finalizado');
  const facturadoTotal = FILTERED.reduce((a,r)=>a+r.precioTotal,0);
  let h = km.map((k,i)=>`
    <tr>
      <td><span class="bd tl">${k.label}</span></td>
      <td><b>${k.n.toLocaleString('es-CO')}</b></td>
      <td><div class="pct-bar"><div class="pct-bar-track"><div class="pct-bar-fill" style="width:${Math.min(100,k.pct)}%;background:${colors[i]}"></div></div><span style="font-size:10.5px;font-weight:700;color:${colors[i]}">${k.pct.toFixed(1)}%</span></div></td>
      <td>${k.kmProm.toFixed(1)} km</td>
      <td>${k.tAsign.toFixed(0)} min</td>
      <td>${k.tFin.toFixed(0)} min</td>
      <td><b>${fmtCOP(k.ticket)}</b></td>
      <td>${fmtCOPk(k.facturado)}</td>
    </tr>`).join('');
  if(total){
    h += `
    <tr style="background:var(--card-h);font-weight:700;">
      <td><span class="bd go">TOTAL</span></td>
      <td>${total.toLocaleString('es-CO')}</td>
      <td>100%</td>
      <td>${(FILTERED.reduce((a,r)=>a+r.km,0)/total).toFixed(1)} km</td>
      <td>${medianBy(finTotal,'minAsignado').toFixed(0)} min</td>
      <td>${medianBy(finTotal,'minFinalizacion').toFixed(0)} min</td>
      <td>${fmtCOP(median(FILTERED.map(r=>r.precioTotal)))}</td>
      <td>${fmtCOPk(facturadoTotal)}</td>
    </tr>`;
  }
  document.getElementById('kmTableBody').innerHTML = h;
}

/* ---------------- Tiempo de entrega: distribucion segregada ---------------- */
function tiempoStats(){
  const buckets = [
    {label:'≤ 30 min', min:0, max:30},
    {label:'31–60 min', min:31, max:60},
    {label:'1–2 h', min:61, max:120},
    {label:'2–4 h', min:121, max:240},
    {label:'4 h+', min:241, max:Infinity},
  ];
  const fin = FILTERED.filter(r=>r.estado==='Finalizado' && r.minFinalizacion>0);
  const total = fin.length;
  return buckets.map(b=>{
    const rows = fin.filter(r => r.minFinalizacion>=b.min && r.minFinalizacion<=b.max);
    return {label:b.label, n:rows.length, pct: total ? rows.length/total*100 : 0};
  });
}

function renderTiempoTable(tiempo, colors){
  const total = tiempo.reduce((a,t)=>a+t.n,0);
  let h = tiempo.map((t,i)=>`
    <tr>
      <td><span class="bd tl">${t.label}</span></td>
      <td><b>${t.n.toLocaleString('es-CO')}</b></td>
      <td><div class="pct-bar"><div class="pct-bar-track"><div class="pct-bar-fill" style="width:${Math.min(100,t.pct)}%;background:${colors[i]}"></div></div><span style="font-size:10.5px;font-weight:700;color:${colors[i]}">${t.pct.toFixed(1)}%</span></div></td>
    </tr>`).join('');
  if(total){
    h += `
    <tr style="background:var(--card-h);font-weight:700;">
      <td><span class="bd go">TOTAL</span></td>
      <td>${total.toLocaleString('es-CO')}</td>
      <td>100%</td>
    </tr>`;
  }
  document.getElementById('tiempoTableBody').innerHTML = h;
}

/* ---------------- Process flow ---------------- */
function renderFlow(){
  const fin = FILTERED.filter(r=>r.estado==='Finalizado');
  const ticket = median(FILTERED.map(r=>r.precioTotal));
  const stages = [
    {ico:'📋',nm:'Asignación',v:medianBy(fin,'minAsignado').toFixed(0),unit:'min (mediana)'},
    {ico:'📍',nm:'1ª Parada',v:medianBy(fin,'minPrimeraParada').toFixed(0),unit:'min (mediana)'},
    {ico:'🏁',nm:'Ciclo Total',v:medianBy(fin,'minFinalizacion').toFixed(0),unit:'min (mediana)'},
    {ico:'🎫',nm:'Ticket',v:fmtCOP(ticket),unit:'mediana COP',small:true},
  ];
  document.getElementById('pfFlow').innerHTML = stages.map(s=>`
    <div class="ps">
      <div class="ps-ico">${s.ico}</div>
      <div class="ps-nm">${s.nm}</div>
      <div class="ps-val"${s.small?' style="font-size:15px"':''}>${s.v}</div>
      <div class="ps-unit">${s.unit}</div>
    </div>`).join('');
}

function renderContext(){
  if(!FILTERED.length){
    document.getElementById('ctxPeriodo').textContent = 'Sin datos';
    document.getElementById('ctxTrabajador').textContent = '-';
    return;
  }
  const fechas = FILTERED.map(r=>r.fecha).sort((a,b)=>a-b);
  document.getElementById('ctxPeriodo').textContent =
    `${fmtDate(fechas[0]).split(' ')[0]} → ${fmtDate(fechas[fechas.length-1]).split(' ')[0]}`;

  const trabCount = {};
  FILTERED.forEach(r=>{if(r.trabajador!=='Sin asignar') trabCount[r.trabajador]=(trabCount[r.trabajador]||0)+1;});
  const topTrab = Object.entries(trabCount).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('ctxTrabajador').textContent = topTrab ? `${topTrab[0]} (${topTrab[1]})` : '-';
}

function renderAll(){
  renderKPIs();
  renderContext();
  renderCharts();
  renderFlow();
}

/* ---------------- Wire up UI ---------------- */
document.getElementById('fMes').addEventListener('change', applyMonthFilter);
document.getElementById('fEstado').addEventListener('change', applyFilters);
document.getElementById('fKm').addEventListener('change', applyFilters);
document.getElementById('fTrabajador').addEventListener('input', ()=>{
  clearTimeout(window._tdeb); window._tdeb=setTimeout(applyFilters,250);
});
document.getElementById('btnClear').addEventListener('click', ()=>{
  document.getElementById('fMes').value='';
  document.getElementById('fEstado').value='';
  document.getElementById('fKm').value='';
  document.getElementById('fTrabajador').value='';
  if(RAW.length){
    const fechas = RAW.map(r=>r.fecha).sort((a,b)=>a-b);
    document.getElementById('fDesde').value = dayKey(fechas[0]);
    document.getElementById('fHasta').value = dayKey(fechas[fechas.length-1]);
  }
  applyFilters();
});
document.querySelectorAll('#trabToggle .tbtn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    trabOrientation = btn.dataset.o;
    document.querySelectorAll('#trabToggle .tbtn').forEach(b=>b.classList.toggle('active', b===btn));
    renderCharts();
  });
});
document.getElementById('fileInput').addEventListener('change', e=>{
  const file = e.target.files[0];
  if(!file) return;
  setStatus('Procesando '+file.name+'...');
  Papa.parse(file, {
    header:true, delimiter:';', skipEmptyLines:true, worker:false,
    complete: res => onData(res.data, file.name+' (cargado manualmente)'),
    error: err => setStatus('Error al leer el archivo: '+err, 'err'),
  });
});

loadDefault();
