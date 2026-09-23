// Publica un nuevo export del sistema en el dashboard (GitHub Pages).
//
//   node scripts/actualizar.cjs "C:\ruta\al\export.csv" [--no-push] [--anonimizar]
//
// 1. Lee el export completo (separado por ";").
// 2. Escribe data/data.csv SOLO con las columnas que usa el dashboard: el repo es
//    publico, asi que nunca se suben cedulas, telefonos, correos ni direcciones.
//    Con --anonimizar tambien reemplaza el nombre del trabajador (Trabajador 001...).
// 3. Hace commit y push; GitHub Pages publica en 1-2 minutos y, como el dashboard
//    pide data.csv?v=<timestamp>, todos los que abran el link ven la data nueva.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'data', 'data.csv');
const DELIM = ';';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const src = args.find(a => !a.startsWith('--'));
if(!src){
  console.error('Uso: node scripts/actualizar.cjs "ruta\\al\\export.csv" [--no-push] [--anonimizar]');
  process.exit(1);
}
if(!fs.existsSync(src)){ console.error('No existe el archivo: ' + src); process.exit(1); }

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

console.log('Leyendo', src);
const text = fs.readFileSync(src, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCSV(text, DELIM);
const header = rows[0].map(h => h.trim());
const idx = {};
KEEP.forEach(h => { idx[h] = header.indexOf(h); });
const missing = KEEP.filter(h => idx[h] === -1);
if(missing.length){
  console.error('El archivo no tiene el formato esperado. Faltan columnas: ' + missing.join(', '));
  console.error('Verifica que sea el export del sistema separado por ";".');
  process.exit(1);
}

const workerMap = new Map();
function anonWorker(name){
  const key = (name||'').trim().toLowerCase();
  if(!key) return '';
  if(!workerMap.has(key)) workerMap.set(key, 'Trabajador ' + String(workerMap.size+1).padStart(3,'0'));
  return workerMap.get(key);
}
const anonimizar = flags.has('--anonimizar');

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
if(outRows.length < 2){ console.error('El archivo no contiene servicios validos.'); process.exit(1); }

function esc(v){
  v = String(v ?? '');
  return /[;"\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
}
fs.writeFileSync(OUT, outRows.map(r => r.map(esc).join(DELIM)).join('\n') + '\n', 'utf8');
console.log(`OK: ${outRows.length-1} servicios, data hasta ${ultimaTxt}` + (anonimizar ? `, ${workerMap.size} trabajadores anonimizados` : ''));

if(flags.has('--no-push')){ console.log('--no-push: data/data.csv actualizado, sin publicar.'); process.exit(0); }

const git = (...a) => execFileSync('git', a, { cwd: REPO, stdio: 'inherit' });
git('add', 'data/data.csv');
try {
  execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: REPO });
  console.log('La data es identica a la ya publicada; no hay nada que subir.');
  process.exit(0);
} catch { /* hay cambios */ }
git('commit', '-m', `Actualizar data del nodo Kennedy (hasta ${ultimaTxt})`);
git('push');
console.log('\nPublicado. En 1-2 minutos se ve en https://sergio1060.github.io/Nodo-Kennedy/');
