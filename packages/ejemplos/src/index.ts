export { sistemaEjemplo } from "./sistema-ejemplo";
export { centroDatosUps, edificioComercial, estacionBombeo, hospitalGenerador, plantaDosCcm } from "./ejemplos";
import type { Project } from "@rea/core";
import { centroDatosUps, edificioComercial, estacionBombeo, hospitalGenerador, plantaDosCcm } from "./ejemplos";
import { sistemaEjemplo } from "./sistema-ejemplo";

/** Catálogo de ejemplos para el menú «Ejemplos» del editor. */
export const EJEMPLOS: { id: string; title: string; summary: string; build: () => Project }[] = [
  { id: "sistema-ejemplo", title: "Sistema de verificación (fase 1)", summary: "Resuelto a mano: CCM, variador, transformador a 220/127 V y tablero de 277 V.", build: sistemaEjemplo },
  { id: "planta-2-ccm", title: "Planta industrial con 2 CCM", summary: "13.2 kV, 1500 kVA, dos CCM con secciones, arranques estrella-delta, suave y con variador.", build: plantaDosCcm },
  { id: "hospital-generador", title: "Hospital con generador y ATS", summary: "Normal y emergencia, generador de 250 kVA, quirófano (carga sensible) y bomba contra incendio.", build: hospitalGenerador },
  { id: "centro-datos-ups", title: "Centro de datos con UPS", summary: "Generador y ATS en la acometida, dos UPS, PDU con cargas no lineales y enfriamiento con variador.", build: centroDatosUps },
  { id: "edificio-comercial", title: "Edificio comercial de 4 pisos", summary: "Secundario de 220 V con conductores en paralelo, tableros por piso y cargas monofásicas por fase.", build: edificioComercial },
  { id: "estacion-bombeo", title: "Estación de bombeo", summary: "34.5 kV, motores de 100 a 150 hp y pozos a 250 y 400 m (caída de tensión).", build: estacionBombeo },
];
