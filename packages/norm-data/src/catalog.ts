// Archivo generado por packages/norm-data/scripts/catalog-writer.ts. No editar a mano.
import t0 from "../data/iec-60364-2001/ampacidad-aire.json";
import t1 from "../data/iec-60364-2001/ampacidad-terreno.json";
import t2 from "../data/iec-60364-2001/capacidades-interruptores.json";
import t3 from "../data/iec-60364-2001/tabla-1-impedancia-cu.json";
import t4 from "../data/iec-60364-2001/tabla-10-temperatura-terreno.json";
import t5 from "../data/iec-60364-2001/tabla-14-resistividad-suelo.json";
import t6 from "../data/iec-60364-2001/tabla-2-conductor-proteccion.json";
import t7 from "../data/iec-60364-2001/tabla-2-impedancia-al.json";
import t8 from "../data/iec-60364-2001/tabla-4-temperatura-aire.json";
import t9 from "../data/iec-60364-2001/tabla-5-agrupamiento.json";
import v10 from "../data/iec-60364-2001/verificacion.json";
import t11 from "../data/nom-001-sede-2012/art-240-6-a.json";
import t12 from "../data/nom-001-sede-2012/cap10-tabla-4.json";
import t13 from "../data/nom-001-sede-2012/cap10-tabla-8.json";
import t14 from "../data/nom-001-sede-2012/cap10-tabla-9.json";
import t15 from "../data/nom-001-sede-2012/tabla-220-42.json";
import t16 from "../data/nom-001-sede-2012/tabla-220-44.json";
import t17 from "../data/nom-001-sede-2012/tabla-250-122.json";
import t18 from "../data/nom-001-sede-2012/tabla-310-104-a.json";
import t19 from "../data/nom-001-sede-2012/tabla-310-15-b-16.json";
import t20 from "../data/nom-001-sede-2012/tabla-310-15-b-17.json";
import t21 from "../data/nom-001-sede-2012/tabla-310-15-b-2-a.json";
import t22 from "../data/nom-001-sede-2012/tabla-310-15-b-2-b.json";
import t23 from "../data/nom-001-sede-2012/tabla-310-15-b-3-a.json";
import t24 from "../data/nom-001-sede-2012/tabla-392-22-a.json";
import t25 from "../data/nom-001-sede-2012/tabla-430-22-e.json";
import t26 from "../data/nom-001-sede-2012/tabla-430-247.json";
import t27 from "../data/nom-001-sede-2012/tabla-430-248.json";
import t28 from "../data/nom-001-sede-2012/tabla-430-250.json";
import t29 from "../data/nom-001-sede-2012/tabla-430-52.json";
import v30 from "../data/nom-001-sede-2012/verificacion.json";

export const rawCatalog: Record<string, { tables: unknown[]; verification: unknown }> = {
  "iec-60364-2001": { tables: [t0, t1, t2, t3, t4, t5, t6, t7, t8, t9], verification: v10 },
  "nom-001-sede-2012": { tables: [t11, t12, t13, t14, t15, t16, t17, t18, t19, t20, t21, t22, t23, t24, t25, t26, t27, t28, t29], verification: v30 },
};
