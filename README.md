# REA Eléctrico: cálculo y diseño de instalaciones eléctricas

Aplicación web para crear diagramas unifilares y calcular instalaciones eléctricas de baja tensión. Las normas soportadas son NOM-001-SEDE-2012, NEC (2020/2023/2026) e IEC 60364-5-52. Cada resultado incluye su **memoria de cálculo trazable**: fórmula, valores, tabla y artículo aplicados.

> Estado: **fase 1, etapa E2** (modelo de datos + tablas NOM-001-SEDE-2012). Plan completo en [docs/00-analisis-rea-y-plan.md](docs/00-analisis-rea-y-plan.md).

## Requisitos

- Node.js 20 o superior (probado con 24)
- pnpm 9 (`npm install -g pnpm@9.15.9`)

## Uso

```bash
pnpm install      # instala dependencias
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
  engine/      (E5) Motor de cálculo: flujo de carga, caída de tensión, trazas de memoria
  norms/       (E6, E9) Módulos normativos intercambiables
  norm-data/   Tablas normativas en JSON con referencia a la fuente y estado de verificación
apps/
  web/         (E3) Editor de unifilares e interfaz
docs/          Plan, revisión normativa, formato de archivo, guías
referencias/   Documentos normativos fuente (no versionados)
```

## Documentación

- [Análisis REA y plan por etapas](docs/00-analisis-rea-y-plan.md)
- [Revisión normativa: fuentes, tablas y erratas](docs/01-revision-normativa.md)
- [Formato de archivo de proyecto](docs/formato-proyecto.md)
- [Cómo agregar un tipo de elemento](docs/agregar-tipo-elemento.md)

## Advertencia

La herramienta apoya el diseño. **No sustituye la revisión y firma de un ingeniero responsable.** Mientras una tabla normativa no esté verificada, sus resultados se marcan como borrador.
