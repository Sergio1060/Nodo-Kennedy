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
├── data/data.csv        # Data publicada (solo columnas del dashboard, separada por ";")
├── scripts/procesar-data.cjs         # Recorta un export del sistema a data/data.csv
├── .github/workflows/actualizar-data.yml  # Procesa y publica cada CSV subido a data/
└── _devserver.cjs       # Servidor local mínimo solo para previsualizar (no se usa en producción)
```

## Cómo actualizar la data (cualquier persona con acceso al repo)

1. Exporta la data del sistema como CSV (el mismo export de siempre, separado por `;`).
2. En GitHub entra a la carpeta **`data/`** → **Add file → Upload files**, arrastra el
   CSV (puede tener cualquier nombre) y pulsa **Commit changes**.
3. La Action **"Actualizar data del dashboard"** (pestaña *Actions*) se ejecuta sola:
   - toma el CSV recién subido y lo convierte en `data/data.csv` con solo las
     columnas del dashboard (sin cédulas, teléfonos, correos ni direcciones),
   - borra el archivo subido y publica.
4. En 1–3 minutos todos los que abran el link ven la versión nueva. El dashboard
   pide `data.csv?v=<hora>`, así que nadie queda con una copia vieja en caché.
   La etiqueta superior **"Datos al …"** muestra la fecha del último servicio para
   confirmar que ya se actualizó.

Si la Action falla (✗ roja en *Actions*), normalmente es porque el archivo no es el
export del sistema: el log dice qué columnas faltan. El dashboard sigue mostrando la
última data válida.

El botón **"⭱ Actualizar data (CSV)"** del dashboard sirve solo para una vista
previa en tu navegador: **no** cambia lo que ven los demás.

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
