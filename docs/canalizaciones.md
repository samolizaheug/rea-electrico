# Canalizaciones y métodos de instalación (NOM-001-SEDE-2012)

- **Definición:** `packages/norms/src/nom-001-sede-2012/raceways.ts`.
- **Medidas:** Capítulo 10 Tabla 4 (tubos), Tabla 392-22(a) (charolas) y catálogo de fabricante (ducto).

Cada método define cuatro cosas que usará el cálculo:
1. La **tabla de ampacidad**: 310-15(b)(16), 310-15(b)(17) o la regla de charolas 392-80.
2. La **regla de agrupamiento**, si difiere de la general.
3. La **columna de la Tabla 9** (R y XL) para la caída de tensión.
4. De dónde salen sus **medidas comerciales**.

| Grupo | Método | Art. | Ampacidad | Tabla 9 | Medidas |
|---|---|---|---|---|---|
| Tubo conduit no metálico | PVC cédula 40 | 352 | 310-15(b)(16) | PVC | Tabla 4: PVC cédula 40 / HDPE, 16–155 |
| | PVC cédula 80 | 352 | (b)(16) | PVC | Tabla 4: PVC cédula 80 |
| | PVC tipo A | 352 | (b)(16) | PVC | Tabla 4: PVC tipo A, 16–103 |
| | HDPE | 353 | (b)(16) | PVC | Tabla 4: PVC cédula 40 / HDPE |
| | ENT | 362 | (b)(16) | PVC | Tabla 4: ENT, 16–53 |
| Acero galvanizado | Pesado (RMC) | 344 | (b)(16) | Acero | Tabla 4: RMC, 16–155 |
| | Semipesado (IMC) | 342 | (b)(16) | Acero | Tabla 4: IMC, 16–103 |
| | Ligero (EMT) | 358 | (b)(16) | Acero | Tabla 4: EMT, 16–103 |
| Aluminio | Pesado (RMC) | 344 | (b)(16) | Aluminio | Tabla 4: RMC |
| | Ligero (EMT) | 358 | (b)(16) | Aluminio | Tabla 4: EMT |
| Acero inoxidable | Pesado (RMC) | 344 | (b)(16) | **Acero (supuesto)** | Tabla 4: RMC |
| Flexibles | FMC | 348 | (b)(16) | Acero | Tabla 4: FMC, 12–103 |
| | LFMC | 350 | (b)(16) | Acero | Tabla 4: LFMC, 12–103 |
| | LFNC-B | 356 | (b)(16) | PVC | Tabla 4: LFNC-B, 12–53 |
| Ductos | Ducto metálico con tapa (ducto cuadrado embisagrado) | 376 | (b)(16), con factores solo si hay más de 30 conductores (376-22(b)) | **Acero (supuesto)** | 65 × 65, 100 × 100 y 150 × 150 mm (catálogo, fuente secundaria) |
| Charolas | Escalera / malla / fondo ventilado | 392 | 392-80 (E6) | **PVC (supuesto)** | Tabla 392-22(a): 5–90 cm |
| | Fondo sólido | 392 | 392-80 (E6) | **PVC (supuesto)** | Tabla 392-22(a) |
| Enterradas | Directamente enterrado | 300-5 | (b)(16) | **PVC (supuesto)** | No aplica |
| | Banco de ductos PVC / HDPE | 352/353 | (b)(16) | PVC | Tabla 4: PVC cédula 40 / HDPE |
| | Banco de ductos PVC tipo EB embebido en concreto | 352 | (b)(16) | PVC | Tabla 4: PVC tipo EB (hallazgo E10) |
| Aire libre | Conductores individuales | 310-15(b) | (b)(17) | **PVC (supuesto)** | No aplica |

## Supuestos (aprobados por el usuario, Ing. RGLR, 2026-10-24)

La Tabla 9 de la NOM da R y XL **solo para tres conductores en tubo conduit** de PVC, aluminio o acero. Donde no aplica directamente se declara un supuesto, que aparecerá en la memoria de cálculo:

1. **Acero inoxidable:** no hay columna propia. Se usa la de acero, que da valores más altos y por tanto una caída conservadora.
2. **Ducto metálico:** se usa la columna de acero, también conservadora.
3. **Charola, enterrado directo y aire libre:** sin envolvente magnética, se usa la columna de PVC. La reactancia real depende de la separación entre conductores.

## Medidas de ducto cuadrado (fuente secundaria)

No están en la NOM. Provienen de:
- el catálogo Square D clase 5110: 63.5, 101.6 y 152.4 mm por lado;
- Charofil: 65 × 65 y 100 × 100 mm, con certificación ANCE.

Hay que confirmarlas con el fabricante del proyecto. Las medidas de 200 × 200 mm no se encontraron en una fuente verificable.

Fuentes:
- Catálogo Square D: https://cdn.shopify.com/s/files/1/0333/9583/4924/files/LD65-2.pdf
- Charofil (Syscom): https://syscom.mx/blog/ducto-cuadrado-embisagrado

## Uso de la medida

En la fase 1 la medida se captura y se valida contra la tabla, pero el **llenado de tubería** queda fuera de alcance. Los datos de la Tabla 4 (áreas al 53, 31 y 40 %) y de la 392-22(a) ya están cargados para cuando se implemente.
