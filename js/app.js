/* ============ Colsubsidio · Nodo Kennedy · BI Operativo (Quick Go) ============ */

const COLORS = {orange:'#C55A11',orange2:'#E06520',gold:'#F0A500',teal:'#00B4C8',
  green:'#00C87A',red:'#E03030',purple:'#9B5DE5',muted:'#7B8FA8'};

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
  setStatus(`✓ ${RAW.length.toLocaleString('es-CO')} servicios cargados — ${sourceLabel}`, 'ok');

  const fechas = RAW.map(r=>r.fecha).sort((a,b)=>a-b);
  document.getElementById('periodLabel').textContent =
    `${fmtDate(fechas[0]).split(' ')[0]} — ${fmtDate(fechas[fechas.length-1]).split(' ')[0]}`;
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

  document.getElementById('kTotal').textContent = n.toLocaleString('es-CO');
  document.getElementById('kFin').textContent = fin.length.toLocaleString('es-CO');
  document.getElementById('kFinPct').textContent = n ? (fin.length/n*100).toFixed(1)+'% del total' : '';
  document.getElementById('kCanc').textContent = canc.length.toLocaleString('es-CO');
  document.getElementById('kCancPct').textContent = n ? (canc.length/n*100).toFixed(1)+'% del total' : '';
  document.getElementById('kIngresos').textContent = fmtCOPk(ingresos);
  document.getElementById('kGanancias').textContent = fmtCOPk(ganancias);
  document.getElementById('kTiempoEntrega').textContent = fmtMin(avgTiempoEntrega);
  document.getElementById('kKm').textContent = avgKm.toFixed(1)+' km';
  document.getElementById('kValorDecl').textContent = fmtCOPk(avgValorDecl);
  document.getElementById('kTrabajadores').textContent = trabajadoresActivos.toLocaleString('es-CO');
}

/* ---------------- Charts ---------------- */
function dc(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function mk(id,cfg){dc(id);const el=document.getElementById(id);if(!el)return;charts[id]=new Chart(el,cfg);}
const CD_TEXT = '#7B8FA8';
Chart.defaults.color = CD_TEXT;
Chart.defaults.font.family = "'Barlow',sans-serif";
Chart.defaults.borderColor = 'rgba(255,255,255,.06)';

function renderCharts(){
  // Evolución por día
  const byDay = {};
  FILTERED.forEach(r=>{const k=dayKey(r.fecha); byDay[k]=(byDay[k]||0)+1;});
  const days = Object.keys(byDay).sort();
  mk('chEvol',{type:'line',data:{labels:days,datasets:[{label:'Servicios',data:days.map(d=>byDay[d]),
    borderColor:COLORS.orange,backgroundColor:'rgba(197,90,17,.15)',fill:true,tension:.3,pointRadius:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{ticks:{maxTicksLimit:10}},y:{beginAtZero:true}}}});

  // Estado
  const fin = FILTERED.filter(r=>r.estado==='Finalizado').length;
  const canc = FILTERED.filter(r=>r.estado==='Cancelado').length;
  const otros = FILTERED.length - fin - canc;
  const estadoLabels=['Finalizado','Cancelado']; const estadoData=[fin,canc]; const estadoColors=[COLORS.green,COLORS.red];
  if(otros>0){estadoLabels.push('Otro');estadoData.push(otros);estadoColors.push(COLORS.muted);}
  mk('chEstado',{type:'doughnut',data:{labels:estadoLabels,datasets:[{data:estadoData,backgroundColor:estadoColors,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:12}}}}});

  // Tipo de servicio
  const tipoCount = {};
  FILTERED.forEach(r=>{const t=r.tipo||'Sin dato'; tipoCount[t]=(tipoCount[t]||0)+1;});
  mk('chTipo',{type:'doughnut',data:{labels:Object.keys(tipoCount),datasets:[{data:Object.values(tipoCount),
    backgroundColor:[COLORS.teal,COLORS.orange,COLORS.purple,COLORS.gold],borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:10}}}}});

  // Método de pago
  const pagoCount = {};
  FILTERED.forEach(r=>{pagoCount[r.metodoPago]=(pagoCount[r.metodoPago]||0)+1;});
  const pagoEntries = Object.entries(pagoCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
  mk('chPago',{type:'bar',data:{labels:pagoEntries.map(e=>e[0]),datasets:[{data:pagoEntries.map(e=>e[1]),
    backgroundColor:COLORS.teal,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},
      scales:{x:{beginAtZero:true}}}});

  // Rango de km
  const kmBuckets=[0,0,0,0]; // 0-4,5-10,11-20,21+
  FILTERED.forEach(r=>{
    if(r.km<=4) kmBuckets[0]++; else if(r.km<=10) kmBuckets[1]++; else if(r.km<=20) kmBuckets[2]++; else kmBuckets[3]++;
  });
  mk('chKm',{type:'bar',data:{labels:['0–4 km','5–10 km','11–20 km','21 km+'],datasets:[{data:kmBuckets,
    backgroundColor:[COLORS.green,COLORS.teal,COLORS.gold,COLORS.purple],borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});

  // Top trabajadores
  const trabCount = {};
  FILTERED.forEach(r=>{trabCount[r.trabajador]=(trabCount[r.trabajador]||0)+1;});
  const topTrab = Object.entries(trabCount).sort((a,b)=>b[1]-a[1]).slice(0,10).reverse();
  mk('chTrabajadores',{type:'bar',data:{labels:topTrab.map(e=>e[0]),datasets:[{data:topTrab.map(e=>e[1]),
    backgroundColor:COLORS.orange,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},
      scales:{x:{beginAtZero:true}}}});

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
    backgroundColor:COLORS.gold,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>fmtCOP(c.parsed.y)}}},scales:{y:{ticks:{callback:v=>fmtCOPk(v)}}}}});
}

/* ---------------- Process flow ---------------- */
function renderFlow(){
  const n = FILTERED.length;
  const avg = key => n ? FILTERED.reduce((a,r)=>a+r[key],0)/n : 0;
  const stages = [
    {ico:'📋',nm:'Asignación',v:avg('minAsignado')},
    {ico:'📍',nm:'1ª Parada',v:avg('minPrimeraParada')},
    {ico:'🏁',nm:'Finalización',v:avg('minFinalizacion')},
  ];
  document.getElementById('pfFlow').innerHTML = stages.map(s=>`
    <div class="ps">
      <div class="ps-ico">${s.ico}</div>
      <div class="ps-nm">${s.nm}</div>
      <div class="ps-val">${s.v.toFixed(0)}</div>
      <div class="ps-unit">min promedio</div>
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

function renderAll(){
  renderKPIs();
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
