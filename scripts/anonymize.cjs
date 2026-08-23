// Genera data/data.public.csv a partir de data/data.csv, conservando SOLO las
// columnas que el dashboard realmente usa y anonimizando el nombre del trabajador
// (Trabajador 001, 002, ...) para poder publicar el repo en modo publico sin
// exponer datos personales de trabajadores ni del contacto de Colsubsidio.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'data', 'data.csv');
const OUT = path.join(__dirname, '..', 'data', 'data.public.csv');
const DELIM = ';';

// --- Parser RFC4180 minimo (soporta comillas, delimitador y saltos de linea dentro de campos) ---
function parseCSV(text, delim){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === delim){ row.push(field); field=''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row=[]; field=''; }
      else if(c === '\r'){ /* ignore, \n handles line end */ }
      else field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}

const KEEP = ['ID Servicio','Total (Km)','Precio Total','Ganancias','Valor Declarado',
  'Fecha de creación','Tipo de Servicio','Nombre Trabajador','Cantidad Paradas','Estado',
  'Método de Pago','Minutos Tiempo Asignado','Minutos Tiempo Primera Parada',
  'Minutos Tiempo Finalización','Razon de Cancelacion'];

console.log('Leyendo', SRC);
const text = fs.readFileSync(SRC, 'utf8');
const rows = parseCSV(text, DELIM);
const header = rows[0];
const idx = {};
KEEP.forEach(h => { idx[h] = header.indexOf(h); });
for(const h of KEEP){ if(idx[h] === -1) throw new Error('Columna no encontrada en el CSV origen: '+h); }

const workerMap = new Map();
let nextWorkerId = 1;
function anonWorker(name){
  const key = (name||'').trim().toLowerCase();
  if(!key) return 'Sin asignar';
  if(!workerMap.has(key)) workerMap.set(key, 'Trabajador ' + String(nextWorkerId++).padStart(3,'0'));
  return workerMap.get(key);
}

const outRows = [KEEP];
let kept = 0, skipped = 0;
for(let r=1;r<rows.length;r++){
  const row = rows[r];
  if(row.length < 2) continue; // linea vacia final
  const idServicio = row[idx['ID Servicio']];
  if(!idServicio || !/^\d+$/.test(String(idServicio).trim())){ skipped++; continue; }
  const out = KEEP.map(h => h === 'Nombre Trabajador' ? anonWorker(row[idx[h]]) : (row[idx[h]] ?? ''));
  outRows.push(out);
  kept++;
}

function esc(v){
  v = String(v ?? '');
  return /[;"\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
}
const csv = outRows.map(r => r.map(esc).join(DELIM)).join('\n') + '\n';
fs.writeFileSync(OUT, csv, 'utf8');
console.log(`Listo: ${kept} filas conservadas, ${skipped} omitidas (invalidas).`);
console.log(`Trabajadores anonimizados: ${workerMap.size}`);
console.log('Escrito en', OUT);
