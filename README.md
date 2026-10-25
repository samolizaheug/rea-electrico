# REA Eléctrico: cálculo y diseño de instalaciones eléctricas

Aplicación web para crear diagramas unifilares y calcular instalaciones eléctricas de baja tensión. Las normas soportadas son NOM-001-SEDE-2012, NEC (2020/2023/2026) e IEC 60364-5-52. Cada resultado incluye su **memoria de cálculo trazable**: fórmula, valores, tabla y artículo aplicados.

> Estado: **fase 1, etapa E4** (modelo de datos, tablas NOM-001-SEDE-2012 verificadas, editor de unifilares, propiedades y validación de la red). Plan completo en [docs/00-analisis-rea-y-plan.md](docs/00-analisis-rea-y-plan.md).

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

# Tablas normativas (requiere el PDF en referencias/normas/)
pnpm norm:extraer-nom-2012
pnpm norm:construir-nom-2012
pnpm norm:verificar nom-001-sede-2012 <tabla> --por "Ing. Nombre"
```

Revisión de tablas: [docs/tablas/nom-001-sede-2012.md](docs/tablas/nom-001-sede-2012.md) (detalles en [packages/norm-data/README.md](packages/norm-data/README.md)).

## Estructura

```
packages/
  core/        Modelo: tipos de elemento, biblioteca, proyecto, formato de archivo (sin UI ni cálculo)
  symbols/     Símbolos ANSI/IEC como geometría (editor y exportación)
  engine/      Motor de cálculo: validación de topología (E4); flujo de carga y caída de tensión (E5)
  norms/       Módulos normativos intercambiables (NOM-001-SEDE-2012; NEC e IEC pendientes de datos)
  norm-data/   Tablas normativas en JSON con referencia a la fuente y estado de verificación
apps/
  web/         Editor de unifilares (React + React Flow + Zustand)

## Editor (E3)

- Arrastra elementos desde la biblioteca, o haz doble clic en uno para agregarlo al centro de la vista.
- Para conectar, arrastra de un puerto a otro; los puertos aparecen al pasar el ratón sobre el elemento.
- Atajos: Supr elimina · Ctrl+Z / Ctrl+Y deshacen / rehacen · Ctrl+C / Ctrl+V copian / pegan · Ctrl+D duplica · R gira 90° · Shift+arrastre hace selección múltiple.
- Simbología ANSI/IEEE ↔ IEC desde la barra superior: cambia solo el dibujo, no el modelo.
- Guardar descarga un `.rea.json`; Abrir lo carga y lo valida. Además hay autoguardado en el navegador.
docs/          Plan, revisión normativa, formato de archivo, guías
referencias/   Documentos normativos fuente (no versionados)
```

## Documentación

- [Análisis REA y plan por etapas](docs/00-analisis-rea-y-plan.md)
- [Revisión normativa: fuentes, tablas y erratas](docs/01-revision-normativa.md)
- [Formato de archivo de proyecto](docs/formato-proyecto.md)
- [Cómo agregar un tipo de elemento](docs/agregar-tipo-elemento.md)
- [Validación de la red](docs/validacion-topologia.md)

## Advertencia

La herramienta apoya el diseño. **No sustituye la revisión y firma de un ingeniero responsable.** Mientras una tabla normativa no esté verificada, sus resultados se marcan como borrador.
