# Formato de archivo de proyecto (`.rea.json`)

- **Esquema formal:** [formato-proyecto.schema.json](formato-proyecto.schema.json). Se genera con `pnpm schema` a partir de `packages/core/src/model/schema.ts`.
- **Versión de esquema actual:** 1.

## Principios

1. **El modelo eléctrico y la representación van separados.**
   - `elements` y `connections` describen la red que calcula el motor.
   - `diagram` guarda dónde y cómo se dibuja cada cosa.
   - Por eso, cambiar la simbología (ANSI ↔ IEC) o mover un símbolo no altera el modelo.
2. **Datos capturados, no resultados.** El archivo guarda lo que el usuario capturó. Los resultados (corrientes, calibres, caídas) se recalculan, así una memoria nunca queda desfasada de sus datos.
3. **Legible y versionable.** JSON con sangría de 2 espacios e identificadores estables.
4. **Compatibilidad hacia adelante.** Cada archivo declara su `schemaVersion`.
   - Al abrir un archivo antiguo, la aplicación lo migra paso a paso.
   - Un archivo más nuevo que la aplicación se rechaza con un mensaje claro.

## Estructura

```jsonc
{
  "format": "rea-electrico/proyecto",
  "schemaVersion": 1,
  "meta": {
    "id": "prj_3f9a1c2b7d4e",
    "name": "Planta Norte",
    "client": "Cliente S.A. de C.V.",
    "location": "Monterrey, N.L.",
    "author": "Ing. ...",
    "description": "",
    "createdAt": "2026-10-24T16:00:00.000Z",
    "updatedAt": "2026-10-24T16:00:00.000Z"
  },
  "settings": {
    "norm": { "id": "nom-001-sede", "edition": "2012" },   // o { "id": "nec", "edition": "2023" }, { "id": "iec-60364", ... }
    "symbology": "ANSI",                                     // "ANSI" | "IEC"
    "units": { "conductorSize": "mm2", "length": "m" },      // "mm2" | "AWG" ; "m" | "ft"
    "language": "es",
    "frequencyHz": 60,
    "ambient": { "airC": 30, "groundC": 20 },
    "voltageDrop": { "branchPct": 3, "feederPct": 3, "totalPct": 5 },
    "phaseUnbalance": { "maxPct": 5 }
  },
  "elements": [
    {
      "id": "el_a1b2c3d4e5f6",
      "type": "transformer",           // tipo registrado en la biblioteca
      "tag": "TR-1",
      "tagLocked": false,              // true si el usuario editó la etiqueta
      "params": {
        "ratedKVA": 500, "primaryVoltageV": 23000, "primarySystem": "3F3H",
        "secondaryVoltageV": 220, "system": "3F4H", "connection": "Dyn1",
        "impedancePct": 5.75, "xrRatio": null, "tapPct": 0
      }
    }
  ],
  "connections": [
    { "id": "cn_0f1e2d3c4b5a", "a": { "elementId": "el_...", "portId": "secondary" }, "b": { "elementId": "el_...", "portId": "bus" } }
  ],
  "diagram": {
    "nodes": { "el_a1b2c3d4e5f6": { "x": 200, "y": 120, "rotation": 0 } },
    "wires": { "cn_0f1e2d3c4b5a": { "waypoints": [] } }
  }
}
```

## Convenciones de unidades en `params`

Cada parámetro declara en su definición la unidad en que se **almacena**. La interfaz puede mostrar otra; por ejemplo, ft para longitudes o AWG para calibres.

| Magnitud | Unidad almacenada |
|---|---|
| Tensión | V (línea a línea; en sistemas 1F2H, la tensión entre los dos conductores) |
| Potencia | La declarada por el parámetro (kVA, kW, hp, W, VA) con su campo de unidad cuando aplica, p. ej. `ratedPowerUnit` |
| Longitud | m |
| Temperatura | °C |
| Porcentajes | % (5.75 = 5.75 %) |
| Factores | p.u. (0.85) |
| Valor no capturado o automático | `null` |

## Sistemas (`system`)

| Clave | Significado |
|---|---|
| `1F2H` | Monofásico, 2 hilos |
| `1F3H` | Monofásico, 3 hilos |
| `3F3H` | Trifásico, 3 hilos |
| `3F4H` | Trifásico, 4 hilos |

## Conexiones

- Una conexión une **dos puertos** y tiene impedancia nula; las impedancias las aportan los cables y los transformadores.
- Los tableros, los CCM y las barras tienen un puerto `bus` con conexiones ilimitadas. El resto de los puertos admite una sola conexión.
- Las etiquetas de los tipos de elemento y la descripción de sus puertos están en `packages/core/src/library/`.
