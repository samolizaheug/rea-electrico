# Sistema de ejemplo: dimensionamiento de conductores, protecciones y tierra (NOM-001-SEDE-2012)

> **Para revisión del Ing. RGLR.**
> - Sistema: el de [sistema-ejemplo.md](sistema-ejemplo.md).
> - Pruebas: `packages/ejemplos/test/dimensionamiento.test.ts` y `packages/norms/test/nom-sizing.test.ts`.
> - Implementación: `packages/norms/src/nom-001-sede-2012/sizing.ts` (reglas) y `packages/engine/src/calc/sizing.ts` (orden de cálculo).

## 1. Procedimiento

Para cada alimentador o circuito derivado (el cable más la protección en su origen):

1. **Corriente de diseño** I_d y **corriente de carga** I_c:

   | Caso | I_d | Fuente |
   |---|---|---|
   | General | I_no continua + 1.25 · I_continua (100 % si el tablero de origen está aprobado al 100 %) | 210-19(a)(1), 215-2(a)(1) |
   | Un motor | 1.25 · I_pc (o la Tabla 430-22(e) en servicio no continuo) | 430-22 |
   | Varios motores y otras cargas | 1.25 · I_mayor + Σ I_otros + I_no continua + 1.25 · I_continua | 430-24 |
   | Variador | 1.25 · I_entrada | 430-122(a) |
   | Primario de transformador ≤ 600 V | I_pri nominal | La protección de 450-3(b) rige el calibre |

2. **Protección**, con los valores estándar de 240-6(a), que incluyen 16, 32 y 63 A:

   | Caso | Regla |
   |---|---|
   | General | ≥ I_d (210-20(a), 215-3) |
   | Motor | ≤ % de la Tabla 430-52 · I_pc; si no es estándar, el inmediato superior (430-52(c)(1) Exc. 1) |
   | Alimentador de motores | Valor estándar no mayor que (mayor protección de derivado + Σ demás corrientes de motores + otras cargas) (430-62(a), 430-63) |
   | Primario de transformador | ≤ 125 % · I_pri, o el estándar inmediato superior (Tabla 450-3(b), nota 1) |
   | Variador | Estándar ≥ 1.25 · I_entrada, por confirmar con el fabricante (430-130) |

3. **Temperaturas**:
   - Del conductor: la mayor de su aislamiento, según la Tabla 310-104(a). THHW-LS → 90 °C.
   - De terminales, por 110-14(c):
     - 60 °C si el circuito es de 100 A o menos;
     - 75 °C si es mayor;
     - 75 °C en motores con letra de diseño B, C, D o E (110-14(c)(1)(a)(4));
     - o el valor que capture el usuario.

4. **Calibre mínimo**: el menor que cumple a la vez:
   - (a) Ampacidad a la temperatura de terminales ≥ I_d (110-14(c)).
   - (b) Ampacidad corregida ≥ I_c. En circuitos de motor, ≥ I_d. Se calcula así:
     - ampacidad corregida = tabla a la temperatura del conductor × factor por temperatura ambiente (Tabla 310-15(b)(2)(a)) × factor de agrupamiento (Tabla 310-15(b)(3)(a)) × factor de charola (392-80);
     - el resultado se limita a la ampacidad a la temperatura de terminales.
   - (c) Protegido por su dispositivo según 240-4:
     - hasta 800 A se admite el valor estándar inmediato superior a la ampacidad (240-4(b)), salvo circuitos con más de un contacto;
     - en calibres pequeños de cobre, 240-4(d) limita la protección: 14 AWG ≤ 15 A, 12 AWG ≤ 20 A y 10 AWG ≤ 30 A;
     - en circuitos y alimentadores de motor no aplica, por 240-4(g).

5. **Caída de tensión**: si el calibre mínimo no la cumple, se aumenta hasta cumplir.
   - Alimentadores: 3 %.
   - Derivados: el menor entre 3 % y (5 % menos la caída de los alimentadores de su zona).
   - Equipo electrónico sensible: 1.5 % en el derivado y 2.5 % en total.

6. **Conductor de puesta a tierra de equipos**:
   - Se elige con la Tabla 250-122 según la protección. En motores, con la protección contra cortocircuito, por 250-122(d)(1).
   - No se exige mayor que la fase (250-122(a)).
   - Si la fase es mayor que el mínimo por ampacidad, se aumenta en proporción de áreas, con las áreas de la Tabla 8 (250-122(b)).
   - Con conductores en paralelo va uno completo en cada canalización (250-122(f)).

**Condiciones del ejemplo:**
- Cobre THHW-LS.
- 30 °C de temperatura ambiente (factor 1.00).
- 3 conductores portadores de corriente por canalización (factor 1.00). En 3F4H solo se cuenta el neutro si la carga es no lineal (310-15(b)(5)).
- Motores con letra de diseño B.

## 2. Corrientes de carga a la tensión del circuito

| Carga | Cálculo | I (A) | Clasificación |
|---|---|---|---|
| M-01 | Tabla 430-250, 50 hp, 460 V | 65.00 | motor |
| VFD-01 | Entrada calculada: 26 073.8 / (√3·480). No se capturó la corriente de placa | 31.36 | variador |
| M-03 | Tabla 430-250, 10 hp, 460 V | 14.00 | motor |
| L-01 | 1 111.1 / 127.017 (circuito); en el alimentador de TAB-A: 1 111.1 / (√3·220) = 2.916 | 8.748 | continua (alumbrado, por defecto) |
| C-01 | 1 440 / 127.017; en el alimentador: 3.779 | 11.337 | no continua |
| CG-01 | 16 666.7 / (√3·220) | 43.739 | no continua |
| L-02 | 3 333.3 / 277.128; en el alimentador de TAB-B: 4.009 | 12.028 | continua (alumbrado) |
| CA-01 | 40 000 / (√3·480) | 48.113 | no continua |
| TR-2 (primario) | 75 000 / (√3·480) | 90.21 | transformador |

## 3. Selección automática (calibres sin fijar)

| Circuito | I_d (A) | Protección | T. term. | Calibre | Ampacidad (A) | Rige | %ΔV | Tierra |
|---|---|---|---|---|---|---|---|---|
| AL-1 (CCM-1) | 1.25·65 + 31.36 + 14 = **126.61** | 430-62: 175 + 31.36 + 14 = 220.36 → **200 A** | 75 °C | **1 AWG** | 130 (75 °C) | ampacidad | 0.866 | 6 AWG |
| AL-11 (M-01) | 1.25·65 = **81.25** | 250 %·65 = 162.5 → **175 A** | 75 °C (letra B) | **4 AWG** | 85 | ampacidad | 0.569 | 6 AWG |
| AL-12 (VFD-01) | 1.25·31.36 = **39.20** | **40 A** | 60 °C | **8 AWG** | 40 | ampacidad | 0.848 | 10 AWG |
| AL-13 (M-03) | 1.25·14 = **17.50** | 250 %·14 = **35 A** | 75 °C (letra B) | **14 AWG** | 20 | ampacidad | 1.333 | 14 AWG (≤ fase) |
| AL-2 (TR-2) | I_pri = **90.21** | 125 %·90.21 = 112.8 → **125 A** | 75 °C | **2 AWG** | 115 | **protección** | 0.113 | 6 AWG |
| AL-3 (secundario TR-2) | 1.25·2.916 + 3.779 + 43.739 = **51.16** | sin protección en su origen | 60 °C | **6 AWG** | 55 | ampacidad | 0.604 | 8 (puente de unión, Tabla 250-66) |
| AL-21 (L-01) | 1.25·8.748 = **10.93** | **15 A** | 60 °C | **12 AWG** | 20 | **caída** | 2.486 | 12 AWG |
| AL-22 (C-01) | **11.34** | **15 A** | 60 °C | **12 AWG** | 20 | **caída** | 2.685 | 12 AWG |
| AL-23 (CG-01) | **43.74** | **45 A** | 60 °C | **6 AWG** | 55 | ampacidad | 2.096 | 10 AWG |
| AL-4 (TAB-B) | 1.25·4.009 + 48.113 = **53.12** | **60 A** | 60 °C | **6 AWG** | 55 | ampacidad | 1.431 | 10 AWG |
| AL-41 (L-02) | 1.25·12.028 = **15.04** | **16 A** (valor de la NOM) | 60 °C | **12 AWG** | 20 | ampacidad | 2.089 | 12 AWG |
| AL-42 (CA-01) | **48.11** | **50 A** | 60 °C | **6 AWG** | 55 | ampacidad | 0.528 | 10 AWG |

Detalle de los casos que no rige la ampacidad simple:

- **AL-2, rige la protección.**
  - Con 3 AWG: ampacidad = mín(115·1·1, 100 a 75 °C) = 100 A ≥ 90.21 A, así que la ampacidad cumple.
  - Pero 240-4(b) permite proteger con el estándar inmediato superior a 100 A, que es 100 A, y la protección es de 125 A: no queda protegido.
  - Con 2 AWG: 115 A, cuyo estándar inmediato superior es 125 A. Cumple.
- **AL-21 y AL-22, rige la caída de tensión.**
  - 14 AWG cumple la ampacidad: 15 A a 60 °C ≥ 10.93 A, y en AL-22, con más de un contacto, la ampacidad iguala a la protección de 15 A (240-4(b)(1)).
  - Pero la caída con 14 AWG sería:
    - AL-21: 2·8.748·(10.2·0.9 + 0.19·0.43589)·0.030 / 127.017 = **3.83 %**;
    - AL-22: **4.13 %**.
  - El límite es el menor entre 3 % y 5 − 0.604 = 4.396 %, es decir 3 %. Con 12 AWG: 2.486 % y 2.685 %.
  - Tierra: 15 A → 14 AWG; con la fase aumentada a 12 AWG, 2.08 · 3.31 / 2.08 = 3.31 mm² → **12 AWG** (250-122(b)).
- **AL-13**: 14 AWG con una protección de 35 A es válido en un circuito de motor (430-52 con 240-4(g)). El límite de 15 A de 240-4(d) no aplica.

## 4. Verificación de los calibres fijados en el ejemplo

Todos cumplen ampacidad, protección y caída de tensión. Los conductores de tierra cambian donde el calibre fijado es mayor que el mínimo (250-122(b)):

| Circuito | Fijado / mínimo | Tierra |
|---|---|---|
| AL-1 | 2/0 / 1 AWG | 6 AWG → 13.30 · 67.43 / 42.41 = 21.15 mm² → **4 AWG** |
| AL-4 | 4 / 6 AWG | 10 AWG → 5.261 · 21.15 / 13.3 = 8.37 mm² → **8 AWG** |
| AL-13 | 12 / 14 AWG | 14 AWG → 2.08 · 3.31 / 2.08 → **12 AWG** |

## 5. Observaciones que reporta el cálculo

1. **VFD-01** (información): la protección del circuito del variador debe confirmarse con su fabricante (430-130).
2. **AL-3** (advertencia): son conductores del secundario de TR-2 sin protección en su origen. Hay que verificar 240-21(c): longitud y protección en su extremo de carga. En un proyecto real se agregaría el interruptor principal de TAB-A.
3. **AL-3**: el puente de unión del lado de alimentación se dimensiona con 250-30(a), 250-102(c)(1) y la Tabla 250-66 (p. 122): fase 6 AWG = 13.3 mm² ≤ 33.6 mm² → **8 AWG Cu**. Con el calibre fijado del ejemplo (250 kcmil = 127 mm², renglón «más de 3/0 a 350») resulta **2 AWG Cu**. Agregado el 2026-10-25 al integrar la Tabla 250-66.

## 6. Alcance y supuestos (fase 1)

- **Circuitos de más de 600 V**: la protección y los conductores de media tensión están fuera de alcance (450-3(a), 310-60). La acometida de 23 kV del ejemplo no tiene cable.
- **Tipo de lugar**: no se modela si es seco, húmedo o mojado. Se toma la mayor temperatura del aislamiento; en lugares mojados debe usarse la indicada para ellos en la Tabla 310-104(a).
- **Sumador por exposición al sol en azoteas** (310-15(b)(3)(c)): no se aplica todavía.
- **Charolas**: implementados 392-80(a)(1) y (a)(2)(a)(b). Las disposiciones en una sola capa con separación ((a)(1)(c), (a)(2)(c)(d)) quedan pendientes.
- **Calibres de 700, 800 y 900 kcmil y mayores de 1000 kcmil**: no se ofrecen en la selección automática porque la Tabla 9 no da su impedancia.
- **Factores de demanda**: se usa el que se capture en cada carga. Las tablas del Art. 220 (220-42, 220-44) se aplican en los cuadros de carga (E7).

## 7. Decisiones del revisor (Ing. RGLR, 2026-10-24)

1. **Secundario de transformador sin interruptor en su origen:** se reporta como **advertencia** (240-21(c)), no como error.
2. **Protección del variador:** se propone el valor estándar ≥ 125 % de la corriente de entrada, con la nota de confirmarlo con el fabricante (430-130).
3. **Temperatura de terminales por defecto:** se mantiene 110-14(c): 60 °C en circuitos de 100 A o menos y 75 °C arriba; editable por alimentador.
