# @rea/norm-data: tablas normativas

Tablas de las normas en JSON, **separadas del código**. Cada una registra su norma, edición, tabla, artículo, documento fuente con su huella SHA-256 y páginas.

## Estructura

```
data/<norma>-<edición>/
  tabla-310-15-b-16.json    una tabla por archivo (formato: src/schema.ts)
  ...
  verificacion.json         revisión humana por tabla (estado, quién, cuándo, huella de los datos)
scripts/
  extract-text.ts           PDF → texto con marcas de página (referencias/normas/_texto/, no versionado)
  build-nom-001-sede-2012.ts texto → JSON (extracción automática con conteo de renglones y erratas)
  verify.ts                 registra verificaciones
  catalog-writer.ts         regenera src/catalog.ts y el reporte docs/tablas/<norma>.md
plantillas/nec/             CSV para capturar las tablas del NEC
```

## Flujo de trabajo

```bash
pnpm norm:extraer-nom-2012      # una vez: extrae el texto del PDF (verifica su huella)
pnpm norm:construir-nom-2012    # regenera los JSON y el reporte
```

Para revisar, abre `docs/tablas/nom-001-sede-2012.md` junto al PDF y compara cada tabla en las páginas indicadas. Para registrar que una tabla quedó verificada:

```bash
pnpm norm:verificar nom-001-sede-2012 tabla-310-15-b-16 --por "Ing. Nombre"
```

## Reglas

- **Estados de una tabla:** `por_verificar` → (`fuente_secundaria`) → `verificado`.
  - Una verificación guarda la huella de los datos. Si después la tabla cambia, vuelve sola a `por_verificar`.
- **Erratas:** se aplican solo las aprobadas por el usuario. `data` contiene el valor corregido y `errata[]` conserva el valor publicado, el motivo y la aprobación.
- **Pruebas de consistencia** (`src/sanity.ts`): monotonía, proporcionalidad I·V en motores, R·A en la Tabla 8 y Z = R·0.85 + X·0.527 en la Tabla 9.
  - Una anomalía nueva hace fallar las pruebas hasta que se revise.
  - Las anomalías pendientes de decisión del usuario se listan en `test/nom-001-sede-2012.test.ts`.
- **Transcripción manual:** las tablas con disposición compleja en el PDF (310-104(a), 220-42, 220-44) se transcriben a mano (`source.method = "transcripcion-manual"`). El constructor automático no las sobrescribe.
