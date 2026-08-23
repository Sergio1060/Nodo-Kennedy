# BI Colsubsidio · Nodo Kennedy (Quick Go) — repositorio privado (data completa)

Dashboard de indicadores operativos para el nodo Kennedy de Colsubsidio. Es un sitio
100% estático (HTML/CSS/JS), con colores corporativos de Quick (navy + naranja)
tomados del informe original `Colsubsidio_Kennedy_Presentacion 34.html`.

> ⚠️ **Datos sensibles**: `data/data.csv` contiene nombres, teléfonos, correos y
> cédulas de trabajadores y del contacto en Colsubsidio. Este repositorio debe
> mantenerse **privado** siempre.

## Dos repositorios, un solo dashboard

Como GitHub Pages en cuenta gratuita no permite repos privados, este proyecto vive
en dos repositorios:

- **Este repo (privado)** — data completa, fuente de verdad. Aquí se actualiza la
  data cruda cada vez que llega un nuevo export del sistema.
- **`bi-colsubsidio-public`** — mismo dashboard, pero con `data/data.csv`
  **anonimizado** (sin nombres, teléfonos, correos ni cédulas; trabajadores
  reemplazados por códigos tipo `Trabajador 001`). Ese es el repo público con
  GitHub Pages activado.

El script `scripts/anonymize.cjs` (en este repo) genera la versión pública a partir
de la data completa — ver instrucciones abajo.

## Estructura

```
bi-colsubsidio/
├── index.html          # Dashboard (KPIs, gráficas, tabla de detalle)
├── css/styles.css       # Estilos, paleta de colores Quick
├── js/app.js            # Carga de datos, filtros, gráficas (Chart.js + PapaParse)
├── data/data.csv        # Data fuente (exportación del sistema, separada por ";")
└── _devserver.cjs       # Servidor local mínimo solo para previsualizar (no se usa en producción)
```

## Cómo actualizar la data

Hay dos formas de cargar datos nuevos, para dos necesidades distintas:

### 1. Vista rápida / puntual (sin tocar GitHub)
En la barra superior del dashboard, botón **"⭱ Actualizar data (CSV)"** → selecciona
el nuevo export del sistema (mismo formato, separado por `;`). El dashboard recalcula
todo al instante, pero **solo en tu navegador** — no cambia lo que ven los demás.
Útil para revisar un archivo antes de publicarlo.

### 2. Actualización permanente en este repo privado (respaldo con data completa)
1. Exporta la data del sistema como CSV (mismo formato de columnas que el actual).
2. Reemplaza el archivo `data/data.csv` de este repositorio con el nuevo export
   (debe conservar el nombre `data.csv` y el separador `;`).
3. Sube el cambio a GitHub:
   ```bash
   git add data/data.csv
   git commit -m "Actualizar data del nodo Kennedy (dd-mm-aaaa)"
   git push
   ```

### 3. Publicar esa actualización en el dashboard público (el que ve el equipo)
1. En este repo, corre:
   ```bash
   node scripts/anonymize.cjs
   ```
   Esto genera `data/data.public.csv` (sin datos personales, trabajadores anonimizados).
2. Copia ese archivo a la carpeta `bi-colsubsidio-public` como `data/data.csv`.
3. Desde `bi-colsubsidio-public`, sube el cambio:
   ```bash
   git add data/data.csv
   git commit -m "Actualizar data anonimizada del nodo Kennedy (dd-mm-aaaa)"
   git push
   ```
4. GitHub Pages se actualiza solo en 1–2 minutos.

## Previsualizar en local antes de publicar

El navegador bloquea `fetch()` de archivos locales abiertos con doble clic
(`file://`), así que para probar cambios localmente usa un servidor mínimo:

```bash
node _devserver.cjs 5173
```

Y abre `http://localhost:5173` en el navegador.

## GitHub Pages

Este repo **no** usa GitHub Pages (debe quedar privado). El dashboard con URL
pública vive en el repo `bi-colsubsidio-public` — ver su propio README.

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
