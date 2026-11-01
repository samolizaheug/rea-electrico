import type { ParamValue, Project } from "@rea/core";
import { Builder, type Item } from "./builder";

/*
 * Ejemplos para conocer el programa. Los datos (cargas, longitudes, capacidades interruptivas, impedancias)
 * son de ejemplo, no de un proyecto real; los calibres y protecciones los calcula el programa.
 */

const cab = (tag: string, lengthM: number, method = "conduit-pvc-40", extra: Record<string, ParamValue> = {}): Item => [tag, "cable", { lengthM, installationMethod: method, insulationType: "THHW-LS", material: "Cu", ...extra }];
const mt = (tag: string, lengthM: number, kv: string): Item => [tag, "cable-mt", { lengthM, insulationKV: kv, insulationType: "MV-90", material: "Cu" }];
const brk = (tag: string, kA: number, extra: Record<string, ParamValue> = {}): Item => [tag, "breaker", { interruptingKA: kA, ...extra }];
const brk1 = (tag: string, kA: number): Item => brk(tag, kA, { poles: "1" });
const motor = (tag: string, hp: number, voltageV: number, extra: Record<string, ParamValue> = {}): Item => [tag, "motor", { ratedPower: hp, ratedPowerUnit: "hp", voltageV, system: "3F3H", powerFactor: 0.85, currentSource: "tabla", ...extra }];
const lum = (tag: string, qty: number, w: number, voltageV: number, phase: string): Item => [tag, "luminaire", { quantity: qty, wattsPerUnit: w, powerFactor: 0.9, voltageV, system: "1F2H", phase }];
const rec = (tag: string, qty: number, voltageV: number, phase: string, extra: Record<string, ParamValue> = {}): Item => [tag, "receptacle", { quantity: qty, vaPerOutlet: 180, powerFactor: 0.9, voltageV, system: "1F2H", phase, ...extra }];
const gen = (tag: string, kW: number, voltageV: number, system: string, extra: Record<string, ParamValue> = {}): Item => [tag, "generic-load", { power: kW, powerUnit: "kW", powerFactor: 0.9, voltageV, system, ...extra }];
/** Transformador; tap negativo = derivación que sube la tensión del secundario. */
const xf = (tag: string, kva: number, vp: number, vs: number, z: number, xr: number, tapPct = 0): Item => [
  tag,
  "transformer",
  { ratedKVA: kva, primaryVoltageV: vp, primarySystem: "3F3H", secondaryVoltageV: vs, system: "3F4H", connection: "Dyn1", impedancePct: z, xrSource: "placa", xrRatio: xr, tapPct },
];
const board = (tag: string, voltageV: number, use: string, system = "3F4H"): Item => [tag, "panelboard", { voltageV, system, boardUse: use }];

/** 1. Planta industrial con dos CCM: arranques directo, estrella-delta, suave y con variador. */
export function plantaDosCcm(): Project {
  const b = new Builder({
    name: "Ejemplo 1 · Planta industrial con 2 CCM",
    client: "Ejemplo",
    location: "México",
    description: "Acometida en 13.2 kV, transformador de 1500 kVA, barra principal en 480 V, dos CCM con secciones, tablero de alumbrado en 277 V y transformador seco a 220/127 V.",
  });
  b.add("ACOM-1", "utility", { voltageV: 13200, system: "3F3H", shortCircuitMVA: 250 });
  b.chain("ACOM-1", [mt("AL-MT1", 80, "15"), xf("TR-1", 1500, 13200, 480, 5.75, 7, -2.5), cab("AL-S1", 8, "charola-escalera", { trayCableType: "unipolar" }), ["TG", "busbar", { voltageV: 480, system: "3F4H", ratingA: 2500 }]]);

  // CCM-1: 4 secciones.
  b.chain("TG.bus", [brk("INT-C1", 65), cab("AL-C1", 40, "charola-escalera", { trayCableType: "unipolar" }), ["CCM-1", "mcc", { voltageV: 480, system: "3F3H", sections: 4, horizontalBusA: 800, verticalBusA: 300 }]]);
  const ccm1: [number, Item[]][] = [
    [1, [brk("INT-101", 42), cab("AL-101", 30, "conduit-rmc-acero"), motor("M-101", 100, 460, { starting: "estrella-delta" })]],
    [1, [brk("INT-102", 42), cab("AL-102", 25, "conduit-rmc-acero"), motor("M-102", 30, 460)]],
    [2, [brk("INT-103", 42), cab("AL-103", 35, "conduit-rmc-acero"), motor("M-103", 75, 460, { starting: "arrancador-suave" })]],
    [2, [brk("INT-104", 42), cab("AL-104", 20, "conduit-rmc-acero"), motor("M-104", 20, 460)]],
    [3, [brk("INT-105", 42), cab("AL-105", 15, "conduit-rmc-acero"), ["VFD-105", "vfd", { inputVoltageV: 480, efficiencyPct: 97, inputPowerFactor: 0.95 }], motor("M-105", 50, 460, { starting: "variador" })]],
    [3, [brk("INT-106", 42), cab("AL-106", 40, "conduit-rmc-acero"), motor("M-106", 15, 460)]],
    [4, [brk("INT-107", 42), cab("AL-107", 45, "conduit-rmc-acero"), motor("M-107", 15, 460)]],
    [4, [brk("INT-108", 42), cab("AL-108", 50, "conduit-rmc-acero"), motor("M-108", 10, 460)]],
    [4, [brk("INT-109", 42), cab("AL-109", 60, "conduit-rmc-acero"), motor("M-109", 7.5, 460)]],
  ];
  for (const [s, items] of ccm1) b.chain("CCM-1.bus", items, s);

  // CCM-2: 3 secciones, más lejos.
  b.chain("TG.bus", [brk("INT-C2", 65), cab("AL-C2", 90, "charola-escalera", { trayCableType: "unipolar" }), ["CCM-2", "mcc", { voltageV: 480, system: "3F3H", sections: 3, horizontalBusA: 600, verticalBusA: 300 }]]);
  const ccm2: [number, Item[]][] = [
    [1, [brk("INT-201", 42), cab("AL-201", 30, "conduit-rmc-acero"), motor("M-201", 60, 460, { starting: "estrella-delta" })]],
    [1, [brk("INT-202", 42), cab("AL-202", 25, "conduit-rmc-acero"), motor("M-202", 25, 460)]],
    [2, [brk("INT-203", 42), cab("AL-203", 20, "conduit-rmc-acero"), ["VFD-203", "vfd", { inputVoltageV: 480, efficiencyPct: 97, inputPowerFactor: 0.95 }], motor("M-203", 40, 460, { starting: "variador" })]],
    [2, [brk("INT-204", 42), cab("AL-204", 35, "conduit-rmc-acero"), motor("M-204", 10, 460)]],
    [3, [brk("INT-205", 42), cab("AL-205", 40, "conduit-rmc-acero"), motor("M-205", 5, 460)]],
    [3, [brk("INT-206", 42), cab("AL-206", 45, "conduit-rmc-acero"), motor("M-206", 3, 460)]],
  ];
  for (const [s, items] of ccm2) b.chain("CCM-2.bus", items, s);

  // Alumbrado de nave en 277 V.
  b.chain("TG.bus", [brk("INT-F", 65), cab("AL-F", 60), board("TAB-F", 480, "alumbrado-contactos")]);
  for (const [i, ph] of [["1", "A"], ["2", "B"], ["3", "C"]] as const) b.chain("TAB-F.bus", [brk1(`INT-F${i}`, 18), cab(`AL-F${i}`, 50), lum(`L-F${i}`, 24, 150, 277, ph)]);

  // Servicios en 220/127 V.
  b.chain("TG.bus", [brk("INT-T2", 65), cab("AL-T2", 15), xf("TR-2", 112.5, 480, 220, 4.5, 3), cab("AL-S2", 5), board("TAB-SG", 220, "alumbrado-contactos")]);
  b.chain("TAB-SG.bus", [brk1("INT-S1", 10), cab("AL-S11", 30), lum("L-S1", 20, 50, 127, "A")]);
  b.chain("TAB-SG.bus", [brk1("INT-S2", 10), cab("AL-S12", 25), rec("C-S1", 8, 127, "B")]);
  b.chain("TAB-SG.bus", [brk1("INT-S3", 10), cab("AL-S13", 25), rec("C-S2", 8, 127, "C")]);
  b.chain("TAB-SG.bus", [brk("INT-S4", 10), cab("AL-S14", 20), gen("CG-S1", 12, 220, "3F3H")]);
  return b.finish();
}

/** 2. Hospital: suministro normal y de emergencia con generador y ATS. */
export function hospitalGenerador(): Project {
  const b = new Builder({
    name: "Ejemplo 2 · Hospital con generador y ATS",
    client: "Ejemplo",
    location: "México",
    description: "Acometida en 23 kV con transformador de 500 kVA a 220/127 V; generador de 250 kVA que alimenta, mediante un ATS, el tablero de emergencia (alumbrado, quirófano, elevador y bomba contra incendio).",
  });
  b.add("ACOM-1", "utility", { voltageV: 23000, system: "3F3H", shortCircuitMVA: 300 });
  b.chain("ACOM-1", [xf("TR-1", 500, 23000, 220, 5, 5, -2.5), cab("AL-S1", 6, "charola-escalera", { trayCableType: "unipolar" }), board("TG-N", 220, "distribucion")]);

  // Normal.
  b.chain("TG-N.bus", [brk("INT-N1", 35), cab("AL-N1", 40), board("TAB-N1", 220, "alumbrado-contactos")]);
  b.chain("TAB-N1.bus", [brk1("INT-N11", 10), cab("AL-N11", 30), lum("L-N1", 30, 36, 127, "A")]);
  b.chain("TAB-N1.bus", [brk1("INT-N12", 10), cab("AL-N12", 30), lum("L-N2", 30, 36, 127, "B")]);
  b.chain("TAB-N1.bus", [brk1("INT-N13", 10), cab("AL-N13", 25), rec("C-N1", 10, 127, "C")]);
  b.chain("TAB-N1.bus", [brk("INT-N14", 10), cab("AL-N14", 20), gen("AA-N1", 18, 220, "3F3H")]);
  b.chain("TG-N.bus", [brk("INT-HV", 35), cab("AL-HV", 35), gen("CH-1", 70, 220, "3F3H")]);

  // Emergencia: ATS alimentado por el tablero normal y por el generador.
  b.chain("TG-N.bus", [brk("INT-ATS", 35), cab("AL-ATS", 20), ["ATS-1", "ats", {}], cab("AL-E1", 10), board("TE-1", 220, "distribucion")]);
  b.add("GE-1", "generator", { ratedKVA: 250, voltageV: 220, system: "3F4H", ratedPowerFactor: 0.8, subtransientReactancePct: 15 });
  b.chain("GE-1", [brk("INT-GE", 25), cab("AL-GE", 30)]);
  b.wire("AL-GE.to", "ATS-1.emergency");
  b.chain("TE-1.bus", [brk1("INT-E1", 10), cab("AL-E11", 30), lum("L-E1", 25, 36, 127, "A")]);
  b.chain("TE-1.bus", [brk1("INT-E2", 10), cab("AL-E12", 20), rec("C-Q1", 6, 127, "B", { sensitiveElectronic: true })]);
  b.chain("TE-1.bus", [brk1("INT-E3", 10), cab("AL-E13", 20), rec("C-Q2", 6, 127, "C", { sensitiveElectronic: true })]);
  b.chain("TE-1.bus", [brk("INT-E4", 10), cab("AL-E14", 25), motor("M-EL1", 15, 230)]);
  b.chain("TE-1.bus", [brk("INT-BCI", 10, { deviceType: "instantaneo" }), cab("AL-BCI", 15), motor("BCI-1", 25, 230, { firePump: true })]);
  return b.finish();
}

/** 3. Centro de datos: generador y ATS en la acometida, dos UPS y PDU con carga electrónica sensible. */
export function centroDatosUps(): Project {
  const b = new Builder({
    name: "Ejemplo 3 · Centro de datos con UPS",
    client: "Ejemplo",
    location: "México",
    description: "Acometida en 13.2 kV con transformador de 1000 kVA a 480/277 V y generador de 800 kVA con ATS; UPS-1 de 200 kVA (480 V) con transformador a PDU de 220/127 V y UPS-2 de 80 kVA con salida en 220/127 V; enfriamiento con variador.",
  });
  b.add("ACOM-1", "utility", { voltageV: 13200, system: "3F3H", shortCircuitMVA: 250 });
  b.chain("ACOM-1", [mt("AL-MT1", 60, "15"), xf("TR-1", 1000, 13200, 480, 5.75, 6), cab("AL-S1", 10, "charola-escalera", { trayCableType: "unipolar" }), ["ATS-1", "ats", {}], cab("AL-TG", 5, "charola-escalera", { trayCableType: "unipolar" }), board("TG", 480, "distribucion")]);
  b.add("GE-1", "generator", { ratedKVA: 800, voltageV: 480, system: "3F4H", ratedPowerFactor: 0.8, subtransientReactancePct: 15 });
  b.chain("GE-1", [brk("INT-GE", 50), cab("AL-GE", 25, "charola-escalera", { trayCableType: "unipolar" })]);
  b.wire("AL-GE.to", "ATS-1.emergency");

  // UPS-1 → tablero UPS 480 V → transformador → PDU-1 220/127 V.
  b.chain("TG.bus", [brk("INT-U1", 50), cab("AL-U1", 15), ["UPS-1", "ups", { ratedKVA: 200, inputVoltageV: 480, inputSystem: "3F3H", outputVoltageV: 480, system: "3F3H", efficiencyPct: 95, inputPowerFactor: 0.95 }], cab("AL-U1S", 10), board("TAB-UPS1", 480, "distribucion", "3F3H")]);
  b.chain("TAB-UPS1.bus", [brk("INT-P1", 35), cab("AL-P1", 12), xf("TR-PDU1", 112.5, 480, 220, 4.5, 3), cab("AL-P1S", 4), board("PDU-1", 220, "fuerza")]);
  for (const i of [1, 2, 3]) b.chain("PDU-1.bus", [brk(`INT-R${i}`, 10), cab(`AL-R${i}`, 15), gen(`RK-${i}`, 20, 220, "3F4H", { nonLinear: true, sensitiveElectronic: true })]);

  // UPS-2 con salida en 220/127 V directo a PDU-2.
  b.chain("TG.bus", [brk("INT-U2", 50), cab("AL-U2", 15), ["UPS-2", "ups", { ratedKVA: 80, inputVoltageV: 480, inputSystem: "3F3H", outputVoltageV: 220, system: "3F4H", efficiencyPct: 94, inputPowerFactor: 0.95 }], cab("AL-U2S", 10), board("PDU-2", 220, "alumbrado-contactos")]);
  for (const [i, ph] of [["1", "A"], ["2", "B"], ["3", "C"]] as const) b.chain("PDU-2.bus", [brk1(`INT-Q${i}`, 10), cab(`AL-Q${i}`, 20), rec(`C-Q${i}`, 8, 127, ph, { sensitiveElectronic: true })]);
  b.chain("PDU-2.bus", [brk("INT-R4", 10), cab("AL-R4", 15), gen("RK-4", 15, 220, "3F4H", { nonLinear: true, sensitiveElectronic: true })]);

  // Enfriamiento.
  b.chain("TG.bus", [brk("INT-M", 50), cab("AL-M", 30), board("TAB-M", 480, "fuerza", "3F3H")]);
  for (const i of [1, 2, 3]) b.chain("TAB-M.bus", [brk(`INT-CR${i}`, 35), cab(`AL-CR${i}`, 25), gen(`CRAC-${i}`, 35, 480, "3F3H")]);
  b.chain("TAB-M.bus", [brk("INT-CH", 35), cab("AL-CH", 40), ["VFD-CH", "vfd", { inputVoltageV: 480, efficiencyPct: 97, inputPowerFactor: 0.95 }], motor("M-CH1", 100, 460, { starting: "variador" })]);
  return b.finish();
}

/** 4. Edificio comercial: secundario de 220 V con conductores en paralelo, tableros por piso y cargas monofásicas. */
export function edificioComercial(): Project {
  const b = new Builder({
    name: "Ejemplo 4 · Edificio comercial de 4 pisos",
    client: "Ejemplo",
    location: "México",
    description: "Transformador de 750 kVA a 220/127 V (secundario con conductores en paralelo automáticos), un tablero por piso a distancias crecientes, alumbrado y contactos monofásicos repartidos por fase, aire acondicionado, elevadores y equipo hidroneumático.",
  });
  b.add("ACOM-1", "utility", { voltageV: 23000, system: "3F3H", shortCircuitMVA: 300 });
  b.chain("ACOM-1", [xf("TR-1", 750, 23000, 220, 5.75, 6, -2.5), cab("AL-S1", 8, "charola-escalera", { trayCableType: "unipolar" }), board("TG", 220, "distribucion")]);
  for (const n of [1, 2, 3, 4]) {
    b.chain("TG.bus", [brk(`INT-P${n}`, 35), cab(`AL-P${n}`, 15 + n * 15), board(`TAB-P${n}`, 220, "alumbrado-contactos")]);
    // Alumbrado y contactos repartidos en las tres fases (A-B-C), más el aire acondicionado trifásico.
    (["A", "B", "C"] as const).forEach((ph, k) => {
      b.chain(`TAB-P${n}.bus`, [brk1(`INT-${n}0${k + 1}`, 10), cab(`AL-${n}0${k + 1}`, 30), lum(`L-${n}0${k + 1}`, 30, 36, 127, ph)]);
      b.chain(`TAB-P${n}.bus`, [brk1(`INT-${n}0${k + 4}`, 10), cab(`AL-${n}0${k + 4}`, 25), rec(`C-${n}0${k + 1}`, 8, 127, ph)]);
    });
    b.chain(`TAB-P${n}.bus`, [brk(`INT-${n}07`, 10), cab(`AL-${n}07`, 20), gen(`AA-${n}`, 15, 220, "3F3H")]);
  }
  b.chain("TG.bus", [brk("INT-EL", 35), cab("AL-EL", 60), board("TAB-EL", 220, "fuerza", "3F3H")]);
  b.chain("TAB-EL.bus", [brk("INT-EL1", 25), cab("AL-EL1", 10), motor("M-EL1", 30, 230)]);
  b.chain("TAB-EL.bus", [brk("INT-EL2", 25), cab("AL-EL2", 10), motor("M-EL2", 30, 230)]);
  b.chain("TG.bus", [brk("INT-HN", 35), cab("AL-HN", 25), motor("M-HN", 10, 230)]);
  return b.finish();
}

/** 5. Estación de bombeo: media tensión de 34.5 kV, motores grandes y pozos lejanos (caída de tensión). */
export function estacionBombeo(): Project {
  const b = new Builder({
    name: "Ejemplo 5 · Estación de bombeo",
    client: "Ejemplo",
    location: "México",
    description: "Línea de 34.5 kV con cable de media tensión de 300 m, transformador de 1000 kVA a 480/277 V, CCM con bombas de 100 a 150 hp (estrella-delta, arrancador suave y variador) y pozos a 250 y 400 m, donde el calibre lo define la caída de tensión.",
  });
  b.add("ACOM-1", "utility", { voltageV: 34500, system: "3F3H", shortCircuitMVA: 200 });
  b.chain("ACOM-1", [mt("AL-MT1", 300, "35"), xf("TR-1", 1000, 34500, 480, 5.75, 6), cab("AL-S1", 10, "charola-escalera", { trayCableType: "unipolar" }), ["TG", "busbar", { voltageV: 480, system: "3F4H", ratingA: 1600 }]]);
  b.chain("TG.bus", [brk("INT-CB", 50), cab("AL-CB", 30, "charola-escalera", { trayCableType: "unipolar" }), ["CCM-B", "mcc", { voltageV: 480, system: "3F3H", sections: 3, horizontalBusA: 1200, verticalBusA: 600 }]]);
  b.chain("CCM-B.bus", [brk("INT-B1", 42), cab("AL-B1", 20, "conduit-rmc-acero"), motor("M-B1", 150, 460, { starting: "arrancador-suave" })], 1);
  b.chain("CCM-B.bus", [brk("INT-B2", 42), cab("AL-B2", 15, "conduit-rmc-acero"), ["VFD-B2", "vfd", { inputVoltageV: 480, efficiencyPct: 97, inputPowerFactor: 0.95 }], motor("M-B2", 125, 460, { starting: "variador" })], 2);
  b.chain("CCM-B.bus", [brk("INT-B3", 42), cab("AL-B3", 25, "conduit-rmc-acero"), motor("M-B3", 100, 460, { starting: "estrella-delta" })], 3);
  b.chain("TG.bus", [brk("INT-P4", 50), cab("AL-P4", 250, "enterrado-banco-pvc"), motor("M-P4", 60, 460)]);
  b.chain("TG.bus", [brk("INT-P5", 50), cab("AL-P5", 400, "enterrado-banco-pvc"), motor("M-P5", 40, 460)]);
  b.chain("TG.bus", [brk("INT-T2", 50), cab("AL-T2", 20), xf("TR-2", 45, 480, 220, 3.5, 2, -2.5), cab("AL-S2", 5), board("TAB-SA", 220, "alumbrado-contactos")]);
  b.chain("TAB-SA.bus", [brk1("INT-SA1", 10), cab("AL-SA1", 30), lum("L-SA1", 16, 50, 127, "A")]);
  b.chain("TAB-SA.bus", [brk1("INT-SA2", 10), cab("AL-SA2", 25), rec("C-SA1", 5, 127, "B")]);
  b.chain("TAB-SA.bus", [brk1("INT-SA4", 10), cab("AL-SA4", 25), rec("C-SA2", 5, 127, "C")]);
  b.chain("TAB-SA.bus", [brk("INT-SA3", 10), cab("AL-SA3", 20), gen("CG-SA1", 8, 220, "3F3H")]);
  return b.finish();
}
