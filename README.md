# REA Eléctrico: cálculo y diseño de instalaciones eléctricas

Aplicación web para crear diagramas unifilares y calcular instalaciones eléctricas de baja tensión. Las normas soportadas son NOM-001-SEDE-2012, NEC (2020/2023/2026) e IEC 60364-5-52. Cada resultado incluye su **memoria de cálculo trazable**: fórmula, valores, tabla y artículo aplicados.

> Estado: **fase 1, etapa E9** (editor de unifilares, validación de la red, flujo de carga y caída de tensión, dimensionamiento de conductores, protecciones y tierra según NOM-001-SEDE-2012, resultados sobre el diagrama, cuadros de carga con balance de fases, reportes en PDF, SVG, PNG y Excel, y módulo IEC 60364-5-52:2001 con tablas de fuente secundaria ABB; NEC pendiente de captura de tablas). Plan completo en [docs/00-analisis-rea-y-plan.md](docs/00-analisis-rea-y-plan.md).

## Requisitos

- Node.js 20 o superior (probado con 24)
- pnpm 9 (`npm install -g pnpm@9.15.9`)

## Uso

```bash
pnpm install      # instala dependencias
pnpm dev          # editor en http://localhost:5173
pnpm build        # compilación de producción (apps/web/dist)
pnpm test         # pruebas unitarias
pnpm typecheck    # verificación de tipos
pnpm schema       # regenera docs/formato-proyecto.schema.json
pnpm --filter @rea/ejemplos reportes   # reportes del ejemplo en examples/reportes/

# Tablas normativas (requiere el PDF en referencias/normas/)
pnpm norm:extraer-nom-2012
pnpm norm:construir-nom-2012
pnpm norm:construir-iec-2001   # tablas IEC desde la transcripción (fuente: manual ABB)
pnpm norm:verificar nom-001-sede-2012 <tabla> --por "Ing. Nombre"
```

Revisión de tablas: [docs/tablas/nom-001-sede-2012.md](docs/tablas/nom-001-sede-2012.md) (detalles en [packages/norm-data/README.md](packages/norm-data/README.md)).

## Estructura

```
packages/
  core/        Modelo: tipos de elemento, biblioteca, proyecto, formato de archivo (sin UI ni cálculo)
  symbols/     Símbolos ANSI/IEC como geometría (editor y exportación)
  engine/      Motor de cálculo: validación de topología; flujo de carga radial (método nominal y barrido) y caída de tensión con trazas de memoria
  ejemplos/    Proyectos de ejemplo resueltos a mano (pruebas de integración)
  norms/       Módulos normativos intercambiables (NOM-001-SEDE-2012; IEC 60364-5-52:2001 vía ABB; NEC pendiente de datos)
  norm-data/   Tablas normativas en JSON con referencia a la fuente y estado de verificación
  reports/     Reportes: unifilar SVG desde el modelo, memoria en PDF (pdfmake), libro de Excel (ExcelJS)
apps/
  web/         Editor de unifilares (React + React Flow + Zustand)
docs/          Plan, revisión normativa, formato de archivo, guías
referencias/   Documentos normativos fuente (no versionados)
```

## Editor

- Arrastra elementos desde la biblioteca, o haz doble clic en uno para agregarlo al centro de la vista.
- Para conectar, arrastra de un puerto a otro; los puertos aparecen al pasar el ratón sobre el elemento.
- Atajos: Supr elimina · Ctrl+Z / Ctrl+Y deshacen / rehacen · Ctrl+C / Ctrl+V copian / pegan · Ctrl+D duplica · R gira 90° · Shift+arrastre hace selección múltiple.
- Simbología ANSI/IEEE ↔ IEC desde la barra superior: cambia solo el dibujo, no el modelo.
- Guardar descarga un `.rea.json`; Abrir lo carga y lo valida. Además hay autoguardado en el navegador.

## Resultados (E7)

El cálculo se repite solo con cada cambio, siempre que no haya errores de datos ni de topología.

- **Diagrama**: con «Mostrar resultados» activo, cada elemento muestra su calibre, protección, corriente, caída de tensión y tensión en barras. Los valores fuera de límite se marcan en ámbar (advertencia) o en rojo (error).
- **Inspector → Resultados y memoria**: datos calculados del elemento seleccionado y su memoria paso a paso (flujo de carga, dimensionamiento y selección de la protección). Cada paso indica fórmula, valores, tabla y artículo.
- **Tabla**: todos los elementos en filas, agrupados por tipo. Los parámetros se editan en las celdas y los resultados aparecen al lado.
- **Cuadros de carga**: un cuadro por tablero o CCM con la carga de cada circuito por fase (VA), sus totales, la corriente por fase y el desbalance, calculado como (Fmáx − Fmín) / Fmáx.

## Reportes (E8)

Menú **Exportar…** de la barra superior:

| Reporte | Contenido |
|---|---|
| Unifilar (SVG, PNG, PDF) | Dibujo vectorial generado desde el modelo, no una captura de pantalla. Usa la misma geometría que el editor e incluye un cajetín con proyecto, norma, elaboró y fecha. Lleva resultados si «Mostrar resultados» está activo. El PDF es doble carta, vertical u horizontal según la forma del dibujo |
| Memoria de cálculo (PDF) | Datos y criterios de diseño; unifilar con resultados; cédula de conductores y protecciones (origen, destino, corrientes, calibre, tierra, ampacidad, caídas, criterio que rige); cuadros de carga; memoria paso a paso de cada elemento (fórmula, sustitución, resultado y referencias); observaciones; tablas normativas con su estado de verificación; firmas |
| Excel | Hojas Proyecto, Circuitos, un cuadro de carga por tablero (totales, corriente por fase y desbalance como **fórmulas** de Excel), Memoria (un renglón por paso, con filtros) y Observaciones |

Si hay errores en el proyecto o tablas normativas pendientes de verificar, la memoria lleva la marca «BORRADOR». En `examples/reportes/` están los reportes del sistema de ejemplo.

## Documentación

- [Análisis REA y plan por etapas](docs/00-analisis-rea-y-plan.md)
- [Revisión normativa: fuentes, tablas y erratas](docs/01-revision-normativa.md)
- [Formato de archivo de proyecto](docs/formato-proyecto.md)
- [Cómo agregar un tipo de elemento](docs/agregar-tipo-elemento.md)
- [Validación de la red, tolerancias y límites de caída de tensión](docs/validacion-topologia.md)
- [Canalizaciones y métodos de instalación](docs/canalizaciones.md)
- [Sistema de ejemplo: flujo de carga y caída de tensión resueltos a mano](docs/ejemplos/sistema-ejemplo.md) (archivo: `examples/sistema-ejemplo.rea.json`)
- [Sistema de ejemplo: dimensionamiento de conductores, protecciones y tierra](docs/ejemplos/dimensionamiento.md)

## Advertencia

La herramienta apoya el diseño. **No sustituye la revisión y firma de un ingeniero responsable.** Mientras una tabla normativa no esté verificada, sus resultados se marcan como borrador.
