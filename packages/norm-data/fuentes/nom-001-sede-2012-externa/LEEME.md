# Tablas de cálculo — NOM-001-SEDE-2012

Fuente: NOM-001-SEDE-2012, Instalaciones Eléctricas (utilización), DOF 29/11/2012 (documento público).
La página indicada es la del PDF unido "NOM-001-SEDE-2012 Instalaciones Electricas (utilizacion).pdf" de esta misma carpeta.

Formatos: un CSV por tabla (carpeta csv) y todo junto en tablas_NOM-001-SEDE-2012.json.

| Archivo | Referencia | Contenido | Pág. PDF |
|---|---|---|---|
| 310-15b16_ampacidad_canalizacion.csv | Tabla 310-15(b)(16) | Ampacidad, no más de 3 conductores portadores en canalización, cable o directamente enterrados, 30 °C | 170 |
| 310-15b17_ampacidad_aire_libre.csv | Tabla 310-15(b)(17) | Ampacidad de conductores individuales al aire libre, 30 °C | 171 |
| 310-15b2a_correccion_temp_30C.csv | Tabla 310-15(b)(2)(a) | Factores de corrección por temperatura ambiente (base 30 °C) | 166 |
| 310-15b2b_correccion_temp_40C.csv | Tabla 310-15(b)(2)(b) | Factores de corrección por temperatura ambiente (base 40 °C) | 166 |
| 310-15b3a_ajuste_agrupamiento.csv | Tabla 310-15(b)(3)(a) | Ajuste por más de 3 conductores portadores de corriente | 167 |
| 240-4d_limite_ocpd_conductores_pequenos.csv | 240-4(d) | Protección máxima de conductores pequeños | 89 |
| 240-6_capacidades_normalizadas_ocpd.csv | 240-6(a) | Capacidades normalizadas de fusibles e interruptores | 91 |
| 220-12_carga_alumbrado_por_inmueble.csv | Tabla 220-12 | Carga de alumbrado general por tipo de inmueble (VA/m²) | 56 |
| 220-42_demanda_alumbrado.csv | Tabla 220-42 | Factores de demanda de alumbrado | 58 |
| 220-44_demanda_contactos_no_vivienda.csv | Tabla 220-44 | Factores de demanda de contactos en inmuebles no residenciales | 59 |
| 220-54_demanda_secadoras.csv | Tabla 220-54 | Factores de demanda de secadoras domésticas | 59 |
| 220-55_demanda_estufas.csv | Tabla 220-55 | Factores de demanda de estufas y aparatos de cocción domésticos | 60 |
| 220-56_demanda_cocina_no_vivienda.csv | Tabla 220-56 | Factores de demanda de equipo de cocina no residencial | 61 |
| 220-84_opcional_multifamiliar.csv | Tabla 220-84 | Método opcional: multifamiliares de 3 o más viviendas | 64 |
| 220-86_opcional_escuelas.csv | Tabla 220-86 | Método opcional: instituciones educativas | 65 |
| 220-88_opcional_restaurantes.csv | Tabla 220-88 | Método opcional: restaurantes nuevos | 66 |
| 430-248_corriente_motores_monofasicos.csv | Tabla 430-248 | Corriente a plena carga, motores monofásicos | 405 |
| 430-250_corriente_motores_trifasicos.csv | Tabla 430-250 | Corriente a plena carga, motores trifásicos | 406 |
| 430-52_proteccion_max_motores_pct.csv | Tabla 430-52 | Ajuste máximo de protección contra cortocircuito y falla a tierra de motores (% de I plena carga) | 387 |
| 250-66_conductor_electrodo_tierra.csv | Tabla 250-66 | Conductor del electrodo de puesta a tierra | 122 |
| 250-122_conductor_tierra_equipos.csv | Tabla 250-122 | Conductor de puesta a tierra de equipos | 134 |
| cap10-tabla1_porcentaje_llenado.csv | Capítulo 10, Tabla 1 | Porcentaje máximo de llenado de tubo conduit | 927 |
| cap10-tabla4_dimensiones_tubo_conduit.csv | Capítulo 10, Tabla 4 | Dimensiones y áreas disponibles de tubo conduit por tipo | 928 |
| cap10-tabla5_dimensiones_conductores.csv | Capítulo 10, Tabla 5 | Dimensiones de conductores aislados | 932 |
| cap10-tabla5A_conductores_compactos.csv | Capítulo 10, Tabla 5A | Dimensiones de conductores compactos | 935 |
| cap10-tabla8_propiedades_conductores.csv | Capítulo 10, Tabla 8 | Propiedades de conductores y resistencia en c.c. a 75 °C | 936 |
| cap10-tabla9_R_X_Z_ca_600V.csv | Capítulo 10, Tabla 9 | R, XL y Z eficaz en c.a., 600 V, 3 fases, 60 Hz, 75 °C (Ω/km) | 938 |

## Erratas del DOF corregidas

- Tabla 430-250, motor de 10 hp a 575 V: el DOF imprime 44 A; se usa 11 A, consistente con la progresión de la tabla.
- Tablas 310-15(b)(2)(a) y (b): el renglón "91-75 °C" es en realidad "71-75 °C".
- Capítulo 10, Tabla 5: la columna de mm² trae valores equivocados para 8 y 6 AWG (6.63 y 8.37); se usa el área que corresponde al calibre AWG (8.37 y 13.3 mm²). Dos áreas impresas que no cuadran con su diámetro (TW 10 AWG y RFH-1 18 AWG) se recalcularon con el diámetro.
- Capítulo 10, Tabla 4: el DOF rotula "Tubo conduit no metálico (EMT)"; EMT es tubo metálico ligero (Art. 358). La última sección "PVC Cédula 80" de la pág. 932 corresponde a PVC Tipo EB.

## Verificaciones hechas

- Ampacidades: crecen con el calibre y con la temperatura del aislamiento; aluminio menor que cobre.
- Tabla 4: área = π·d²/4 y columnas 60/53/31/40 % consistentes con el área total.
- Tabla 9: Z eficaz = R·0.85 + XL·sen(acos 0.85) dentro de ±8 % (redondeos del DOF).
- Tabla 8: resistencia consistente con el área del conductor.
- Tabla 430-250: corriente a 460 V ≈ mitad de 230 V; 575 V ≈ 0.8 × 460 V.

## Alcance

La NOM-001-SEDE-2012 se basa en una edición anterior de la NEC. Los valores de ampacidad y de tubería son prácticamente iguales a los de la NEC actual, pero la numeración cambió (p. ej. 310-15(b)(16) → NEC 310.16) y algunos factores pueden diferir. Para declarar cumplimiento con NEC 2026 hay que verificar contra el texto oficial de NFPA.