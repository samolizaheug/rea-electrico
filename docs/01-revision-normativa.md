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

**Actualización (E2):**
- **E5 resuelta, no era errata.** Por la coordenada horizontal del texto en la p. 406, 302 / 242 / 60 A corresponden a 460 / 575 / 2300 V. Las demás celdas del renglón de 250 hp están vacías, igual que en el NEC.
- **E8, nueva, pendiente de aprobación.** La detectaron las pruebas de consistencia. En la Tabla 430-250, motor síncrono de 40 hp a 230 V, el DOF publica **93 A**.
  - I·V se aparta 13 % del resto del renglón (460 V = 41 A, 575 V = 33 A).
  - La secuencia es 30 hp = 63 A → 40 hp = ? → 50 hp = 104 A, y el NEC 430.250 da **83 A**.
  - Corrección: 83 A, **aprobada por el usuario el 2026-10-24** y aplicada.

**Verificación (2026-10-24):** a petición del usuario, Claude comparó celda por celda las 17 tablas contra las páginas del PDF renderizadas como imagen. Es un método independiente de la capa de texto que usó la extracción.
- Todas coinciden. Las imágenes confirman que E1–E4, E6 y E8 son valores publicados así en el DOF.
- La imagen de la p. 192 resuelve la duda de la 310-104(a): **THW = 75 °C sólo en lugares mojados; THW-2 = 90 °C en lugares secos y húmedos**. La NOM difiere aquí del NEC.
- Observación para el motor: la Tabla 250-122 pide Al 1200 kcmil para 5000 y 6000 A, un calibre que no aparece en las tablas de ampacidad.
- El registro está en `packages/norm-data/data/nom-001-sede-2012/verificacion.json`, a nombre de "Claude (asistente IA)", para que la memoria de cálculo indique quién verificó.
- **El resto de las tablas pasa todas las pruebas de consistencia:**
  - Tabla 8: R·A dentro del rango del cobre.
  - Tabla 9: Z publicada = R·0.85 + X·0.527 en todos los renglones.
  - Ampacidades, factores y motores: sin otros quiebres de secuencia.

**Cotejo externo (2026-10-25).** La Tabla 310-15(b)(16) transcrita se comparó con la tabla de ampacidad de Cerrowire (fabricante; NEC 2017, 14 AWG a 1000 kcmil):
- Coinciden las 80 celdas comparables (cobre 60/75/90 °C y aluminio 75/90 °C).
- Única diferencia: el NEC da aluminio para 12, 10 y 8 AWG, y el DOF publica «–» en esas celdas (confirmado en la imagen de la p. 170). Es una diferencia real de la NOM-001-SEDE-2012, no un error de transcripción. Con la NOM, el aluminio empieza en 6 AWG.

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

### 2.1 Tablas agregadas (canalizaciones, 2026-10-24)

| Tabla | p. | Estado |
|---|---|---|
| Capítulo 10, Tabla 4: dimensiones de tubo conduit por artículo (12 secciones) | 928–932 | Verificada visualmente por Claude; avalada por el Ing. RGLR. Consistencia: área = π·d²/4 y 60/53/31/40 % en todos los renglones |
| Tabla 392-22(a): área de ocupación de charolas, 5–90 cm | 285–286 | Igual que la anterior |

**Hallazgos nuevos en el texto del DOF (aceptados por el usuario el 2026-10-24 tal como se proponen):**

| # | Ubicación | Hallazgo | Propuesta |
|---|---|---|---|
| E9 | Tabla 4, p. 928 | La sección del EMT se titula "Tubo conduit **no** metálico (EMT)". 358-2 define el EMT como tubo conduit **metálico** ligero | Error de título: se usa el nombre de 358-2. Los valores no cambian |
| E10 | Tabla 4, p. 932 | Una segunda sección titulada "PVC, Cédula 80" con valores distintos de la primera (53 mm: 56.40 contra 48.60 mm) | Por sus valores es el PVC **tipo EB** de la tabla del NEC. Queda como "pvc-eb" y no se ofrece hasta que lo confirmes |
| E11 | Tabla 392-22(a), columna 4 | El factor de Sd alterna entre 30 y 25 según el ancho. En la tabla equivalente del NEC es 25 en todos los renglones | Probable errata en los anchos de 5, 10, 15, 20, 40 y 50 cm (dice 30). Se transcribe tal cual |
| E12 | Tabla 5, p. 932 | "6.63 mm² – 8 AWG" y "8.37 mm² – 6 AWG": las áreas no corresponden (8 AWG = 8.37 mm², 6 AWG = 13.3 mm²) | Probable errata. La Tabla 5 aún no se usa; servirá para el llenado de tubería |

### 3.1 Fuentes secundarias descargadas (2026-10-24)

En `referencias/normas/fuentes-secundarias/abb-electrical-installation-handbook/`, desde library.e.abb.com:

| Archivo | Bytes | SHA-256 |
|---|---|---|
| 1SDC010001D0201.pdf | 1,642,746 | C202A18865065583F14568BD9FF594C0E1CC02E1B131DA2ABA494360FE380A3B |
| 1SDC010001D0202.pdf | 2,252,630 | D49A6882F8C7C2F17B0C892F5FF11BB1D0573E045E10A31E67ADB328EBB0B833 |
| 1SDC010001D0204.pdf | 1,642,486 | 88267FA9F77CC6DFDF7D6D1581A65040AE479ABA91B977AFB36475AB2DF89E24 |

Son el Volumen 2 (*Electrical devices*) en sus ediciones 1.ª (D0201, 2003), 2.ª (D0202, 2004) y 4.ª (D0204, 2006).

### 3.2 Módulo IEC (E9, 2026-10-24)

**Edición.** Las tablas de la fuente reproducen la norma en estas ediciones (lista de normas de la propia fuente, p. 12 del PDF D0204):
- IEC 60364-5-52:2001;
- IEC 60364-4-43:2001;
- IEC 60364-5-54:2002.

Por eso el módulo se registra como **«IEC 60364-5-52:2001 (fuente secundaria ABB)»**. La edición 2009+A1:2024 sigue en la lista, deshabilitada: no hay fuente para ella y no se le atribuyen valores de otra edición.

**Tablas** (`packages/norm-data/data/iec-60364-2001/`, transcritas desde las imágenes de las páginas de D0204):

| Uso | Fuente (D0204) | p. del PDF |
|---|---|---|
| Métodos de instalación de referencia (A1–G), ejemplos | Tablas 2 y 3, cap. 2.2.1 | 29–33 |
| Ampacidad en aire, 30 °C (A1, A2, B1, B2, C, E, F, G) | Tabla 8 | 41–44 |
| Ampacidad enterrada, método D (20 °C, 2.5 K·m/W) | Tabla 15 | 51 |
| k1 temperatura del aire / del terreno | Tablas 4 y 10 | 34, 47 |
| k2 agrupamiento (y nota 5: n unipolares = n/2 o n/3 circuitos) | Tabla 5 | 37 |
| k3 resistividad del suelo (registrada; se usa 1) | Tabla 14 | 50 |
| R (80 °C) y X (50 Hz) de cables Cu y Al; ×1.2 a 60 Hz según la fuente | Tablas 1 y 2, cap. 2.2.2 | 60–61 |
| Coordinación Ib ≤ In ≤ Iz, I2 ≤ 1.45·Iz (fusible In ≤ 0.9·Iz) | cap. 2.3 (IEC 60364-4-43) | 70–71 |
| Conductor de protección: S; 16; S/2 | Tabla 2, cap. 2.5 (IEC 60364-5-54) | 86 |
| Capacidades In (series de producto ABB: MCB curva C, Tmax) | Tablas 2.3, 2.8, 2.10, 2.12, cap. 5.8 | 194–199 |
| Caída de tensión recomendada: 4 % desde el origen de la instalación | cap. 2.2.2, cita de IEC 60364-5-52 cláusula 525 | 59 |

**Comprobaciones independientes de la transcripción:**
- Cada valor se busca en la capa de texto de su página. Solo falta un valor de la Tabla 8, porque el texto lee «845» donde la imagen dice 84.
- Se cotejó con la 2.ª edición (D0202): coinciden todas las tablas salvo dos celdas (ABB-2 y ABB-3, abajo).
- R y X se comprobaron contra las tablas de caída específica del mismo manual (ΔUx = √3·(r·cosφ + x·senφ)) a cosφ = 1 y 0.9, para Cu y Al.
- Las ampacidades crecen con la sección, y en la misma condición se cumple Cu ≥ Al, XLPE ≥ PVC y 2 conductores cargados ≥ 3.

**Anomalías de la fuente (pendientes de cotejo con la norma IEC):**

| # | Ubicación | Hallazgo | Tratamiento actual |
|---|---|---|---|
| ABB-1 | Tabla 4, mineral 70 °C, 45 °C | 0.87, mayor que el de 40 °C (0.85); rompe la secuencia | Se transcribe tal cual. No se usa: la herramienta no ofrece aislamiento mineral |
| ABB-2 | Tabla 8, A1, Al PVC, 2 cargados, 2.5 mm² | 4.ª ed. = 15 A; 2.ª ed. = 14.5 A | Se usa **14.5 A**, el valor menor. Errata registrada; aprobada por el Ing. RGLR el 2026-10-24 |
| ABB-3 | Tabla 8, A2, Al PVC, 2 cargados, 4 mm² | 4.ª ed. = 19.5 A; 2.ª ed. = 20 A | Se usa 19.5 A, valor publicado y menor de los dos (criterio aprobado el 2026-10-24) |

**Decisiones del módulo** (supuestos de la herramienta, explícitos en la memoria):
- IEC no aplica un 125 % a cargas continuas. **Ib** es la suma de corrientes con el factor de demanda de cada carga. En un transformador, Ib es su corriente nominal de primario.
- **In** es el valor inmediato superior a Ib en la serie de producto. IEC 60364 no fija capacidades normalizadas.
- Interruptor de disparo instantáneo: la sobrecarga la protege el relevador del arrancador, así que solo se exige Iz ≥ Ib.
- **k1**: si la temperatura no está en la tabla, se usa el renglón de la temperatura inmediata superior (conservador).
- **k2**: si hay más de 9 circuitos en las disposiciones 2 a 5, no hay reducción adicional, como indica la fuente.
- **Método D**: k2′ (ductos adyacentes) = 1 y k3 = 1 (suelo de 2.5 K·m/W). Ambos se anotan en la memoria.
- **Motores**: IEC no tiene tabla de corrientes, y lo correcto es la corriente de placa. Si no se capturó, se usa la tabla aproximada de ABB (Anexo B, Tabla 5, p. 248: jaula, 4 polos, 50 Hz, «solo informativa») y se emite una **advertencia**. Decisión del usuario del 2026-10-24.
- **PE en circuitos en paralelo**: se dimensiona con la sección de un conductor y se pone uno por circuito en paralelo (criterio de la herramienta).
- **Al cambiar de norma** el proyecto se adapta en un solo paso de deshacer, previa confirmación:
  - aislamiento, método y canalización que no existen en la nueva norma toman el valor por defecto de esa norma;
  - los calibres fijados se vacían, porque «4» AWG no es «4» mm²;
  - los límites de caída del proyecto bajan al máximo de la norma (IEC: 4 %).

**Cotejo con la edición 2009 (2026-10-25).** TiSoft (ti-soft.com, ayuda de *ElectricalDesign*) reproduce las Tablas B.52.2 a B.52.5 de IEC 60364-5-52:2009 con cobre y aluminio. Comparación automática de las 4 tablas contra la transcripción ABB:

| Resultado | Detalle |
|---|---|
| Métodos A1, A2, B1, B2 y C: **568 celdas idénticas** | Única diferencia: ABB-2. La edición 2009 da **15 A**, el valor de la 4.ª ed. de ABB; el 14.5 de la 2.ª ed. era el error. Hoy se usa 14.5 A (conservador, aprobado). **Por decidir:** volver a 15 A |
| ABB-3 | La edición 2009 da 19.5 A, igual que lo que se usa |
| B1 y B2 de 150 a 300 mm² | La edición 2009 sí tiene valores; ABB los deja en gris. El módulo no ofrece esas secciones en B1/B2: pide conductores en paralelo u otro método |
| Método D (ductos enterrados) | La edición 2009 lo sustituyó por D1, con valores **iguales o menores**: 111 de 124 celdas son menores, hasta **8.5 %** (Cu XLPE 3 conductores, 300 mm²: 396 → 365 A). El cálculo emite una advertencia cuando se usa el método D |

Las tablas de factores (B.52.14, B.52.17) en esa fuente son imágenes; no se cotejaron. Las de ABB coinciden con la 2.ª ed. del mismo manual.

**Verificación.** Las 11 tablas (incluida la de motores) están registradas como `fuente_secundaria`, avaladas por el **Ing. RGLR** el 2026-10-24. Falta el cotejo con IEC 60364-5-52 cuando haya acceso a la norma.

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
