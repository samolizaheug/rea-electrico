# Cómo agregar un tipo de elemento

Un tipo de elemento se define con **datos**. Agregar uno nuevo son cuatro pasos, y ninguno obliga a modificar el editor ni el formato de archivo.

## 1. Definición (paquete `@rea/core`)

Crea la definición en el archivo de la categoría correspondiente de `packages/core/src/library/`. También puedes registrarla desde fuera con `registry.register(def)`.

```ts
import type { ElementTypeDefinition } from "@rea/core";

export const capacitorBank: ElementTypeDefinition = {
  type: "capacitor-bank",               // id estable, kebab-case; se guarda en los archivos
  name: "Banco de capacitores",
  category: "carga",                    // fuente | transformacion | distribucion | carga
  electricalRole: "load",               // source | bus | branch | switch | transformer | converter | load
  ports: [{ id: "in", label: "Alimentación", side: "top" }],
  tag: { prefix: "BC", style: "number" },   // BC-1, BC-2 ...  (number | number2 | letter)
  symbols: { ANSI: "ansi/capacitor", IEC: "iec/capacitor" },
  calcBehavior: "load.capacitor",
  params: [
    { key: "ratedKvar", label: "Potencia reactiva", kind: "number", unit: "kvar",
      default: 50, min: 0, minExclusive: true, required: true, group: "Eléctrico" },
    // enum fijo, enum con proveedor de la norma, boolean, string; `visibleWhen` para dependencias
  ],
};
```

Para que el validador de la red entienda el elemento, la definición también declara:
- `ports[].voltage`: qué parámetros dan la tensión, el sistema y la fase en ese puerto.
- `internalLinks`: cómo se conectan internamente sus puertos. Pueden depender de un parámetro (`when`) y tener sentido de flujo (`directional`).
- `voltageTransparent`: si la tensión pasa sin cambio a través del elemento.

Detalle en [validacion-topologia.md](validacion-topologia.md).

Agrégala al arreglo de su categoría (p. ej. `loadTypes`). El registro la valida al cargarla y rechaza:
- ids repetidos o con formato incorrecto;
- puertos o parámetros duplicados;
- valores por defecto inválidos;
- dependencias `visibleWhen` hacia parámetros que no existen.

## 2. Símbolos ANSI e IEC (paquete de símbolos, etapa E3)

Dibuja los dos símbolos con las claves de `symbols`. Los puertos del símbolo deben tener los mismos `id` y lados (`side`) que en la definición.

## 3. Comportamiento de cálculo (motor, etapa E5)

Implementa el comportamiento `calcBehavior` en el motor, o reutiliza uno existente (p. ej. `load.generic`). El comportamiento dice cómo participa el elemento en:
- el flujo de carga: su potencia, o su impedancia si es serie;
- el dimensionamiento, con los criterios de la norma.

## 4. Prueba

Agrega una prueba en `packages/core/test/` y, si aporta un cálculo nuevo, un caso resuelto a mano en las pruebas del motor.

## Parámetros con opciones de la norma

Algunos enums usan `options: { provider: "norm:..." }`. Sus opciones dependen de la norma activa del proyecto: tipos de aislamiento, métodos de instalación, calibres. El módulo normativo provee la lista, y `validateParams` la verifica cuando recibe el resolvedor.
