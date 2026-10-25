# Etapa 0 — Análisis REA de referencias y plan de la fase 1

> Estado: **borrador para aprobación**. No se escribe código hasta que el plan se apruebe.
> Fecha: 2026-10-24

## 1. Alcance y limitaciones del análisis

- El análisis se hizo sobre las **páginas públicas** de cada producto. Las de NOMIA, EasyPower y Ecodial describen bien sus funciones. La de SIMARIS design trae poco detalle (solo dice que dimensiona con productos reales, de MT al contacto, conforme a VDE/IEC). Lo que se dice abajo de SIMARIS sale de conocimiento general del producto y está marcado con **(†)**.
- No se instaló ni se inspeccionó ningún binario. Si más adelante quieres profundizar (por ejemplo, exportar proyectos de ejemplo de Ecodial o SIMARIS y estudiar su estructura de datos y sus reportes), conviene hacerlo con instalaciones con licencia y revisando el EULA de cada producto: varios prohíben descompilar. El análisis funcional (usar el software y estudiar lo que entrega) normalmente sí está permitido.

## 2. Resumen por referencia

| Software | Enfoque | Plataforma | Aportes clave para la fase 1 |
|---|---|---|---|
| **NOMIA** | Diseño de instalaciones bajo NOM-001-SEDE-2012; cada resultado cita el artículo o la tabla de la norma | Web (beta 0.9) | Flujo de trabajo *Capturar → Calcular → Entregar*; hoja de cálculo por circuito (carga, I, conductor, protección, tierra, ΔV) con marca de cumplimiento y cita del artículo; memoria en PDF con cuadro de datos del usuario; unifilar en DXF |
| **SIMARIS design** | Dimensionamiento de MT a BT con catálogo Siemens, VDE/IEC | Escritorio (Windows) (†) | Dimensionamiento "con mínima captura": parámetros por defecto razonables y el sistema propone el equipo; árbol de distribución por niveles (†); escenarios de operación (red normal / emergencia) (†) |
| **EasyPower** | Suite completa de análisis (ANSI/IEC/NEC) | Escritorio (Windows) | Unifilar como modelo de datos central; *Database Browser* (vista tabular editable de todos los elementos); ScenarioManager; SmartBreaker (abrir/cerrar dispositivos); SmartDesign (dimensionamiento automático por reglas); cuadros de tableros y CCM sincronizados con el unifilar |
| **Ecodial** | Dimensionamiento BT bajo IEC 60364 / CENELEC TR 50480, con versiones por país | Escritorio (Windows) | Verifica la consistencia de la red antes de calcular; errores marcados sobre el unifilar; reporte automático de no conformidades; cédula de cables y cédula de protecciones; modos de operación con varias fuentes |

## 3. Tabla comparativa: función → qué hace cada software → cómo lo implementaremos

Leyenda: ✔ lo tiene · ◐ parcial o limitado · ✖ no lo tiene o no se menciona · (†) dato no tomado de la página consultada

| Función | NOMIA | SIMARIS design | EasyPower | Ecodial | Nuestra implementación (fase 1) |
|---|---|---|---|---|---|
| Editor de unifilar | ◐ Genera unifilar en láminas PDF/DXF a partir de la captura | ✔ Editor gráfico (†) | ✔ Editor central de 1φ, 3φ y CD | ✔ Unifilar como vista principal | Lienzo interactivo (arrastrar, conectar, snap, zoom, deshacer/rehacer, selección múltiple). El **modelo eléctrico vive separado de la vista** |
| Simbología ANSI / IEC | ✖ | IEC (†) | ANSI e IEC | IEC | Cada tipo de elemento tiene símbolo ANSI e IEC; cambiar la simbología del proyecto solo cambia el *renderer* |
| Biblioteca de elementos | ◐ Catálogo de cargas | ✔ Catálogo de productos Siemens | ✔ Bibliotecas de fabricantes | ✔ Catálogo Schneider | Biblioteca **genérica** (sin fabricante) y extensible mediante un *registro de tipos* (parámetros + símbolos + comportamiento de cálculo). Los catálogos de fabricante quedan para una fase posterior |
| Vista tabular de datos | ◐ Hoja por circuito | ◐ (†) | ✔ Database Browser | ◐ Cédulas | Planteada como opcional en la fase 1 (etapa 7): tabla editable de alimentadores y cargas. Pendiente de tu decisión |
| Validación de topología | ✖ | ✔ (†) | ✔ | ✔ Consistencia de red antes de calcular | Validador previo al cálculo: elementos sueltos, islas sin fuente, tensiones incompatibles entre elementos conectados, lazos (no soportados en la fase 1). Los errores se marcan sobre el lienzo |
| Flujo de carga | ✖ | ✔ (†) | ✔ PowerFlow balanceado y desbalanceado | ✔ (TR 50480) | Barrido *backward/forward* para redes radiales, con interfaz `LoadFlowSolver` para conectar Newton-Raphson después |
| Caída de tensión | ✔ Por circuito | ✔ | ✔ | ✔ | Por tramo y acumulada desde la fuente, con límites configurables por proyecto y por tipo de circuito |
| Dimensionamiento de conductores | ✔ NOM | ✔ VDE/IEC | ✔ SmartDesign | ✔ IEC | Motor de criterios simultáneos: ampacidad corregida, coordinación con la protección, ΔV y reglas especiales. Se elige el calibre mínimo que cumple todos y la memoria indica cuál criterio rigió |
| Selección de protección (In) | ✔ | ✔ Con producto real | ✔ | ✔ | Capacidad nominal estándar de la norma activa (ej. NOM 240-6). Sin curvas en la fase 1 |
| Conductor de puesta a tierra | ✔ | ✔ | ◐ | ✔ PE | Tabla 250-122 (NOM/NEC) o IEC 60364-5-54 |
| Motores (IPC por tabla, arranque) | ✔ | ✔ | ✔ | ✔ | IPC desde la tabla de la norma (NOM/NEC 430-248/250). Para IEC, dato de placa (pendiente de decidir) |
| Cuadros de carga / balance | ◐ | ◐ | ✔ Cuadros de tablero y CCM | ◐ | Cuadro por tablero: circuitos, fase asignada, demanda, corriente por fase y % de desbalance |
| Memoria de cálculo trazable | ✔ Cita artículos | ◐ | ◐ | ✔ Notas de diseño | **Requisito central**: cada resultado guarda una *traza* (fórmula, valores, tabla, artículo, edición) que se imprime en la memoria |
| Normas soportadas | NOM-001-SEDE-2012 | VDE, IEC | ANSI, NEC, IEC | IEC + variantes por país | Módulos intercambiables: `nom-001-sede-2012`, `nec-<edición>`, `iec-60364-5-52` |
| Escenarios / estado de interruptores | ✖ | ✔ Modos de operación (†) | ✔ ScenarioManager, SmartBreaker | ✔ Modos de operación | Fase 1: estado abierto/cerrado de interruptores y posición del ATS (define qué fuente alimenta). Escenarios completos después |
| Reportes | PDF con marca del usuario, DXF | ✔ (†) | PDF, CAD, hojas de cálculo | Reporte de cálculo, cédulas | Unifilar en PDF/SVG/PNG (vectorial, generado desde el modelo). Memoria y cuadros en PDF y Excel |
| Cortocircuito | ✔ | ✔ | ✔ ANSI / IEC 60909 | ✔ | **Fuera de alcance.** Cada elemento expone impedancias de secuencia desde ahora |
| Coordinación y arc flash | ✖ | ✔ Selectividad (†) | ✔ TCC, IEEE 1584 | ◐ Curvas | **Fuera de alcance** |
| FV, canalizaciones, asistente IA | ✔ | ✖ | ✖ | ✖ | **Fuera de alcance** (las canalizaciones ya estaban excluidas) |

## 4. Alcance concreto propuesto para la fase 1

**Incluye**
1. Editor de unifilar con los elementos de la biblioteca: acometida, generador, UPS, transformador, tablero, CCM, barra, interruptor, ATS, alimentador (cable), motor, VFD, contacto, luminaria, carga genérica y carga agrupada.
2. Simbología ANSI/IEEE (IEEE 315) e IEC (IEC 60617) por proyecto. Yo dibujo los símbolos y tú los revisas.
3. Panel de propiedades por tipo de elemento y etiquetado automático editable.
4. Validación de topología antes de calcular.
5. Flujo de carga radial, caída de tensión, dimensionamiento de conductores, protección, conductor de tierra, balance por fase y cuadros de carga.
6. Memoria de cálculo trazable para cada resultado.
7. Tres módulos normativos. Primero NOM (completo y verificado por ti); después NEC e IEC.
8. Proyectos en JSON documentado con JSON Schema: crear, guardar, abrir y duplicar.
9. Reportes: unifilar en PDF/SVG/PNG; memoria y cuadros en PDF/XLSX.
10. Interfaz en español con i18n listo para inglés; unidades mm²/m con opción AWG-kcmil/ft.
11. Resultados sobre el diagrama con alertas en color.

**Supuestos de alcance que propongo (corrígeme si no aplican)**
- Redes **radiales** solamente. Si hay varias fuentes, solo una alimenta cada isla a la vez, según el estado de interruptores y del ATS. Un lazo cerrado se marca como error.
- Protección: solo la capacidad nominal (In). La capacidad interruptiva no se verifica porque requiere el cálculo de cortocircuito.
- Biblioteca genérica, sin catálogos de fabricante.
- Aplicación web **sin backend**: los archivos se guardan y abren localmente y hay autoguardado en el navegador. Las cuentas de usuario están fuera de alcance.

**Preparación de arquitectura para fases posteriores**
- Cada elemento declara sus impedancias de secuencia (Z1, Z0) y su X/R → cortocircuito.
- `LoadFlowSolver` es una interfaz: `RadialSweepSolver` ahora, `NewtonRaphsonSolver` después.
- Registro de *estudios* (`Study`): flujo de carga y dimensionamiento ahora; cortocircuito, coordinación y arc flash después.
- El modelo de grafo admite lazos, aunque el solver de la fase 1 los rechace.

## 5. Stack propuesto

| Capa | Elección | Justificación |
|---|---|---|
| Lenguaje | **TypeScript** estricto en todo el proyecto | Lo pediste. Un solo lenguaje para el motor y la interfaz, y tipos para el modelo eléctrico |
| Estructura | Monorepo **pnpm workspaces** | Separa físicamente el motor y la interfaz: el motor no puede importar código de UI |
| Paquetes | `core` (modelo, registro de tipos, esquema JSON) · `engine` (solvers, criterios, trazas) · `norms/*` (un paquete por norma) · `norm-data` (tablas JSON + validación) · `apps/web` | Cada norma es un módulo intercambiable que implementa la interfaz `NormModule` |
| Frontend | **React 18 + Vite** | Ecosistema maduro y buen soporte de la librería de diagramas |
| Diagramas | **React Flow (@xyflow/react)** para la edición | Ya trae zoom, desplazamiento, snap a la rejilla, selección múltiple, conectores (*handles*) y nodos personalizados en SVG. Alternativas descartadas: JointJS+ (de pago para funciones clave), GoJS (de pago), lienzo propio (mucho trabajo) |
| Exportar unifilar | **Renderer SVG propio** a partir del modelo + jsPDF/svg2pdf | Un SVG vectorial limpio, con la simbología correcta. No depende de capturas del DOM |
| Estado / deshacer | Zustand + parches de Immer | Deshacer y rehacer basados en parches del modelo, no de la vista |
| Validación de datos | Zod (modelo) + JSON Schema (formato de proyecto y tablas normativas) | Errores claros al abrir archivos o tablas corruptas |
| Números | Fasores complejos propios (clase `Complex`), en SI internamente | El barrido necesita aritmética compleja. Las unidades solo se convierten en la interfaz |
| Pruebas | **Vitest** | Rápido, nativo de TypeScript. Pruebas de motor con casos resueltos a mano |
| Reportes | pdfmake (memoria) · ExcelJS (XLSX) | Ambos funcionan en el navegador y tienen licencia libre |
| i18n | i18next | Archivos `es.json` / `en.json` |

## 6. Datos normativos

- Una carpeta por norma y edición, por ejemplo `norm-data/nom-001-sede-2012/tabla-310-15-b-16.json`, con metadatos: norma, edición, tabla, artículo, página del DOF, `estado: "por_verificar" | "verificado"`, quién verificó y cuándo.
- El motor **se niega a calcular con tablas `por_verificar`**, salvo que actives un "modo borrador". En ese modo la memoria sale con una marca de agua.
- Tablas mínimas para NOM-001-SEDE-2012:
  - 310-15(b)(16) (y 310-15(b)(17) si se usa conductor al aire)
  - 310-15(b)(2)(a), factores por temperatura
  - 310-15(b)(3)(a), agrupamiento
  - 240-6(a), capacidades estándar
  - 250-122, tierra
  - 430-247/248/250, corrientes de motores
  - 430-52, protección de motores
  - Capítulo 10, Tabla 9 (R y X de conductores)
  - Tabla 8 (datos de conductores)
  - Límites de 210-19 / 215-2 (notas informativas)
  - Regla de terminales 110-14(c)
- Las equivalentes en NEC (310.16, 310.15(B)(1), 310.15(C)(1), 240.6(A), 250.122, 430.248/250, Cap. 9 Tabla 9) y en IEC 60364-5-52 (tablas B.52.2–B.52.13, B.52.14, B.52.17), IEC 60364-4-43 (Ib ≤ In ≤ Iz, I2 ≤ 1.45·Iz) e IEC 60364-5-54 (Tabla 54.2).
- **No capturaré valores de memoria como verificados.** Puedo hacer una transcripción preliminar marcada `por_verificar` para que la revises contra tu ejemplar, o dejar las tablas vacías para que tú las captures.

## 7. Plan por etapas

Cada etapa termina con algo que puedes ejecutar o revisar. No paso a la siguiente sin tu visto bueno.

| Etapa | Contenido | Entregable que revisas |
|---|---|---|
| **E0** | Este análisis y plan | Este documento |
| **E1** | Monorepo, modelo de datos (`core`), registro extensible de tipos, formato de proyecto en JSON Schema, README inicial | Esquema documentado + pruebas del modelo + guía "cómo agregar un tipo de elemento" |
| **E2** | Infraestructura de datos normativos (formato, cargador, validación, estados de verificación) + tablas NOM-001-SEDE-2012 | Archivos JSON + lista de verificación por tabla para que la revises |
| **E3** | Editor de unifilar: lienzo, biblioteca, arrastrar/conectar/mover/copiar/eliminar, snap, zoom, deshacer/rehacer, selección múltiple, etiquetado automático, cambio ANSI↔IEC, guardar/abrir/duplicar | App corriendo en local; dibujas un unifilar y lo guardas |
| **E4** | Panel de propiedades por tipo + validación de topología con marcas en el lienzo | Configuras el sistema de ejemplo completo |
| **E5** | Motor: flujo de carga radial + caída de tensión + trazas. **Sistema de ejemplo resuelto a mano** (acometida → TR → TG → CCM y tableros derivados → cargas variadas) en un documento aparte, usado como prueba | Documento del cálculo a mano para que lo revises + pruebas en verde |
| **E6** | Módulo NOM: dimensionamiento de conductores (todos los criterios), protección, tierra, reglas de motores y cargas continuas | Memoria de cálculo del ejemplo, comparada contra tu cálculo |
| **E7** | Resultados sobre el diagrama + alertas; cuadros de carga y balance por fase; (opcional) vista tabular | Cuadros del ejemplo |
| **E8** | Reportes: unifilar en PDF/SVG/PNG; memoria y cuadros en PDF/XLSX | Archivos exportados del ejemplo |
| **E9** | Módulos NEC e IEC 60364-5-52 (con sus tablas verificadas) + casos de prueba | Mismo ejemplo calculado con las tres normas |
| **E10** | Unidades AWG/kcmil/ft completas, base i18n en inglés, pulido, README final | Versión 1.0 de la fase 1 |

## 8. Decisiones tomadas (2026-10-24)

| # | Tema | Decisión |
|---|---|---|
| 1 | NOM | **NOM-001-SEDE-2012** (confirmada por el usuario) |
| 2 | NEC | **Varias ediciones seleccionables** por proyecto: 2020, 2023 y 2026. Cada edición es un módulo con su propio mapa de secciones (la 2026 reubica tablas) |
| 3 | Fuentes | NOM: PDF del DOF en `referencias/normas/`. NEC: visor gratuito de NFPA, con captura manual del usuario. IEC: compra o fuentes secundarias con estado `fuente_secundaria`. Detalle en `docs/01-revision-normativa.md` |
| 4 | Captura NOM | Las tablas se transcriben del PDF del DOF con página de origen. Las erratas detectadas se registran aparte y se aplican solo con tu aprobación |
| 5 | Flujo de carga | **Secuencia positiva balanceada** en la fase 1. El desbalance por fase se calcula en los cuadros de carga. La interfaz del solver queda preparada para un barrido abc |
| 6 | Caída de tensión | Memoria con el método de la Tabla 9 de la NOM: Ze = R·cosφ + XL·senφ. ΔV₃φ = √3·I·Ze·L; ΔV₁φ = 2·I·Ze·L. R y XL según material y tipo de conduit. El flujo de carga se muestra como valor de referencia. Límites por defecto de 3 % (tramo) y 5 % (total), configurables, citados como **notas** de 210-19 y 215-2 (no como requisito obligatorio) |
| 7 | Terminales | 110-14(c) por defecto (60 °C si ≤100 A o 14–1 AWG; 75 °C arriba), **editable por alimentador** |
| 8 | Cargas continuas | Valor por defecto según tipo de carga (alumbrado = continua; contactos y carga genérica = no continua; motores según el Art. 430). El usuario puede cambiarlo por carga y la memoria indica de dónde salió el valor |
| 9 | Motores IEC | Corriente nominal de **placa** como dato principal. Si no se captura, se calcula como Ib = P / (√3·V·η·cosφ) con η y cosφ capturados, y la memoria lo indica como "calculado, no normativo" |
| 10 | Persistencia | Solo navegador: archivos JSON locales + autoguardado. Sin servidor |
| 11 | Vista tabular | **Sí**, en la etapa E7 |

## 9. Estado al cierre de la fase 1 (2026-10-25)

Etapas E1 a E10 terminadas, salvo el módulo NEC, que espera la captura de sus tablas. Diferencias entre lo planeado y lo implementado:

| Punto del plan | Implementación | Motivo |
|---|---|---|
| §6: el motor «se niega a calcular» con tablas `por_verificar`, salvo en modo borrador | Calcula siempre. La memoria y el Excel llevan la marca «BORRADOR» si hay tablas pendientes o errores | El usuario ve los resultados mientras revisa; la marca impide usarlos como definitivos |
| §5: PDF del unifilar con jsPDF/svg2pdf | pdfmake para la memoria y para el unifilar (SVG embebido) | Una sola biblioteca de PDF, que también funciona en Node (reportes del ejemplo y pruebas) |
| §5: deshacer con parches de Immer | Historial de instantáneas del proyecto (el modelo es inmutable) | Más simple y suficiente para el tamaño de los proyectos |
| §5: i18n con i18next | Diccionarios propios (`apps/web/src/i18n`) con las mismas claves en `es` y `en` | Sin dependencia adicional; la biblioteca de elementos se traduce por su texto original |
| §8 decisión 9 (motores IEC) | Orden: corriente de placa → calculada con η y FP capturados («no normativa») → tabla aproximada de ABB con advertencia | Decisiones del usuario del 2026-10-24 y 2026-10-25 |
| E9: «mismo ejemplo calculado con las tres normas» | NOM e IEC. El cambio de norma adapta el proyecto (aislamiento, método, calibres fijados, límites de caída) | NEC sin datos |
| IEC 60364-5-52:2009+A1:2024 | Edición 2001, con las tablas del manual ABB (fuente secundaria) cotejadas contra la edición 2009 | Única fuente de tablas disponible; ver `docs/01-revision-normativa.md` §3.2 |

Publicación: GitHub Pages con GitHub Actions; la guía está en `docs/publicar-github.md`.

**Entorno:** Node 24, pnpm 9.15.9 y Git 2.56 instalados el 2026-10-24. Se usan **pnpm workspaces**.

**Erratas del DOF E1 a E7:** correcciones aprobadas por el usuario el 2026-10-24 (ver `docs/01-revision-normativa.md`).
