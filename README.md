# BI Colsubsidio · Nodo Kennedy (Quick Go)

Dashboard de indicadores operativos para el nodo Kennedy de Colsubsidio. Es un sitio
100% estático (HTML/CSS/JS), con colores corporativos de Quick (navy + naranja)
tomados del informe original `Colsubsidio_Kennedy_Presentacion 34.html`.

Publicado en: https://sergio1060.github.io/Nodo-Kennedy/

> ⚠️ **Este repo es público.** `data/data.csv` solo debe contener las columnas que
> usa el dashboard (sin cédulas, teléfonos, correos ni direcciones). Nunca copies el
> export completo del sistema directamente: usa siempre `ACTUALIZAR DATA.cmd`.

## Estructura

```
bi-colsubsidio/
├── index.html          # Dashboard (KPIs, gráficas, tabla de detalle)
├── css/styles.css       # Estilos, paleta de colores Quick
├── js/app.js            # Carga de datos, filtros, gráficas (Chart.js + PapaParse)
├── data/data.csv        # Data fuente (exportación del sistema, separada por ";")
└── _devserver.cjs       # Servidor local mínimo solo para previsualizar (no se usa en producción)
```

## Cómo actualizar la data (para que todos vean lo nuevo)

1. Exporta la data del sistema como CSV (mismo formato, separado por `;`).
2. **Arrastra el CSV encima de `ACTUALIZAR DATA.cmd`** (o haz doble clic y elígelo).
   El script:
   - deja en `data/data.csv` solo las columnas del dashboard,
   - hace commit y push a GitHub.
3. En 1–2 minutos GitHub Pages publica la nueva versión. El dashboard pide
   `data.csv?v=<hora>`, así que cada persona que abra el link ve la data nueva
   sin caché. La etiqueta superior muestra **"Datos al …"** con la fecha del
   último servicio, para confirmar que ya se actualizó.

Desde consola es lo mismo: `node scripts/actualizar.cjs "ruta\export.csv"`
(opciones: `--no-push` para solo preparar el archivo, `--anonimizar` para
reemplazar nombres de trabajadores por `Trabajador 001…`).

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
