# BI Colsubsidio · Nodo Kennedy (Quick Go)

Dashboard de indicadores operativos para el nodo Kennedy de Colsubsidio. Es un sitio
100% estático (HTML/CSS/JS) pensado para publicarse en **GitHub Pages**, con colores
corporativos de Quick (navy + naranja) tomados del informe original
`Colsubsidio_Kennedy_Presentacion 34.html`.

> ⚠️ **Datos sensibles**: `data/data.csv` contiene nombres, teléfonos, correos y
> cédulas de trabajadores y del contacto en Colsubsidio. Este repositorio debe
> mantenerse **privado**. No lo hagas público sin anonimizar antes esas columnas.

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

### 2. Actualización permanente (lo que ve todo el equipo)
1. Exporta la data del sistema como CSV (mismo formato de columnas que el actual).
2. Reemplaza el archivo `data/data.csv` de este repositorio con el nuevo export
   (debe conservar el nombre `data.csv` y el separador `;`).
3. Sube el cambio a GitHub:
   ```bash
   git add data/data.csv
   git commit -m "Actualizar data del nodo Kennedy (dd-mm-aaaa)"
   git push
   ```
4. GitHub Pages se actualiza solo en 1–2 minutos. No requiere ningún build ni paso adicional.

El dashboard siempre carga `data/data.csv` automáticamente al abrir la página — no hace
falta editar nada del código para que refleje la data nueva.

## Previsualizar en local antes de publicar

El navegador bloquea `fetch()` de archivos locales abiertos con doble clic
(`file://`), así que para probar cambios localmente usa un servidor mínimo:

```bash
node _devserver.cjs 5173
```

Y abre `http://localhost:5173` en el navegador.

## Publicar en GitHub Pages

1. Crea el repositorio en GitHub (⚠️ **privado**, dado que contiene datos personales).
2. Súbelo:
   ```bash
   git remote add origin <URL-del-repo>
   git branch -M main
   git push -u origin main
   ```
3. En GitHub → *Settings → Pages* → *Source*: rama `main`, carpeta `/ (root)`.
4. La URL quedará como `https://<usuario>.github.io/<repo>/`.

> Nota: con el repo **privado**, GitHub Pages solo es visible para quienes tengan
> acceso al repositorio (requiere plan GitHub Pro/Team/Enterprise para Pages privado
> en cuentas personales, o cualquier plan si es una organización). Si tu cuenta no
> tiene Pages disponible en modo privado, la alternativa es compartir el repo con las
> personas necesarias y que cada una lo corra localmente con `_devserver.cjs`.

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
