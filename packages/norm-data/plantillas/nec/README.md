# Plantillas de captura: NEC (NFPA 70)

Las tablas del NEC tienen derechos de autor de NFPA. La única lectura gratuita es el visor *Free Access* de NFPA: requiere cuenta y no permite copiar ni imprimir. Por eso estas tablas **las captura el usuario a mano** desde el visor, o desde un ejemplar comprado.

## Procedimiento

1. Copia la carpeta `_base/` como `nec-2020/`, `nec-2023/` o `nec-2026/`, según la edición que vayas a capturar.
2. Abre cada CSV en Excel y llena los valores tal como aparecen en la tabla. Reglas:
   - Celda vacía = celda vacía o "—" en la tabla.
   - Punto decimal (no coma).
   - En `marca_240_4_D` escribe `**` si el calibre tiene la nota de limitación de 240.4(D).
3. En `_metadatos.csv` registra, por plantilla: número de tabla en esa edición, sección, páginas, quién capturó y fecha.
   - La numeración cambia entre ediciones. Ejemplo: corrección por temperatura es 310.15(B)(1) en 2020 y 310.15(B)(1)(1) en 2023. En 2026 varias tablas de dimensionamiento se reubicaron.
4. Guarda en CSV UTF-8.
5. Avísame. En la etapa E9 se agrega el importador CSV → JSON, que valida cada archivo con las mismas pruebas de consistencia que la NOM (monotonía, proporcionalidad I·V, Z = R·cosφ + X·senφ).

## Notas

- Las filas ya traen los calibres o potencias **solo como guía de estructura**: la designación de calibres y las potencias en hp de los renglones. Si la edición tiene renglones distintos, agrega o elimina filas.
- No se precargan valores de la NOM: aunque la NOM-001-SEDE-2012 deriva del NEC 2011, cada edición se captura de su propia fuente.
- `cap9-tabla-9-impedancia.csv`: el NEC publica Ω/kft (y Ω/km en otra columna). Indica en `unidad_original` cuál capturaste (`ohm/km` u `ohm/kft`).
