import { describe, expect, it } from "vitest";
import { hpToNumber, nomCalc } from "../src";

describe("NOM: corriente de motores", () => {
  const q = (o: Partial<Parameters<typeof nomCalc.motorFlc>[0]>) =>
    nomCalc.motorFlc({ ratedPower: 10, ratedPowerUnit: "hp", voltageV: 460, phases: "3F", synchronous: false, ...o });

  it("convierte potencias en hp de la tabla", () => {
    expect(hpToNumber("1 1/2")).toBe(1.5);
    expect(hpToNumber("1/6")).toBeCloseTo(1 / 6, 12);
  });

  it("columna exacta y columna por intervalo de tensión (220 V → 230 V)", () => {
    expect(q({})).toMatchObject({ ok: true, amps: 14, tableVoltageV: 460 });
    const r = q({ voltageV: 220 });
    expect(r).toMatchObject({ ok: true, amps: 28, tableVoltageV: 230 });
    expect(r.ok && r.notes[0]).toContain("intervalo de 220 a 240 V");
    expect(q({ voltageV: 480 })).toMatchObject({ ok: true, tableVoltageV: 460 });
  });

  it("aplica las erratas aprobadas y lo indica en la memoria", () => {
    const r = q({ voltageV: 575 });
    expect(r).toMatchObject({ ok: true, amps: 11 });
    expect(r.ok && r.notes.join(" ")).toContain("publicado 44 A");
  });

  it("monofásicos (Tabla 430-248) y por kW", () => {
    expect(nomCalc.motorFlc({ ratedPower: 1, ratedPowerUnit: "hp", voltageV: 127, phases: "1F", synchronous: false })).toMatchObject({ ok: true, amps: 14 });
    expect(nomCalc.motorFlc({ ratedPower: 7.5, ratedPowerUnit: "kW", voltageV: 460, phases: "3F", synchronous: false })).toMatchObject({ ok: true, amps: 14, hp: "10" });
  });

  it("errores claros cuando la tabla no tiene el dato", () => {
    expect(q({ ratedPower: 12 })).toMatchObject({ ok: false });
    expect(q({ voltageV: 380 })).toMatchObject({ ok: false });
    expect(q({ ratedPower: 250, voltageV: 230 })).toMatchObject({ ok: false });
  });
});

describe("NOM: impedancia de conductores (Tabla 9)", () => {
  it("elige la columna según la canalización y declara los supuestos", () => {
    expect(nomCalc.conductorImpedance({ designation: "4/0", material: "Cu", installationMethod: "conduit-pvc-40" })).toMatchObject({ ok: true, rOhmPerKm: 0.203, xOhmPerKm: 0.135 });
    expect(nomCalc.conductorImpedance({ designation: "4/0", material: "Cu", installationMethod: "conduit-emt-aluminio" })).toMatchObject({ ok: true, rOhmPerKm: 0.22, xOhmPerKm: 0.135 });
    const inox = nomCalc.conductorImpedance({ designation: "4/0", material: "Cu", installationMethod: "conduit-rmc-inox" });
    expect(inox).toMatchObject({ ok: true, rOhmPerKm: 0.207, xOhmPerKm: 0.167 });
    expect(inox.ok && inox.notes[0]).toContain("acero inoxidable");
  });

  it("aluminio y calibres fuera de la Tabla 9", () => {
    expect(nomCalc.conductorImpedance({ designation: "4/0", material: "Al", installationMethod: "conduit-pvc-40" })).toMatchObject({ ok: true, rOhmPerKm: 0.33 });
    expect(nomCalc.conductorImpedance({ designation: "12", material: "Al", installationMethod: "conduit-pvc-40" })).toMatchObject({ ok: false });
    expect(nomCalc.conductorImpedance({ designation: "700", material: "Cu", installationMethod: "conduit-pvc-40" })).toMatchObject({ ok: false });
  });
});
