# BI Colsubsidio · Nodo Kennedy (Quick Go)

Dashboard de indicadores operativos para el nodo Kennedy de Colsubsidio. Es un sitio
100% estático (HTML/CSS/JS), con colores corporativos de Quick (navy + naranja)
tomados del informe original `Colsubsidio_Kennedy_Presentacion 34.html`.

Publicado en: https://sergio1060.github.io/Nodo-Kennedy/

> ⚠️ **Este repo es público.** `data/data.csv` solo debe contener las columnas que
> usa el dashboard (sin cédulas, teléfonos, correos ni direcciones). La GitHub Action
> `actualizar-data.yml` recorta automáticamente cualquier export que se suba.

## Estructura

```
bi-colsubsidio/
├── index.html          # Dashboard (KPIs, gráficas, tabla de detalle)
├── css/styles.css       # Estilos, paleta de colores Quick
├── js/app.js            # Carga de datos, filtros, gráficas (Chart.js + PapaParse)
├── js/publicar.js       # Botón "Actualizar data para todos" (publica vía API de GitHub)
├── data/data.csv        # Data publicada (solo columnas del dashboard, separada por ";")
├── scripts/procesar-data.cjs         # Recorta un export del sistema a data/data.csv
├── .github/workflows/actualizar-data.yml  # Procesa y publica cada CSV subido a data/
└── _devserver.cjs       # Servidor local mínimo solo para previsualizar (no se usa en producción)
```

## Cómo actualizar la data (desde el mismo dashboard)

1. Exporta la data del sistema como CSV (el mismo export de siempre, separado por `;`).
2. En el dashboard pulsa **"⭱ Actualizar data para todos"**, elige el archivo y pulsa
   **Publicar**. La primera vez pide un token de GitHub (ver abajo); luego lo recuerda.
3. El dashboard recorta el archivo **en tu equipo** a las columnas que usa (las
   cédulas, teléfonos y correos nunca se suben) y lo guarda como `data/data.csv`.
4. En 1–3 minutos todos los que abran el link ven la versión nueva; el mismo cuadro
   avisa cuando ya está visible. La etiqueta superior **"Datos al …"** muestra la
   fecha del último servicio.

El botón **"👁 Vista previa (solo aquí)"** carga un CSV solo en tu navegador:
**no** cambia lo que ven los demás.

### Token para publicar desde el dashboard

Como el sitio es estático, publicar requiere permiso de escritura sobre este repo.
Cada persona que vaya a actualizar necesita un token (se crea una sola vez):

1. El dueño del repo invita a la persona: **Settings → Collaborators → Add people**
   (si es el mismo dueño quien publica, omite este paso).
2. La persona, con su cuenta de GitHub, entra a
   **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token** (https://github.com/settings/personal-access-tokens/new):
   - *Resource owner*: **Sergio1060** · *Repository access*: **Only select repositories → Nodo-Kennedy**
   - *Permissions → Repository permissions → Contents*: **Read and write**
   - *Expiration*: la que prefiera (al vencer, el dashboard vuelve a pedirlo).
3. Copia el token (`github_pat_…`) y pégalo en el cuadro del dashboard la primera vez.
   Queda guardado solo en ese navegador; con "Cambiar token" se borra.

Nunca pegues el token en el código ni lo compartas por chat: quien lo tenga puede
modificar el repositorio.

### Alternativa: subir el archivo directo en GitHub

En GitHub, carpeta **`data/`** → **Add file → Upload files**, arrastra el CSV (con
cualquier nombre) y **Commit changes**. La Action **"Actualizar data del dashboard"**
lo recorta, borra el archivo subido y publica. Ojo: por esta vía el export completo
queda unos minutos en el historial público del repo; es preferible el botón del
dashboard. Si la Action falla (✗ roja en *Actions*), el log dice qué columnas faltan
y el dashboard sigue mostrando la última data válida.

## Previsualizar en local antes de publicar

El navegador bloquea `fetch()` de archivos locales abiertos con doble clic
(`file://`), así que para probar cambios localmente usa un servidor mínimo:

```bash
node _devserver.cjs 5173
```

Y abre `http://localhost:5173` en el navegador.

## GitHub Pages

Se publica desde la rama `main` de `Sergio1060/Nodo-Kennedy` (raíz del repo).

## Indicadores incluidos

- Totales: servicios, finalizados, cancelados, ingresos, ganancias
- Tiempo promedio de entrega, km promedio, valor declarado promedio, trabajadores activos
- Evolución diaria de servicios
- Distribución por estado, tipo de servicio, método de pago y rango de distancia
- Tiempos promedio por etapa del proceso (asignación → primera parada → finalización)
- Top 10 trabajadores por volumen y principales motivos de cancelación
- Ingresos por semana
- Tabla de detalle de servicios, ordenable y paginada

## Filtros disponibles

Rango de fechas, estado, tipo de servicio y búsqueda por nombre de trabajador —
todas las gráficas y KPIs se recalculan en vivo al aplicar filtros.
