/**
 * Parámetros de diseño del sistema (idénticos a simulacion-python/sistema.py).
 * No cambiarlos sin avisar: de ellos dependen todos los resultados.
 */

/** Frecuencia de muestreo de la voz (Hz). */
export const FS = 8000;
/** Bits por muestra del PCM de diseño. */
export const N_BITS = 8;
/** Número de canales de voz multiplexados. */
export const N_CANALES = 4;
/** Palabra de alineación de trama (ranura 0): 10011011. */
export const SYNC: Readonly<Uint8Array> = Uint8Array.from([1, 0, 0, 1, 1, 0, 1, 1]);
/** Bits por trama TDM: 8 + 4·8 = 40. */
export const BITS_TRAMA = SYNC.length + N_CANALES * N_BITS;
/** Tasa binaria del enlace: Rb = 40 bits · 8000 tramas/s = 320 kbps. */
export const RB = BITS_TRAMA * FS;
/** Factor de roll-off del coseno alzado. */
export const ALFA = 0.35;
/** Ancho de banda disponible en el canal (Hz). */
export const B_MAX = 250e3;
/** BER máxima aceptable. */
export const BER_MAX = 1e-6;
/** Muestras por símbolo en banda base compleja. */
export const SPS = 8;
/** Duración del filtro RRC (símbolos). */
export const SPAN = 8;
/** Segundos de voz por canal. */
export const DUR = 2.0;
/** Semilla por defecto de los generadores aleatorios. */
export const SEMILLA = 2026;
/** Frecuencia de la simulación "analógica" de la voz: 8·fs = 64 kHz. */
export const FA = 8 * FS;
/** Frecuencia de muestreo de la simulación paso banda (Hz). */
export const FS_PASO_BANDA = 5.12e6;
/** Frecuencia de la portadora (Hz). */
export const FC = 1.0e6;
