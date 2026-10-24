# Referencias normativas (uso interno)

Copia de la carpeta del usuario `Descargas\Normas Instalaciones Electricas`. Se copió el 2026-10-24.

| Archivo | SHA-256 |
|---|---|
| `normas/NOM-001-SEDE-2012 Instalaciones Electricas (utilizacion).pdf` (1016 páginas, DOF 29/11/2012) | `7774318D1549550F2E07733DEE10485486AD17BCDA71361C737C8B68309BCBA1` |
| `normas/LEEME - NEC e IEC.txt` | `806148FA42CF3CD68D788DCC9C59FAF418CEAF8A547511C4393195FBC87FC6F6` |

- Esta carpeta es **fuente de consulta**. La aplicación no la lee en tiempo de ejecución.
- Los datos que usa el motor de cálculo se transcriben a `packages/norm-data/` con referencia a la tabla, el artículo y la página del PDF.
- Esta carpeta **no se versiona** (ver `.gitignore`), porque ahí también podrían guardarse documentos con derechos de autor (NEC, IEC).
- Las páginas que citan los documentos del proyecto (`p. N`) son páginas del PDF unido, no del DOF.
