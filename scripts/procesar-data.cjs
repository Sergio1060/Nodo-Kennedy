// Convierte un export del sistema en data/data.csv (lo que lee el dashboard).
// Lo ejecuta automaticamente la GitHub Action .github/workflows/actualizar-data.yml
// cada vez que alguien sube un CSV a la carpeta data/ desde GitHub.
//
//   node scripts/procesar-data.cjs <export.csv> [--anonimizar]
//
// El repo es publico: data/data.csv queda SOLO con las columnas que usa el
// dashboard, sin cedulas, telefonos, correos ni direcciones.
// Con --anonimizar tambien reemplaza el nombre del trabajador (Trabajador 001...).
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'data.csv');
const DELIM = ';';

const args = process.argv.slice(2);
const src = args.find(a => !a.startsWith('--'));
const anonimizar = args.includes('--anonimizar');
if(!src || !fs.existsSync(src)){
  console.error('Uso: node scripts/procesar-data.cjs <export.csv> [--anonimizar]');
  process.exit(1);
}

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

// Columnas que lee js/app.js. Si el dashboard empieza a usar otra, agregarla aqui.
const KEEP = ['ID Servicio','Total (Km)','Precio Total','Ganancias','Valor Declarado',
  'Fecha de creación','Tipo de Servicio','Nombre Trabajador','Cantidad Paradas','Estado',
  'Método de Pago','Minutos Tiempo Asignado','Minutos Tiempo Primera Parada',
  'Minutos Tiempo Finalización','Razon de Cancelacion'];

// Exports guardados desde Excel suelen venir en ANSI (latin1) en vez de UTF-8:
// se usa la codificacion con la que aparecen las columnas esperadas.
const buf = fs.readFileSync(src);
let rows, idx, missing;
for(const enc of ['utf8','latin1']){
  rows = parseCSV(buf.toString(enc).replace(/^﻿/, ''), DELIM);
  const header = rows[0].map(h => h.trim());
  idx = {};
  KEEP.forEach(h => { idx[h] = header.indexOf(h); });
  missing = KEEP.filter(h => idx[h] === -1);
  if(!missing.length) break;
}
if(missing.length){
  console.error('::error::El archivo no tiene el formato esperado (export separado por ";"). Faltan columnas: ' + missing.join(', '));
  process.exit(1);
}

const workerMap = new Map();
function anonWorker(name){
  const key = (name||'').trim().toLowerCase();
  if(!key) return '';
  if(!workerMap.has(key)) workerMap.set(key, 'Trabajador ' + String(workerMap.size+1).padStart(3,'0'));
  return workerMap.get(key);
}

const outRows = [KEEP];
let ultima = null, ultimaTxt = '';
for(let r=1;r<rows.length;r++){
  const row = rows[r];
  const id = row[idx['ID Servicio']];
  if(!id || !/^\d+$/.test(String(id).trim())) continue;
  outRows.push(KEEP.map(h => (anonimizar && h === 'Nombre Trabajador') ? anonWorker(row[idx[h]]) : (row[idx[h]] ?? '')));
  const m = String(row[idx['Fecha de creación']]||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m){
    const d = new Date(+m[3], +m[2]-1, +m[1]);
    if(!ultima || d > ultima){ ultima = d; ultimaTxt = `${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}-${m[3]}`; }
  }
}
if(outRows.length < 2){ console.error('::error::El archivo no contiene servicios validos.'); process.exit(1); }

function esc(v){
  v = String(v ?? '');
  return /[;"\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
}
fs.writeFileSync(OUT, outRows.map(r => r.map(esc).join(DELIM)).join('\n') + '\n', 'utf8');
console.log(`OK: ${outRows.length-1} servicios, data hasta ${ultimaTxt}`);
// La Action usa esta linea para el mensaje del commit.
if(process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `hasta=${ultimaTxt}\n`);
