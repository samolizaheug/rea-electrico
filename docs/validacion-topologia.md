# Validación de la red (previa al cálculo)

- **Implementación:** `packages/engine/src/topology/validate.ts`.
- **Pruebas:** `packages/engine/test/topology.test.ts`.
- **En el editor:** los elementos con observaciones se marcan en rojo (error) o ámbar (advertencia), y el botón "Validación" de la barra de estado abre la lista. Al hacer clic en una observación se seleccionan sus elementos.

Los **errores** impiden calcular; las **advertencias** se informan pero no lo impiden.

## Datos de cada tipo de elemento que usa el validador

El validador no conoce los tipos de elemento por nombre. Lee de su definición (`@rea/core`):

| Dato | Para qué sirve | Ejemplo |
|---|---|---|
| `ports[].voltage` | Parámetros de tensión, sistema y fase de cada puerto | Primario del transformador: `primaryVoltageV` / `primarySystem` |
| `internalLinks` | Conexiones internas entre puertos. Pueden depender de un parámetro (`when`) y tener sentido de flujo (`directional`) | Interruptor: línea–carga si `state = cerrado`. ATS: normal–carga o emergencia–carga según `position` |
| `voltageTransparent` | La tensión pasa sin cambio por las conexiones internas | Cables, interruptores y ATS: sí. Transformador, UPS y variador: no |

## Reglas

| Código | Severidad | Regla |
|---|---|---|
| `puerto-sin-conectar` | Error | Carga sin conectar, extremo de cable libre, entrada de un equipo con sentido de flujo (primario, entrada de UPS o variador) sin conectar |
| `puerto-sin-conectar` | Advertencia | Fuente sin conectar, salida libre, interruptor de reserva, tablero sin conexiones |
| `sin-fuente` | Error | El elemento no tiene ninguna fuente, ni siquiera cerrando todos los interruptores |
| `desenergizado` | Advertencia | Queda sin alimentación por un interruptor abierto o la posición de un ATS |
| `fuentes-en-paralelo` | Error | Dos o más fuentes alimentan la misma red con el estado actual de maniobras. La fase 1 es radial |
| `lazo` | Error | Red mallada: una conexión interna cierra un camino entre dos nodos ya unidos. Se marca el elemento que cierra el lazo |
| `alimentacion-inversa` | Advertencia | Transformador, UPS o variador alimentado por su secundario o salida |
| `tension-incompatible` | Error | Dos elementos de distribución en la misma zona de tensión (fuente, transformador, salida de UPS o variador, tablero, barra) con tensiones nominales que difieren más de 1 % |
| `sistema-incompatible` | Error | Distinto número de fases. Tablero de 4 hilos alimentado por un sistema de 3 hilos. Carga trifásica en sistema monofásico. Carga fase-neutro sin neutro. Fase inexistente en sistema monofásico de 3 hilos. Carga monofásica marcada como "A-B-C" |
| `tension-fuera-de-tolerancia` | Advertencia / Error | La tensión que entrega el sistema difiere de la tensión de placa del equipo más de lo admitido por el fabricante (ver tolerancias) |
| `criterio-excede-norma` | Error | Un límite de caída de tensión del proyecto es mayor que el de la norma |

## Tolerancia de tensión de los equipos (actualizado 2026-10-24)

La tolerancia se mide **respecto a la tensión de placa del equipo**, que es como la expresan los fabricantes:

> diferencia = (V_entregada − V_placa) / V_placa

| Equipo | Operación continua | Límite admisible | Fuente |
|---|---|---|---|
| Motores | ±5 % (sin observación) | ±10 % (advertencia entre 5 y 10 %; error arriba de 10 %) | IEC 60034-1 zona A ±5 % / zona B ±10 % (Siemens, catálogo de motores ME 81). NEMA MG-1: ±10 % de la tensión de placa (IEEE Std 141, guías de fabricantes) |
| Otras cargas | ±5 % | ±10 % | Criterio de la herramienta, configurable. No se localizó una tolerancia de fabricante única para cargas que no son motores |

Ejemplos:

| Caso | Diferencia | Resultado |
|---|---|---|
| Motor de 460 V en 480 V | +4.3 % | Correcto: es el par normalizado NEMA, porque la placa ya considera la caída interna |
| Motor de 230 V en 220 V | −4.3 % | Correcto |
| Motor de 208 V en 220 V | +5.8 % | Advertencia: fuera de la zona A |
| Motor de 115 V en 127 V | +10.4 % | Error: excede ±10 % |

Otras referencias de fabricantes:
- ABB (*Electrical installation handbook*, 4.ª ed.): por debajo de 85 % de la tensión nominal, la retención de un contactor no es confiable. Se aplicará en el estudio de arranque, en fases posteriores.
- **NOM 110-4** dice que "la tensión nominal de un equipo no debe ser menor a la tensión real del circuito al que está conectado". La herramienta aplica las tolerancias de producto anteriores; la interpretación de 110-4 para pares normalizados como 460/480 V queda pendiente de confirmación del usuario.

## Límites de caída de tensión (los usa el cálculo de la E5)

Los criterios del proyecto **pueden ser más estrictos que la norma, nunca más permisivos**. La interfaz no acepta valores mayores, y un archivo que los traiga marca un error.

| Caso | Límite NOM-001-SEDE-2012 | Carácter |
|---|---|---|
| Circuito derivado | 3 % | Recomendación, 210-19(a) Nota 4 |
| Alimentador | 3 % | Recomendación, 215-2(a)(1) Nota 2 |
| Total (alimentador + derivado) | 5 % | Recomendación, mismas notas |
| Equipo electrónico sensible | 1.5 % derivado / 2.5 % combinada | **Obligatorio**, 647-4(d) |
| Bomba contra incendio, en operación | 5 % en terminales del motor a 115 % de la corriente a plena carga | **Obligatorio**, 695-7(b) |
| Bomba contra incendio, en arranque | 15 % en terminales de línea del controlador | **Obligatorio**, 695-7(a) |

Los fabricantes coinciden con estos valores o son más estrictos:
- Schneider (*Electrical Installation Guide*, IEC 60364-5-52 Tabla G.52.1): 3 % en alumbrado y 5 % en otros usos con suministro público en BT; 6 % y 8 % con subestación propia. Advierte que 8 % puede causar problemas en el arranque de motores.
- ABB: IEC 60204-1 limita la caída a 5 % hasta la carga en maquinaria.

## Tensión que el sistema entrega a una carga

La referencia de cada zona es el primer elemento de distribución, en este orden de prioridad: fuente, transformador, convertidor, tablero o barra.

| Sistema de referencia | Conexión de la carga | Tensión esperada |
|---|---|---|
| Trifásico (3F3H / 3F4H) | Trifásica, o monofásica entre fases (A-B, B-C, C-A) | V |
| Trifásico 4 hilos | Monofásica fase-neutro (A, B, C) | V / √3 (p. ej. 220 / √3 = 127.0 V) |
| Monofásico 3 hilos | Fase-neutro (A, B) | V / 2 |
| Monofásico 3 hilos | Entre fases (A-B) | V |
| Monofásico 2 hilos | Cualquiera | V |

La diferencia y las tolerancias son las de la sección anterior. Están definidas en `DEFAULT_EQUIPMENT_VOLTAGE` (`packages/engine/src/norm-module.ts`) y cada módulo normativo puede ajustarlas.
