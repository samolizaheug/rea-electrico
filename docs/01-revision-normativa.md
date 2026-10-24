# Revisión normativa: fuentes, tablas ubicadas y erratas

> Fecha: 2026-10-24 · Fuente local: `referencias/normas/` (ver `referencias/README.md`).
> Las páginas `p. N` son páginas del PDF unido (1016 págs.).

## 1. NOM-001-SEDE-2012 (confirmada como vigente)

Extraje el texto del PDF del DOF. La capa de texto es buena: las tablas salen con sus columnas separadas, así que se pueden transcribir sin OCR.

### 1.1 Tablas y artículos que usará el motor (fase 1)

| Uso en el motor | Referencia NOM | p. |
|---|---|---|
| Limitación por temperatura de terminales (60 °C ≤100 A o 14–1 AWG; 75 °C arriba) | 110-14(c)(1)(a) y (b) | 25 |
| Cargas continuas al 125 % (conductor y protección de circuito derivado) | 210-19(a)(1), 210-20(a) | 44–45 |
| Límites de caída de tensión 3 % / 5 % (**son NOTAS**, no requisitos obligatorios) | 210-19(a) Nota 4, 215-2(a)(1) Nota 2 | 44, 52 |
| Cargas continuas al 125 % (alimentadores) | 215-2(a)(1), 215-3 | 52–53 |
| Cargas de alumbrado por tipo de inmueble / factores de demanda | Tablas 220-12, 220-42, 220-44 | 56–59 |
| Protección de conductores, siguiente valor superior hasta 800 A, conductores pequeños | 240-4(b), (c), (d) | 89–90 |
| Capacidades estándar de interruptores y fusibles (**incluye 16, 32 y 63 A**, que el NEC no tiene) | 240-6(a) | 91 |
| Conductor de puesta a tierra de equipos (+ incremento proporcional, paralelo, motores) | 250-122 y Tabla 250-122 | 133–134 |
| Factores de corrección por temperatura (base 30 °C y base 40 °C) | Tablas 310-15(b)(2)(a) y (b) | 166–167 |
| Factores de ajuste por agrupamiento | Tabla 310-15(b)(3)(a) | 167–168 |
| Ampacidades en canalización / al aire libre | Tablas 310-15(b)(16) y (b)(17) | 170–171 |
| Temperaturas de aislamientos por tipo (THHW-LS, THWN-2, XHHW-2…) | Tabla 310-104(a) | 191 |
| Corriente de motores tomada de tablas, no de la placa | 430-6(a)(1) | 371 |
| Conductores de un motor (125 %), régimen de servicio | 430-22, Tabla 430-22(e) | 378–379 |
| Conductores de varios motores y otras cargas | 430-24 | 381 |
| Protección de circuito derivado de motor | 430-52, Tabla 430-52 | 386–387 |
| Corriente a plena carga de motores de c.c., monofásicos y trifásicos | Tablas 430-247, 430-248, 430-250 | 404–406 |
| Protección de transformadores (para fases posteriores) | Tablas 450-3(a) y (b) | 419–420 |
| Datos de conductores (área, R en c.c.) | Cap. 10, Tabla 8 | 936–937 |
| R y XL en c.a. a 75 °C, 60 Hz, por tipo de conduit (caída de tensión) | Cap. 10, Tabla 9 | 938 |

### 1.2 Erratas o anomalías detectadas en el texto del DOF

**Estado: correcciones aprobadas por el usuario el 2026-10-24.** En el JSON se guarda el valor tal como aparece en el DOF y, junto a él, un campo `errata` con la corrección, su justificación y la aprobación. El motor usa el valor corregido. E5 queda pendiente de revisión visual.

| # | Tabla (p.) | Lo que dice el DOF | Corrección propuesta | Justificación |
|---|---|---|---|---|
| E1 | 310-15(b)(2)(a), p. 166 | Renglón "91-75" | 71-75 | Rompe la secuencia 66-70 → 76-80 |
| E2 | 310-15(b)(2)(b), p. 167 | Renglón "91-75" | 71-75 | Igual que E1 |
| E3 | 430-250, p. 406 | 10 hp, 575 V = **44** A | 11 A | Fuera de secuencia (7½ hp = 9 A, 15 hp = 17 A). NEC 430.250 = 11 A |
| E4 | 430-247, p. 405 | 150 hp, 500 V = **346** A | 246 A | Mayor que 200 hp (330 A). NEC 430.247 = 246 A |
| E5 | 430-250, p. 406 | Renglón 250 hp con celdas vacías | Revisar visualmente | La extracción de texto no permite confirmar en qué columnas caen 302 / 242 / 60 A |
| E6 | Tabla 8, nota 2, p. 937 | "R2 = R1 [1 + (T2 - 75)]" | R2 = R1 [1 + α(T2 − 75)] | Falta el símbolo α (αCu = 0.00323, αAl = 0.00330) |
| E7 | Tabla 9, p. 938 | Encabezados de columnas desordenados | Orden: XL (PVC/Al, acero); R Cu (PVC, Al, acero); R Al (…); Z Cu (…); Z Al (…) | Confirmado con 4/0 Cu: 0.203/0.220/0.207 Ω/km = 0.062/0.067/0.063 Ω/kft del NEC × 3.281 |

Detalles menores que no afectan el cálculo: la sección 1/0 aparece como 53.49 mm² en la Tabla 310-15(b)(16) y como 53.5 mm² en otras tablas. Se usará la **designación** (AWG/kcmil) como clave y el área de la Tabla 8.

## 2. NEC (NFPA 70): ediciones seleccionables 2020, 2023 y 2026

- **Acceso legal gratuito:** el visor *Free Access* de NFPA (requiere cuenta, solo lectura; no permite copiar, imprimir ni buscar). Enlace en `referencias/normas/LEEME - NEC e IEC.txt`.
- **Consecuencia práctica:** yo no puedo crear cuentas ni iniciar sesión por ti, y el visor no permite copiar. Las tablas NEC las tendrías que **capturar tú** desde el visor en una plantilla JSON/Excel que yo te preparo, por tabla y por edición. Otra opción es comprar el PDF.
- **Fuentes secundarias** (catálogos de fabricantes que reproducen la 310.16, cursos): sirven para detectar errores de captura, **no** para marcar un dato como verificado.
- **NEC 2026:** fuentes secundarias indican que se **reubicaron tablas de dimensionamiento** (Art. 240, 250.122, 310.16) y que hay artículos nuevos para más de 1000 V. Por eso cada edición tendrá su propio mapa de referencias; el motor no puede suponer que los números de sección coinciden entre ediciones.
- La NOM-001-SEDE-2012 deriva del NEC 2011, así que muchos valores coinciden. Aun así, **no copiaré valores de la NOM a los módulos NEC** sin una captura verificada.

## 3. IEC 60364

| Parte | Edición vigente (según fuentes consultadas) | Uso en fase 1 |
|---|---|---|
| 60364-5-52 | Ed. 3.1 = 2009 + AMD1:2024 | Métodos de instalación, ampacidades (Anexo B), factores, caída de tensión (Anexo G) |
| 60364-4-43 | **Por confirmar** | Coordinación Ib ≤ In ≤ Iz, I2 ≤ 1.45·Iz |
| 60364-5-54 | **Por confirmar** | Sección del conductor PE |
| 60364-1 | 2025 (6.ª ed.), según tu LEEME | Definiciones generales |

- **No hay acceso gratuito oficial.** La IEC Webstore vende cada parte por separado; sus *previews* solo muestran el índice y el alcance.
- **Fuentes secundarias gratuitas y legítimas** que reproducen las tablas de la 5-52: *Electrical Installation Guide* de Schneider Electric (electrical-installation.org) y *Electrical Installation Handbook* de ABB. Propongo usarlas con un estado propio, `fuente_secundaria`. El motor las aceptaría, pero la memoria lo indicaría con una nota visible hasta que se verifiquen contra la norma comprada.

## 4. Estados de un dato normativo

`por_verificar` → (`fuente_secundaria`) → `verificado`

Cada tabla JSON registra: norma, edición, tabla, artículo, página, fuente (archivo + SHA-256 o URL), estado, quién la verificó y cuándo, y sus erratas.

## Fuentes consultadas en internet
- NOM-001-SEDE-2012 en el DOF: https://dof.gob.mx/nota_detalle_popup.php?codigo=5280607
- PROY-NOM-001-SEDE-2018 (no entró en vigor): https://dof.gob.mx/nota_detalle_popup.php?codigo=5547155
- Catálogo de normas de la Secretaría de Economía: https://platiica.economia.gob.mx/normalizacion/nom-001-sede-2012/
- Acceso libre a NFPA (guía): https://research.lib.buffalo.edu/NFPA
- Página NFPA 70: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
- Foro Mike Holt sobre las restricciones del visor: https://forums.mikeholt.com/threads/nfpa-free-online-access.26609/post-416585
- IEC 60364-5-52:2009/AMD1:2024: https://scc-ccn.ca/standardsdb/standards/2056444 · https://webstore.iec.ch/en/publication/15764
- Cambios del NEC 2026 (fuente secundaria): https://expertce.com/courses/north-dakota-8-hours-nec-2026-code-updates-part-1/ · https://iaeimagazine.org/?p=26520
