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
| `tension-fuera-de-tolerancia` | Advertencia / Error | Tensión nominal de la carga comparada con la que entrega el sistema: más de 5 % es advertencia y más de 10 % es error |

## Tensión que el sistema entrega a una carga

La referencia de cada zona es el primer elemento de distribución, en este orden de prioridad: fuente, transformador, convertidor, tablero o barra.

| Sistema de referencia | Conexión de la carga | Tensión esperada |
|---|---|---|
| Trifásico (3F3H / 3F4H) | Trifásica, o monofásica entre fases (A-B, B-C, C-A) | V |
| Trifásico 4 hilos | Monofásica fase-neutro (A, B, C) | V / √3 (p. ej. 220 / √3 = 127.0 V) |
| Monofásico 3 hilos | Fase-neutro (A, B) | V / 2 |
| Monofásico 3 hilos | Entre fases (A-B) | V |
| Monofásico 2 hilos | Cualquiera | V |

La diferencia se calcula como |V_carga − V_esperada| / V_esperada. Ejemplos:
- Motor de 460 V en un sistema de 480 V: 4.2 %, sin observación.
- Motor de 115 V en un sistema de 127 V fase-neutro: 9.5 %, advertencia.

Las tolerancias (5 % y 10 %) son criterios de diseño de la herramienta, no valores de una norma. Están en `VOLTAGE_TOLERANCE` y se pueden ajustar.
