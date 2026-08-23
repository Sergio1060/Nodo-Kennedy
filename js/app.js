/* ============ Colsubsidio · Nodo Kennedy · BI Operativo (Quick Go) ============ */

const COLORS = {navy:'#0B2A4A',blue:'#2E6FCE',blueL:'#6FA8E0',blueXl:'#AFD0F0',
  gold:'#F0A500',red:'#E4572E',green:'#1FAE6E',muted:'#6B7A90'};
const BLUES = ['#0B2A4A','#1E4E82','#2E6FCE','#5C93DE','#8EC1EA','#B7D9F4'];
let trabOrientation = 'v';

let RAW = [];        // cleaned rows straight from CSV
let FILTERED = [];   // rows after applying filters
let charts = {};
let sortKey = 'Fecha de creación', sortDir = -1;
let page = 1;
const PAGE_SIZE = 50;

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
function fmtDate(d){
  if(!d) return '-';
  return d.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+
         d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
}
function isoWeekLabel(d){
  const t = new Date(d.getTime());
  t.setHours(0,0,0,0);
  t.setDate(t.getDate() + 3 - ((t.getDay()+6)%7));
  const week1 = new Date(t.getFullYear(),0,4);
  const wk = 1 + Math.round(((t-week1)/86400000 - 3 + ((week1.getDay()+6)%7))/7);
  return `${t.getFullYear()}-S${String(wk).padStart(2,'0')}`;
}
function dayKey(d){return d.toISOString().slice(0,10);}

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
      tipo: (r['Tipo de Servicio']||'').trim(),
      trabajador: (r['Nombre Trabajador']||'').trim() || 'Sin asignar',
      precioTotal: money(r['Precio Total']),
      ganancias: money(r['Ganancias']),
      valorDeclarado: money(r['Valor Declarado']),
      km: num(r['Total (Km)']),
      paradas: num(r['Cantidad Paradas']),
      metodoPago: (r['Método de Pago']||'Sin dato').trim() || 'Sin dato',
      minAsignado: num(r['Minutos Tiempo Asignado']),
      minPrimeraParada: num(r['Minutos Tiempo Primera Parada']),
      minFinalizacion: num(r['Minutos Tiempo Finalización']),
      razonCancelacion: (r['Razon de Cancelacion']||'').trim(),
    };
  }).filter(r => r.fecha);

  document.getElementById('emptyState').style.display='none';
  document.getElementById('dashboard').style.display='block';
  document.getElementById('ctxBar').style.display='flex';
  setStatus(`✓ ${RAW.length.toLocaleString('es-CO')} servicios cargados — ${sourceLabel}`, 'ok');

  const now = new Date();
  document.getElementById('updatedLabel').textContent =
    'Actualizado ' + now.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});

  const fechas = RAW.map(r=>r.fecha).sort((a,b)=>a-b);
  document.getElementById('fDesde').value = dayKey(fechas[0]);
  document.getElementById('fHasta').value = dayKey(fechas[fechas.length-1]);

  applyFilters();
}

/* ---------------- Filters ---------------- */
function applyFilters(){
  const desde = document.getElementById('fDesde').value ? new Date(document.getElementById('fDesde').value+'T00:00:00') : null;
  const hasta = document.getElementById('fHasta').value ? new Date(document.getElementById('fHasta').value+'T23:59:59') : null;
  const estado = document.getElementById('fEstado').value;
  const tipo = document.getElementById('fTipo').value;
  const trabajador = document.getElementById('fTrabajador').value.trim().toLowerCase();

  FILTERED = RAW.filter(r=>{
    if(desde && r.fecha < desde) return false;
    if(hasta && r.fecha > hasta) return false;
    if(estado && r.estado !== estado) return false;
    if(tipo && r.tipo !== tipo) return false;
    if(trabajador && !r.trabajador.toLowerCase().includes(trabajador)) return false;
    return true;
  });
  page = 1;
  renderAll();
}

/* ---------------- KPIs ---------------- */
function renderKPIs(){
  const n = FILTERED.length;
  const fin = FILTERED.filter(r=>r.estado==='Finalizado');
  const canc = FILTERED.filter(r=>r.estado==='Cancelado');
  const ingresos = FILTERED.reduce((a,r)=>a+r.precioTotal,0);
  const ganancias = FILTERED.reduce((a,r)=>a+r.ganancias,0);
  const avgKm = n ? FILTERED.reduce((a,r)=>a+r.km,0)/n : 0;
  const avgValorDecl = n ? FILTERED.reduce((a,r)=>a+r.valorDeclarado,0)/n : 0;
  const finConTiempo = fin.filter(r=>r.minFinalizacion>0);
  const avgTiempoEntrega = finConTiempo.length ? finConTiempo.reduce((a,r)=>a+r.minFinalizacion,0)/finConTiempo.length : 0;
  const trabajadoresActivos = new Set(FILTERED.map(r=>r.trabajador)).size;
  const avgTicket = n ? ingresos/n : 0;

  document.getElementById('kTotal').textContent = n.toLocaleString('es-CO');
  document.getElementById('kFin').textContent = fin.length.toLocaleString('es-CO');
  document.getElementById('kFinPct').textContent = n ? (fin.length/n*100).toFixed(1)+'% del total' : '';
  document.getElementById('kCanc').textContent = canc.length.toLocaleString('es-CO');
  document.getElementById('kCancPct').textContent = n ? (canc.length/n*100).toFixed(1)+'% del total' : '';
  document.getElementById('kIngresos').textContent = fmtCOPk(ingresos);
  document.getElementById('kGanancias').textContent = fmtCOPk(ganancias);
  document.getElementById('kTiempoEntrega').textContent = fmtMin(avgTiempoEntrega);
  document.getElementById('kKm').textContent = avgKm.toFixed(1)+' km';
  document.getElementById('kTicket').textContent = fmtCOP(avgTicket);
  document.getElementById('kValorDecl').textContent = fmtCOPk(avgValorDecl);
  document.getElementById('kTrabajadores').textContent = trabajadoresActivos.toLocaleString('es-CO');
}

/* ---------------- Charts ---------------- */
function dc(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function mk(id,cfg){dc(id);const el=document.getElementById(id);if(!el)return;charts[id]=new Chart(el,cfg);}
Chart.defaults.color = COLORS.muted;
Chart.defaults.font.family = "'Barlow',sans-serif";
Chart.defaults.borderColor = 'rgba(11,42,74,.08)';

function renderCharts(){
  // Evolución por día
  const byDay = {};
  FILTERED.forEach(r=>{const k=dayKey(r.fecha); byDay[k]=(byDay[k]||0)+1;});
  const days = Object.keys(byDay).sort();
  mk('chEvol',{type:'line',data:{labels:days,datasets:[{label:'Servicios',data:days.map(d=>byDay[d]),
    borderColor:COLORS.blue,backgroundColor:'rgba(46,111,206,.12)',fill:true,tension:.3,pointRadius:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{ticks:{maxTicksLimit:10}},y:{beginAtZero:true,grid:{color:'rgba(11,42,74,.06)'}}}}});

  // Estado
  const fin = FILTERED.filter(r=>r.estado==='Finalizado').length;
  const canc = FILTERED.filter(r=>r.estado==='Cancelado').length;
  const otros = FILTERED.length - fin - canc;
  const estadoLabels=['Finalizado','Cancelado']; const estadoData=[fin,canc]; const estadoColors=[COLORS.green,COLORS.red];
  if(otros>0){estadoLabels.push('Otro');estadoData.push(otros);estadoColors.push(COLORS.blueXl);}
  mk('chEstado',{type:'doughnut',data:{labels:estadoLabels,datasets:[{data:estadoData,backgroundColor:estadoColors,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:12}}}}});

  // Tipo de servicio
  const tipoCount = {};
  FILTERED.forEach(r=>{const t=r.tipo||'Sin dato'; tipoCount[t]=(tipoCount[t]||0)+1;});
  mk('chTipo',{type:'doughnut',data:{labels:Object.keys(tipoCount),datasets:[{data:Object.values(tipoCount),
    backgroundColor:BLUES,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:10}}}}});

  // Método de pago
  const pagoCount = {};
  FILTERED.forEach(r=>{pagoCount[r.metodoPago]=(pagoCount[r.metodoPago]||0)+1;});
  const pagoEntries = Object.entries(pagoCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
  mk('chPago',{type:'bar',data:{labels:pagoEntries.map(e=>e[0]),datasets:[{data:pagoEntries.map(e=>e[1]),
    backgroundColor:pagoEntries.map((_,i)=>BLUES[i%BLUES.length]),borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},
      scales:{x:{beginAtZero:true}}}});

  // Rango de km (con porcentajes) + tabla de detalle
  const km = kmStats();
  const kmColors = [COLORS.blue, COLORS.blueL, COLORS.gold, COLORS.navy];
  mk('chKm',{type:'doughnut',data:{
    labels:km.map((k,i)=>`${k.label} (${k.pct.toFixed(1)}%)`),
    datasets:[{data:km.map(k=>k.n),backgroundColor:kmColors,borderWidth:0,hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'56%',
      plugins:{legend:{position:'bottom',labels:{boxWidth:9,padding:8,font:{size:10.5}}}}}});
  renderKmTable(km, kmColors);

  // Top trabajadores
  const trabCount = {};
  FILTERED.forEach(r=>{trabCount[r.trabajador]=(trabCount[r.trabajador]||0)+1;});
  const topTrabSorted = Object.entries(trabCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const topTrab = trabOrientation==='h' ? [...topTrabSorted].reverse() : topTrabSorted;
  mk('chTrabajadores',{type:'bar',data:{labels:topTrab.map(e=>e[0]),datasets:[{data:topTrab.map(e=>e[1]),
    backgroundColor:COLORS.blue,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:trabOrientation==='h'?'y':'x',
      plugins:{legend:{display:false}},
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
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},
      scales:{x:{beginAtZero:true}}}});

  // Ingresos por semana
  const bySem = {};
  FILTERED.forEach(r=>{const k=isoWeekLabel(r.fecha); bySem[k]=(bySem[k]||0)+r.precioTotal;});
  const sems = Object.keys(bySem).sort();
  mk('chIngresosSemana',{type:'bar',data:{labels:sems,datasets:[{data:sems.map(s=>bySem[s]),
    backgroundColor:COLORS.navy,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>fmtCOP(c.parsed.y)}}},scales:{y:{ticks:{callback:v=>fmtCOPk(v)}}}}});
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
    const n = rows.length;
    const facturado = rows.reduce((a,r)=>a+r.precioTotal,0);
    return {
      label:b.label, n,
      pct: total ? n/total*100 : 0,
      kmProm: n ? rows.reduce((a,r)=>a+r.km,0)/n : 0,
      tAsign: n ? rows.reduce((a,r)=>a+r.minAsignado,0)/n : 0,
      tFin: n ? rows.reduce((a,r)=>a+r.minFinalizacion,0)/n : 0,
      ticket: n ? facturado/n : 0,
      facturado,
    };
  });
}

function renderKmTable(km, colors){
  const total = FILTERED.length;
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
      <td>${(FILTERED.reduce((a,r)=>a+r.minAsignado,0)/total).toFixed(0)} min</td>
      <td>${(FILTERED.reduce((a,r)=>a+r.minFinalizacion,0)/total).toFixed(0)} min</td>
      <td>${fmtCOP(facturadoTotal/total)}</td>
      <td>${fmtCOPk(facturadoTotal)}</td>
    </tr>`;
  }
  document.getElementById('kmTableBody').innerHTML = h;
}

/* ---------------- Process flow ---------------- */
function renderFlow(){
  const n = FILTERED.length;
  const avg = key => n ? FILTERED.reduce((a,r)=>a+r[key],0)/n : 0;
  const ticket = n ? FILTERED.reduce((a,r)=>a+r.precioTotal,0)/n : 0;
  const stages = [
    {ico:'📋',nm:'Asignación',v:avg('minAsignado').toFixed(0),unit:'min promedio'},
    {ico:'📍',nm:'1ª Parada',v:avg('minPrimeraParada').toFixed(0),unit:'min promedio'},
    {ico:'🏁',nm:'Finalización',v:avg('minFinalizacion').toFixed(0),unit:'min promedio'},
    {ico:'🎫',nm:'Ticket',v:fmtCOP(ticket),unit:'promedio COP',small:true},
  ];
  document.getElementById('pfFlow').innerHTML = stages.map(s=>`
    <div class="ps">
      <div class="ps-ico">${s.ico}</div>
      <div class="ps-nm">${s.nm}</div>
      <div class="ps-val"${s.small?' style="font-size:15px"':''}>${s.v}</div>
      <div class="ps-unit">${s.unit}</div>
    </div>`).join('');
}

/* ---------------- Table ---------------- */
function renderTable(){
  const sorted = [...FILTERED].sort((a,b)=>{
    let av, bv;
    switch(sortKey){
      case 'ID Servicio': av=+a.id; bv=+b.id; break;
      case 'Fecha de creación': av=a.fecha; bv=b.fecha; break;
      case 'Nombre Trabajador': av=a.trabajador; bv=b.trabajador; break;
      case 'Tipo de Servicio': av=a.tipo; bv=b.tipo; break;
      case 'Total (Km)': av=a.km; bv=b.km; break;
      case 'Precio Total': av=a.precioTotal; bv=b.precioTotal; break;
      case 'Estado': av=a.estado; bv=b.estado; break;
      default: av=a.fecha; bv=b.fecha;
    }
    if(av<bv) return -1*sortDir; if(av>bv) return 1*sortDir; return 0;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length/PAGE_SIZE));
  page = Math.min(page, totalPages);
  const start = (page-1)*PAGE_SIZE;
  const rows = sorted.slice(start, start+PAGE_SIZE);

  document.getElementById('detailBody').innerHTML = rows.map(r=>`
    <tr>
      <td>${r.id}</td>
      <td>${fmtDate(r.fecha)}</td>
      <td>${r.trabajador}</td>
      <td>${r.tipo||'-'}</td>
      <td>${r.km.toFixed(1)}</td>
      <td>${fmtCOP(r.precioTotal)}</td>
      <td><span class="bd ${r.estado==='Finalizado'?'gr':r.estado==='Cancelado'?'re':'tl'}">${r.estado||'-'}</span></td>
    </tr>`).join('');

  document.getElementById('pagerInfo').textContent =
    `${sorted.length.toLocaleString('es-CO')} servicios · página ${page} de ${totalPages}`;
  document.getElementById('pagerPrev').disabled = page<=1;
  document.getElementById('pagerNext').disabled = page>=totalPages;
}

function renderContext(){
  if(!FILTERED.length){
    document.getElementById('ctxPeriodo').textContent = 'Sin datos';
    document.getElementById('ctxTrabajador').textContent = '-';
    document.getElementById('ctxPago').textContent = '-';
    return;
  }
  const fechas = FILTERED.map(r=>r.fecha).sort((a,b)=>a-b);
  document.getElementById('ctxPeriodo').textContent =
    `${fmtDate(fechas[0]).split(' ')[0]} → ${fmtDate(fechas[fechas.length-1]).split(' ')[0]}`;

  const trabCount = {};
  FILTERED.forEach(r=>{trabCount[r.trabajador]=(trabCount[r.trabajador]||0)+1;});
  const topTrab = Object.entries(trabCount).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('ctxTrabajador').textContent = topTrab ? `${topTrab[0]} (${topTrab[1]})` : '-';

  const pagoCount = {};
  FILTERED.forEach(r=>{pagoCount[r.metodoPago]=(pagoCount[r.metodoPago]||0)+1;});
  const topPago = Object.entries(pagoCount).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('ctxPago').textContent = topPago ? topPago[0] : '-';
}

function renderAll(){
  renderKPIs();
  renderContext();
  renderCharts();
  renderFlow();
  renderTable();
}

/* ---------------- Wire up UI ---------------- */
document.getElementById('fDesde').addEventListener('change', applyFilters);
document.getElementById('fHasta').addEventListener('change', applyFilters);
document.getElementById('fEstado').addEventListener('change', applyFilters);
document.getElementById('fTipo').addEventListener('change', applyFilters);
document.getElementById('fTrabajador').addEventListener('input', ()=>{
  clearTimeout(window._tdeb); window._tdeb=setTimeout(applyFilters,250);
});
document.getElementById('btnClear').addEventListener('click', ()=>{
  document.getElementById('fEstado').value='';
  document.getElementById('fTipo').value='';
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
document.getElementById('pagerPrev').addEventListener('click', ()=>{page--; renderTable();});
document.getElementById('pagerNext').addEventListener('click', ()=>{page++; renderTable();});
document.querySelectorAll('.dt th[data-k]').forEach(th=>{
  th.addEventListener('click', ()=>{
    const k = th.dataset.k;
    if(sortKey===k) sortDir*=-1; else {sortKey=k; sortDir=-1;}
    page=1; renderTable();
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
