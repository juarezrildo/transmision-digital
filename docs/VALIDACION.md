# Validación del simulador web contra la referencia en Python

Fecha: 28/10/2026 · Fase 3 de `PLAN.md` · build de producción de `web/` (`next start`), Chromium sin interfaz, ventana de 1280 px.

## 1. Comprobaciones automáticas (`web/`)

| Comando | Resultado |
|---|---|
| `npm run lint` | sin avisos ni errores |
| `npm run typecheck` | sin errores |
| `npm test` | 16 archivos, 117 pruebas, todas en verde |
| `npm run build` | compila; 6 rutas estáticas (`/`, `/paso-banda`, `/ber`, `/cadena`, `/acerca`, `/_not-found`) |

Durante la navegación no hubo errores de página ni de consola.

## 2. Capturas (`docs/capturas/`)

`inicio.png`, `paso-banda-qpsk-8db.png`, `paso-banda-16qam-8db.png`, `ber.png`, `cadena-8db.png`. Son de página completa, a 1280 px de ancho, y se tomaron cuando ya no quedaba ningún indicador «Calculando…» activo. En las páginas con controles se usa QPSK y Eb/N0 = 8 dB, salvo la captura de 16-QAM.

## 3. Fuente de voz

Con `voz_prototipo.wav` (9,9 s), tanto `sistema.py` como el motor web eligen ventanas de 2 s que no se solapan. El archivo solo da para **3 canales con voz**; la cuarta ranura TDM viaja con el código 0 en cada trama. La web lo dice en `/cadena` («3 canales con voz + 1 ranura vacía»). La trama sigue teniendo 40 bits, así que 16 000 tramas dan 640 000 bits. La SNR de voz es el promedio de los 3 canales con voz, igual que en la referencia.

## 4. Tabla de comparación

Origen de los valores web: **UI** = cifra leída en la página; **motor** = la SQNR no aparece en la interfaz y se calculó con `web/src/lib/dsp` usando la misma señal que la referencia (seno de 1013 Hz con amplitud 0,999, 2 s) y la voz del prototipo.
Las filas marcadas con **(est.)** son Monte Carlo o cadena con ruido. Son estadísticas: la web y Python usan generadores distintos y no tienen por qué coincidir en el valor exacto. Su tolerancia es la de `PLAN.md` (±20 % respecto de la teoría). Como referencia también se indica la diferencia frente a Python.

### 4.1 Eb/N0 requerido para BER = 10⁻⁶ (tolerancia ±0,05 dB)

| Magnitud | Python | Web (UI) | Diferencia | ¿En tolerancia? |
|---|---|---|---|---|
| Eb/N0 req. BPSK | 10,5298 dB | 10,53 dB | < 0,005 dB (redondeo) | Sí |
| Eb/N0 req. QPSK | 10,5298 dB | 10,53 dB | < 0,005 dB | Sí |
| Eb/N0 req. 16-QAM | 14,4017 dB | 14,40 dB | < 0,005 dB | Sí |
| C/N req. BPSK / QPSK / 16-QAM | 9,226 / 12,237 / 19,119 dB | 9,23 / 12,24 / 19,12 dB | < 0,005 dB | Sí |

### 4.2 Ancho de banda (1 + α)·Rs (tolerancia: exacto)

| Magnitud | Python | Web (UI) | Diferencia | ¿En tolerancia? |
|---|---|---|---|---|
| B BPSK | 432 kHz | 432 kHz | 0 | Sí |
| B QPSK | 216 kHz | 216 kHz | 0 | Sí |
| B 16-QAM | 108 kHz | 108 kHz | 0 | Sí |
| Tasa TDM | 320 kbps | 320 kbps | 0 | Sí |
| Recomendación | QPSK | QPSK | — | Sí |

### 4.3 SQNR (tolerancia: |seno − (6,02·N + 1,76)| < 0,5 dB; voz frente a Python < 0,05 dB)

| Magnitud | Python | Web (motor) | Diferencia | ¿En tolerancia? |
|---|---|---|---|---|
| SQNR seno N = 6 (teórico 37,88) | 37,7017 dB | 37,7017 dB | < 10⁻⁹ dB (−0,18 respecto de la teoría) | Sí |
| SQNR seno N = 8 (teórico 49,92) | 49,9513 dB | 49,9513 dB | < 10⁻⁹ dB (+0,03 respecto de la teoría) | Sí |
| SQNR seno N = 10 (teórico 61,96) | 62,0229 dB | 62,0229 dB | < 10⁻⁹ dB (+0,06 respecto de la teoría) | Sí |
| SQNR voz N = 6 | 29,7493 dB | 29,7493 dB | < 10⁻⁹ dB | Sí |
| SQNR voz N = 8 | 41,8142 dB | 41,8142 dB | < 10⁻⁹ dB | Sí |
| SQNR voz N = 10 | 53,8759 dB | 53,8759 dB | < 10⁻⁹ dB | Sí |

### 4.4 BER Monte Carlo en 4, 6 y 8 dB (est.; tolerancia ±20 % respecto de la teoría)

Los valores web son los de la tabla «Monte Carlo frente a teoría» de `/ber` (10⁶ bits por punto como máximo, con parada a los 200 errores). La interfaz los muestra con 2 o 3 cifras significativas.

| Magnitud | Teoría | Python | Web (UI) | Web − teoría | Web − Python | ¿En tolerancia? |
|---|---|---|---|---|---|---|
| BPSK 4 dB | 1,25·10⁻² | 1,210·10⁻² | 1,2·10⁻² | −4 % | −1 % | Sí |
| BPSK 6 dB | 2,39·10⁻³ | 2,423·10⁻³ | 2,5·10⁻³ | +5 % | +3 % | Sí |
| BPSK 8 dB | 1,91·10⁻⁴ | 1,975·10⁻⁴ | 1,7·10⁻⁴ | −11 % | −14 % | Sí |
| QPSK 4 dB | 1,25·10⁻² | 1,240·10⁻² | 1,3·10⁻² | +4 % | +5 % | Sí |
| QPSK 6 dB | 2,39·10⁻³ | 2,431·10⁻³ | 2,4·10⁻³ | 0 % | −1 % | Sí |
| QPSK 8 dB | 1,91·10⁻⁴ | 1,969·10⁻⁴ | 1,8·10⁻⁴ | −6 % | −9 % | Sí |
| 16-QAM 4 dB | 5,86·10⁻² | 5,855·10⁻² | 5,87·10⁻² | +0,2 % | +0,3 % | Sí |
| 16-QAM 6 dB | 2,79·10⁻² | 2,787·10⁻² | 2,73·10⁻² | −2 % | −2 % | Sí |
| 16-QAM 8 dB | 9,2·10⁻³ | 9,313·10⁻³ | 8,4·10⁻³ | −9 % | −10 % | Sí |
| `/paso-banda` QPSK 8 dB (194 err. / 10⁶ bits) | 1,91·10⁻⁴ | 1,969·10⁻⁴ | 1,94·10⁻⁴ | +2 % | −1 % | Sí |
| `/paso-banda` 16-QAM 8 dB (1287 err. / 131 072 bits) | 9,2·10⁻³ | 9,313·10⁻³ | 9,82·10⁻³ | +6 % | +5 % | Sí |

### 4.5 Cadena completa (`/cadena`, 640 000 bits)

| Magnitud | Python | Web (UI) | Diferencia | Tolerancia | ¿En tolerancia? |
|---|---|---|---|---|---|
| BER sin ruido BPSK | 0 (0 errores) | 0 (0 errores, códigos PCM «Idénticos») | 0 | bit a bit idéntico | Sí |
| BER sin ruido QPSK | 0 | 0 («Idénticos») | 0 | bit a bit idéntico | Sí |
| BER sin ruido 16-QAM | 0 | 0 («Idénticos») | 0 | bit a bit idéntico | Sí |
| Desplazamiento de trama sin ruido | 0 bits | 0 bits (SYNC 100 %) | 0 | exacto | Sí |
| SNR de voz sin ruido (3 canales) | 41,81 dB | 41,8 dB | < 0,05 dB | = SQNR voz N = 8 | Sí |
| Errores en el cable Manchester | 0 | 0 | 0 | exacto | Sí |
| BER QPSK 8 dB (est.) | 1,734·10⁻⁴ (111 err.) | 1,83·10⁻⁴ (117 err.) | +5 % (−4 % respecto de la teoría) | ±20 % respecto de la teoría | Sí |
| SNR de voz QPSK 8 dB (est.) | 24,87 dB | 24,5 dB | −0,4 dB | depende de qué bits fallen; solo informativo | — |
| Desplazamiento de trama QPSK 8 dB | 0 bits | 0 bits | 0 | exacto | Sí |

## 5. Revisión de la interfaz

- Coma decimal y punto de miles (`es-BO`) en todas las cifras visibles. Las potencias de diez se escriben como 1,9·10⁻⁴.
- Todas las gráficas tienen título, ejes con unidades (dB, kHz, µs, s, «Componente en fase I (Es = 1)») y una línea «Qué muestra esta gráfica».
- Contraste: el texto secundario `#4a5361` sobre `#f6f5f1` da unos 7,5:1 y el texto principal `#1b2330`, más de 14:1. Cumple WCAG AA.
- Ortografía: no se encontraron errores.

## 6. Observaciones (no bloquean)

1. En `/ber`, los puntos Monte Carlo de QPSK en 11 y 12 dB y de 16-QAM en 14 dB caen sobre 10⁻⁶: son 1 error en 10⁶ bits, el piso de resolución de N = 10⁶. En 12 dB la teoría da unos 9·10⁻⁹, así que ese único error es poco probable pero posible. No está entre los puntos con tolerancia.
2. El Monte Carlo de `/ber` se detiene a los 200 errores, de modo que varios puntos usan menos de 10⁶ bits (por ejemplo, 16-QAM 8 dB con 65 536 bits). Las pruebas del motor sí usan ≥ 10⁶ bits.
3. La notación de Eb/N0 no es uniforme: el título del eje y de la gráfica en `/ber`, y el aviso «Faltan … dB de Eb/N0» en `/paso-banda`, usan «Eb/N0» en texto plano, mientras que el resto de la interfaz lo escribe con subíndices. Es solo estético.

## Veredicto

**APTO**: ninguna fila queda fuera de tolerancia.
