/* ============ Publicar data para todos desde el dashboard ============
   El sitio es estatico (GitHub Pages), asi que para que una carga la vean todos
   hay que escribir data/data.csv en el repo. Se hace con la API de GitHub usando
   un token personal que cada persona ingresa una vez (se guarda solo en su equipo).
   El export se recorta AQUI en el navegador a las columnas del dashboard: las
   cedulas, telefonos y correos nunca salen del computador de quien sube. */
(function(){
const REPO = 'Sergio1060/Nodo-Kennedy', PATH = 'data/data.csv', BRANCH = 'main';
const LIVE_URL = 'data/data.csv';
const TOKEN_KEY = 'nk_gh_token';
// Mismas columnas que scripts/procesar-data.cjs
const KEEP = ['ID Servicio','Total (Km)','Precio Total','Ganancias','Valor Declarado',
  'Fecha de creación','Tipo de Servicio','Nombre Trabajador','Cantidad Paradas','Estado',
  'Método de Pago','Minutos Tiempo Asignado','Minutos Tiempo Primera Parada',
  'Minutos Tiempo Finalización','Razon de Cancelacion'];

const $ = id => document.getElementById(id);
let sessionToken = '', busy = false, pollTimer = null;

function storedToken(){ try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
function storeToken(t){ try { localStorage.setItem(TOKEN_KEY, t); } catch {} }
function forgetToken(){ sessionToken = ''; try { localStorage.removeItem(TOKEN_KEY); } catch {} }
function currentToken(){ return sessionToken || storedToken(); }

function msg(text, cls){ const el = $('pubMsg'); el.textContent = text; el.className = 'mmsg ' + (cls||''); }
function refreshTokenUI(){
  const has = !!currentToken();
  $('pubTokenWrap').hidden = has;
  $('pubTokenSaved').hidden = !has;
}
function openModal(){
  if(busy) { $('pubModal').hidden = false; return; }
  $('pubFile').value = ''; msg('');
  refreshTokenUI();
  $('pubModal').hidden = false;
}
function closeModal(){ if(!busy) $('pubModal').hidden = true; }

function parseFile(file, encoding){
  return new Promise((resolve, reject) => Papa.parse(file, {
    header:true, delimiter:';', skipEmptyLines:true, encoding,
    complete: resolve, error: reject,
  }));
}

// Exports guardados desde Excel pueden venir en ANSI en vez de UTF-8: se usa la
// codificacion con la que aparecen las columnas esperadas.
async function leerExport(file){
  let missing = [];
  for(const enc of ['UTF-8', 'ISO-8859-1']){
    const res = await parseFile(file, enc);
    const byName = {};
    (res.meta.fields || []).forEach(f => { byName[f.replace(/^﻿/, '').trim()] = f; });
    missing = KEEP.filter(k => !(k in byName));
    if(missing.length) continue;
    const rows = res.data
      .filter(r => /^\d+$/.test(String(r[byName['ID Servicio']] || '').trim()))
      .map(r => KEEP.map(k => r[byName[k]] ?? ''));
    if(!rows.length) throw new Error('El archivo no contiene servicios válidos.');
    return rows;
  }
  throw new Error('El archivo no es el export del sistema (CSV separado por ";"). Faltan columnas: ' + missing.join(', '));
}

function ultimaFecha(rows){
  const i = KEEP.indexOf('Fecha de creación');
  let best = null, txt = '';
  rows.forEach(r => {
    const m = String(r[i]||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(!m) return;
    const d = new Date(+m[3], +m[2]-1, +m[1]);
    if(!best || d > best){ best = d; txt = `${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}-${m[3]}`; }
  });
  return txt;
}

// Mismo formato que scripts/procesar-data.cjs: comillas solo cuando hacen falta.
function toCSV(rows){
  const esc = v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
  return rows.map(r => r.map(esc).join(';')).join('\n') + '\n';
}

function utf8Base64(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for(let i=0;i<bytes.length;i+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000));
  return btoa(bin);
}

async function gh(method, url, token, body){
  const res = await fetch('https://api.github.com/repos/' + REPO + url, {
    method, cache:'no-store',
    headers: Object.assign({
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }, body ? {'Content-Type':'application/json'} : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if(!res.ok){ const e = new Error(json.message || ('HTTP ' + res.status)); e.status = res.status; throw e; }
  return json;
}

async function subirAGitHub(csv, hasta, token){
  const message = `Actualizar data del nodo Kennedy (hasta ${hasta}) desde el dashboard`;
  for(let intento=0; intento<2; intento++){
    const actual = await gh('GET', `/contents/${PATH}?ref=${BRANCH}`, token);
    try {
      return await gh('PUT', `/contents/${PATH}`, token, { message, content: utf8Base64(csv), sha: actual.sha, branch: BRANCH });
    } catch(e){
      // 409: alguien publico al mismo tiempo; se reintenta con el sha nuevo.
      if(e.status !== 409 || intento) throw e;
    }
  }
}

function explicarError(e){
  if(e.status === 401) return 'El token no es válido o ya venció. Ingresa uno nuevo.';
  if(e.status === 403 || e.status === 404) return 'El token no tiene permiso para escribir en el repositorio Nodo-Kennedy (necesita "Contents: Read and write").';
  if(e.status === 422) return 'GitHub rechazó el archivo: ' + e.message;
  return e.message || String(e);
}

// Espera a que GitHub Pages sirva la version nueva para confirmar que ya la ven todos.
function esperarPublicacion(csv){
  clearInterval(pollTimer);
  const inicio = Date.now();
  pollTimer = setInterval(async () => {
    try {
      const txt = await (await fetch(LIVE_URL + '?v=' + Date.now(), {cache:'no-store'})).text();
      if(txt.replace(/\r/g,'') === csv){
        clearInterval(pollTimer);
        setStatus('✓ Data publicada: ya la ven todos los que abran el link.', 'ok');
        msg('✓ Listo: la data nueva ya está visible para todos.', 'ok');
      } else if(Date.now() - inicio > 8*60*1000){
        clearInterval(pollTimer);
        msg('La data se guardó en GitHub pero la página aún no se refresca. Revisa en unos minutos (pestaña Actions del repositorio).', 'warn');
      }
    } catch { /* reintenta en el siguiente ciclo */ }
  }, 15000);
}

async function publicar(){
  const file = $('pubFile').files[0];
  if(!file){ msg('Selecciona el archivo CSV exportado del sistema.', 'err'); return; }
  let token = currentToken();
  if(!token){
    token = $('pubToken').value.trim();
    if(!token){ msg('Ingresa el token de GitHub (solo se pide la primera vez).', 'err'); return; }
  }

  busy = true; $('pubGo').disabled = true; $('pubCancel').disabled = true;
  try {
    msg('Leyendo y preparando el archivo...');
    const rows = await leerExport(file);
    const hasta = ultimaFecha(rows);
    const csv = toCSV([KEEP, ...rows]);

    msg(`Publicando ${rows.length.toLocaleString('es-CO')} servicios (hasta ${hasta})...`);
    await subirAGitHub(csv, hasta, token);

    if(!currentToken()){
      if($('pubRemember').checked) storeToken(token); else sessionToken = token;
    }
    refreshTokenUI();
    // Mostrar de inmediato la data nueva en esta pantalla.
    onData(rows.map(r => Object.fromEntries(KEEP.map((k,i) => [k, r[i]]))), 'publicada para todos (GitHub Pages actualiza en 1–3 min)');
    msg(`✓ Publicado (${rows.length.toLocaleString('es-CO')} servicios, hasta ${hasta}). GitHub tarda 1–3 minutos en mostrarla a todos; te aviso aquí cuando esté.`, 'ok');
    esperarPublicacion(csv);
  } catch(e){
    if(e.status === 401) forgetToken();
    refreshTokenUI();
    msg(explicarError(e), 'err');
  } finally {
    busy = false; $('pubGo').disabled = false; $('pubCancel').disabled = false;
  }
}

$('btnPublicar').addEventListener('click', openModal);
$('pubCancel').addEventListener('click', closeModal);
$('pubModal').addEventListener('click', e => { if(e.target === $('pubModal')) closeModal(); });
$('pubForget').addEventListener('click', () => { forgetToken(); refreshTokenUI(); });
$('pubGo').addEventListener('click', publicar);
})();
