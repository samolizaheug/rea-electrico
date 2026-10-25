# Sistema de ejemplo: flujo de carga y caída de tensión resueltos a mano

> **Para revisión del Ing. RGLR.**
> - Proyecto: `examples/sistema-ejemplo.rea.json` (ábrelo en el editor). El código que lo construye está en `packages/ejemplos/src/sistema-ejemplo.ts`.
> - Pruebas: `packages/ejemplos/test/sistema-ejemplo.test.ts`. El motor reproduce todas las cifras de este documento con al menos 3 decimales.
> - Norma: NOM-001-SEDE-2012. Tablas usadas: 430-250 (motores) y Capítulo 10, Tabla 9 (R y XL a 75 °C).

## 1. Sistema

```
ACOM-1  23 kV, 3F3H, 1.00 pu (red ideal: sin potencia de cortocircuito capturada)
  │
TR-1  750 kVA, 23 000 / 480Y-277 V, Dyn1, Z = 5.75 %, X/R = 6
  │
TG  480 V, 3F4H
  ├─ INT-1 ─ AL-1 (2/0 AWG Cu, RMC acero, 40 m) ─ CCM-1 480 V
  │     ├─ INT-11 ─ AL-11 (4 AWG, RMC acero, 25 m) ─ M-01  50 hp, 460 V, FP 0.85
  │     ├─ INT-12 ─ AL-12 (8 AWG, RMC acero, 30 m) ─ VFD-01 (η 97 %, FP ent. 0.95) ─ M-02 25 hp, 460 V
  │     └─ INT-13 ─ AL-13 (12 AWG, RMC acero, 30 m) ─ M-03  10 hp, 460 V, FP 0.85
  ├─ INT-2 ─ AL-2 (2 AWG, EMT acero, 20 m) ─ TR-2 75 kVA, 480 / 220Y-127 V, Z = 4 %, X/R = 2
  │     └─ AL-3 (250 kcmil, PVC, 10 m) ─ TAB-A 220Y/127 V
  │           ├─ INT-21 ─ AL-21 (12 AWG, PVC, 30 m) ─ L-01  20 × 50 W, FP 0.9, 127 V fase A
  │           ├─ INT-22 ─ AL-22 (12 AWG, PVC, 25 m) ─ C-01  8 contactos × 180 VA, FP 0.9, 127 V fase B
  │           └─ INT-23 ─ AL-23 (6 AWG, PVC, 40 m) ─ CG-01 15 kW, FP 0.9, 220 V trifásica
  └─ INT-4 ─ AL-4 (4 AWG, PVC, 50 m) ─ TAB-B 480Y/277 V
        ├─ INT-41 ─ AL-41 (12 AWG, PVC, 40 m) ─ L-02  30 × 100 W, FP 0.9, 277 V fase A
        └─ INT-42 ─ AL-42 (6 AWG, PVC, 20 m) ─ CA-01 40 kVA, FP 0.9, 480 V trifásica
```

- Todos los conductores son de cobre THHW-LS.
- Los calibres se fijaron para el ejemplo; la selección automática es de la etapa E6.
- Los valores de X/R de los transformadores son datos del ejemplo (en un proyecto real vienen de placa o del fabricante).

## 2. Método (nominal, verificable a mano)

1. Cada carga se evalúa a la **tensión nominal** de su sistema.
2. Las potencias se suman aguas abajo, sin pérdidas.
3. La corriente de cada tramo se calcula con:
   - trifásico: I = S / (√3 · V)
   - monofásico: I = S / V
4. La caída en conductores usa la impedancia eficaz de la Tabla 9, nota 2:
   - Ze = R · cosφ + XL · senφ (Ω/km)
   - Trifásico: ΔV_fn = I · Ze · L, y %ΔV = ΔV_fn / V_fn · 100.
   - Monofásico de dos conductores: ΔV = 2 · I · Ze · L, y %ΔV = ΔV / V · 100.
5. La regulación del transformador se aproxima con %ΔV ≈ (S / Sn) · (%R · cosφ + %X · senφ), donde %R = %Z / √(1 + (X/R)²) y %X = %R · X/R.
6. **Motores**: se usa la corriente de la Tabla 430-250, tomada a la tensión nominal del sistema: S = √3 · V_sis · I_tabla (art. 430-6(a)(1)).
7. **Variador**: P_ent = P_motor / η, y Q_ent = P_ent · tan(arccos FP_ent). Su salida se considera regulada a la tensión nominal.

Tensiones de fase a neutro usadas: 480 / √3 = 277.128 V y 220 / √3 = 127.017 V.

## 3. Potencia de las cargas

| Carga | Dato | S (VA) | P (W) | Q (var) | cosφ / senφ |
|---|---|---|---|---|---|
| M-01 | 50 hp → 65 A (Tabla 430-250, 460 V); S = √3·480·65 | 54 040.0 | 45 934.0 | 28 467.3 | 0.85 / 0.52678 |
| M-02 | 25 hp → 34 A; S = √3·480·34 | 28 267.1 | 24 027.0 | 14 890.6 | 0.85 / 0.52678 |
| VFD-01 (entrada) | P = 24 027.0 / 0.97; Q = P · 0.32868 | 26 073.8 | 24 770.1 | 8 141.5 | 0.95 / 0.31225 |
| M-03 | 10 hp → 14 A; S = √3·480·14 | 11 639.4 | 9 893.5 | 6 131.4 | 0.85 / 0.52678 |
| L-01 | P = 20·50; S = P / 0.9 | 1 111.1 | 1 000.0 | 484.3 | 0.90 / 0.43589 |
| C-01 | S = 8·180 (NOM 220-14(i)) | 1 440.0 | 1 296.0 | 627.7 | 0.90 / 0.43589 |
| CG-01 | P = 15 kW; S = P / 0.9 | 16 666.7 | 15 000.0 | 7 264.8 | 0.90 / 0.43589 |
| L-02 | P = 30·100; S = P / 0.9 | 3 333.3 | 3 000.0 | 1 453.0 | 0.90 / 0.43589 |
| CA-01 | S = 40 kVA | 40 000.0 | 36 000.0 | 17 435.6 | 0.90 / 0.43589 |

**Sumas por tablero** (método nominal, sin pérdidas):

| Tablero | P (W) | Q (var) | S (VA) | cosφ / senφ |
|---|---|---|---|---|
| CCM-1 = M-01 + VFD-01 + M-03 | 80 597.6 | 42 740.3 | 91 228.8 | 0.88347 / 0.46850 |
| TAB-A = L-01 + C-01 + CG-01 | 17 296.0 | 8 376.8 | 19 217.8 | 0.90000 / 0.43589 |
| TAB-B = L-02 + CA-01 | 39 000.0 | 18 888.6 | 43 333.3 | 0.90000 / 0.43589 |
| **TG** = CCM-1 + TAB-A + TAB-B | **136 893.6** | **70 005.7** | **153 755.2** | 0.89033 / 0.45531 |

## 4. Transformadores

| | TR-1 | TR-2 |
|---|---|---|
| %R = %Z / √(1 + (X/R)²) | 5.75 / √37 = 0.94529 % | 4 / √5 = 1.78885 % |
| %X = %R · X/R | 5.67177 % | 3.57771 % |
| S que conduce | 153 755.2 VA | 19 217.8 VA |
| Regulación ≈ (S/Sn)(%R cosφ + %X senφ) | (153 755.2 / 750 000)(0.94529·0.89033 + 5.67177·0.45531) = **0.7019 %** | (19 217.8 / 75 000)(1.78885·0.9 + 3.57771·0.43589) = **0.8121 %** |
| Corriente del primario | 153 755.2 / (√3·23 000) = 3.8596 A | 19 217.8 / (√3·480) = 23.115 A |
| Corriente del secundario | 153 755.2 / (√3·480) = 184.939 A | 19 217.8 / (√3·220) = 50.434 A |

## 5. Conductores

Valores de la Tabla 9 en Ω/km, por conductor a 75 °C. "Acero" = columna de conduit de acero; "PVC" = columna de PVC.

| Tramo | Calibre / columna | R | XL | S (VA) | I (A) | Ze (Ω/km) | ΔV (V) | %ΔV |
|---|---|---|---|---|---|---|---|---|
| AL-1 | 2/0, acero | 0.33 | 0.177 | 91 228.8 | 109.7312 | 0.33·0.88347 + 0.177·0.46850 = 0.37447 | 109.7312·0.37447·0.040 = 1.6436 (fn) | 1.6436 / 277.128 = **0.5931** |
| AL-11 | 4, acero | 1.02 | 0.197 | 54 040.0 | 65.0000 | 0.97078 | 1.5775 (fn) | **0.5692** |
| AL-12 | 8, acero | 2.56 | 0.213 | 26 073.8 | 31.3619 | 2.49851 | 2.3507 (fn) | **0.8483** |
| AL-13 | 12, acero | 6.6 | 0.223 | 11 639.4 | 14.0000 | 5.72747 | 2.4055 (fn) | **0.8680** |
| AL-2 | 2, acero | 0.66 | 0.187 | 19 217.8 | 23.1154 | 0.67551 | 0.3123 (fn) | **0.1127** |
| AL-3 | 250, PVC | 0.171 | 0.135 | 19 217.8 | 50.4336 | 0.21275 | 0.1073 (fn) | 0.1073 / 127.017 = **0.0845** |
| AL-21 | 12, PVC, monofásico 127 V | 6.6 | 0.177 | 1 111.1 | 1 111.1 / 127.017 = 8.7477 | 6.01715 | 2·8.7477·6.01715·0.030 = 3.1582 | 3.1582 / 127.017 = **2.4864** |
| AL-22 | 12, PVC, monofásico 127 V | 6.6 | 0.177 | 1 440.0 | 11.3371 | 6.01715 | 2·11.3371·6.01715·0.025 = 3.4108 | **2.6853** |
| AL-23 | 6, PVC | 1.61 | 0.167 | 16 666.7 | 43.7387 | 1.52179 | 2.6624 (fn) | 2.6624 / 127.017 = **2.0961** |
| AL-4 | 4, PVC | 1.02 | 0.157 | 43 333.3 | 52.1219 | 0.98643 | 2.5707 (fn) | **0.9276** |
| AL-41 | 12, PVC, monofásico 277 V | 6.6 | 0.177 | 3 333.3 | 3 333.3 / 277.128 = 12.0281 | 6.01715 | 2·12.0281·6.01715·0.040 = 5.7900 | 5.7900 / 277.128 = **2.0893** |
| AL-42 | 6, PVC | 1.61 | 0.167 | 40 000.0 | 48.1125 | 1.52179 | 1.4643 (fn) | **0.5284** |

## 6. Tensiones y caída acumulada

La tensión en % de la nominal se obtiene restando las caídas desde la fuente (100 %):
- TG = 100 − 0.7019 = **99.2981 %**
- TAB-A = 99.2981 − AL-2 0.1127 − TR-2 0.8121 − AL-3 0.0845 = **98.2888 %**

La **caída acumulada en conductores** suma las caídas de alimentador y derivado dentro de la misma zona de tensión, es decir, desde el secundario del transformador que la alimenta. Es la que se compara con el 5 % de la NOM (notas de 210-19 y 215-2).

| Punto | Tensión (% nominal) | Caída acumulada en conductores | Límite |
|---|---|---|---|
| CCM-1 | 98.7050 | 0.5931 | — |
| M-01 | 98.1357 | 0.5931 + 0.5692 = **1.1623** | 5 % |
| M-03 | 97.8369 | **1.4611** | 5 % |
| M-02 (salida del variador, regulada) | 100.0000 | 0 | — |
| L-01 | 95.8023 | AL-3 0.0845 + AL-21 2.4864 = **2.5709** | 5 % |
| C-01 | 95.6034 | **2.7698** | 5 % |
| CG-01 | 96.1926 | **2.1806** | 5 % |
| TAB-B | 98.3704 | 0.9276 | — |
| L-02 | 96.2811 | **3.0169** | 5 % |
| CA-01 | 97.8420 | **1.4560** | 5 % |

**Cumplimiento con los límites del proyecto** (3 % por tramo y 5 % total, los de la NOM):
- Todos los tramos y totales cumplen.
- El circuito más cargado en porcentaje es AL-22, con 2.69 % frente a 3 %.

## 7. Comparación con el barrido iterativo (cálculo exacto del motor)

El barrido resuelve la red con fasores, cargas de potencia constante evaluadas a la tensión real y pérdidas incluidas. Converge en 7 iteraciones.

| Punto | Nominal (%) | Barrido (%) | Tensión del barrido |
|---|---|---|---|
| TG | 99.298 | 99.280 | 476.5 V |
| CCM-1 | 98.705 | 98.674 | 473.6 V |
| M-01 | 98.136 | 98.094 | 470.8 V |
| TAB-A | 98.289 | 98.231 | 216.1 V |
| L-01 | 95.802 | 95.624 | 121.5 V |
| C-01 | 95.603 | 95.409 | 121.2 V |
| L-02 | 96.281 | 96.151 | 266.5 V |
| CA-01 | 97.842 | 97.788 | 469.4 V |

- La potencia que entrega la fuente es 139.763 kW, contra 136.894 kW de cargas: las pérdidas son 2.87 kW.
- **El barrido siempre da caídas iguales o mayores.** A menor tensión, una carga de potencia constante toma más corriente: en AL-22, 11.88 A contra 11.34 A, y la caída sube de 2.69 % a 2.82 %. La diferencia máxima con el método nominal es 0.19 puntos (en C-01).

## 8. Supuestos de este cálculo (aparecen en la memoria)

1. Red equilibrada, en secuencia positiva. Las cargas monofásicas se suman a la red trifásica, y su circuito derivado se evalúa como circuito de dos conductores. El desbalance por fase se reporta en los cuadros de carga (E7).
2. Para motores se usa la corriente de tabla a la tensión nominal del sistema, conforme a 430-6(a)(1).
3. La red de suministro es ideal porque no se capturó su potencia de cortocircuito. Si se captura, se incluye su impedancia.
4. Interruptores y ATS se modelan sin impedancia. Variadores y UPS regulan su tensión de salida.
5. Se desprecia el desfasamiento de los transformadores Dyn1, porque no afecta las magnitudes.
6. Las resistencias son las de la Tabla 9 a 75 °C, sin corrección por la temperatura real del conductor.

## 9. Preguntas para el revisor

1. **Caída acumulada por zona.** Propongo comparar el 5 % con la suma de caídas en conductores **dentro de cada zona de tensión**, sin incluir la regulación del transformador. ¿Coincide con tu práctica?
2. **Corriente de motores en la caída de tensión.** Uso la corriente de la tabla (65 A para 50 hp), no la potencia a 460 V (62.3 A a 480 V). Es más conservador. ¿De acuerdo?
3. **Método que muestra la memoria.** ¿Prefieres que la memoria presente el método nominal, verificable a mano, como resultado principal y el barrido como referencia? ¿O al revés?
