/**
 * Conversión A/D: señal "analógica" de banda limitada, antialiasing, muestreo,
 * cuantificación uniforme de media contrahuella (PCM) y SQNR.
 */
import { filtrar, firPasabajos, remuestrearFft } from "./math";
import { FA, FS } from "./params";

/** Resultado de la cuantificación: códigos enteros y valores reconstruidos. */
export interface Cuantizado {
  codigos: Int32Array;
  valores: Float64Array;
}

/**
 * Cuantificador uniforme de media contrahuella en [−1, 1):
 * L = 2ᴺ, Δ = 2/L, c = clip(⌊x/Δ⌋ + L/2, 0, L−1), x_q = (c − L/2 + ½)·Δ.
 */
export function cuantificar(x: Float64Array, nBits: number): Cuantizado {
  const niveles = 1 << nBits;
  const delta = 2 / niveles;
  const mitad = niveles >> 1;
  const codigos = new Int32Array(x.length);
  const valores = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let c = Math.floor(x[i] / delta) + mitad;
    if (c < 0) c = 0;
    else if (c > niveles - 1) c = niveles - 1;
    codigos[i] = c;
    valores[i] = (c - mitad + 0.5) * delta;
  }
  return { codigos, valores };
}

/** Decodificación PCM: x_q = (c − L/2 + ½)·(2/L), con L = 2ᴺ. */
export function decodificar(codigos: Int32Array, nBits: number): Float64Array {
  const niveles = 1 << nBits;
  const delta = 2 / niveles;
  const mitad = niveles >> 1;
  const y = new Float64Array(codigos.length);
  for (let i = 0; i < codigos.length; i++) y[i] = (codigos[i] - mitad + 0.5) * delta;
  return y;
}

/** SQNR = 10·log10(Σx² / Σ(x − x_q)²) en dB (largo común = el menor de los dos). */
export function sqnrDb(x: Float64Array, xq: Float64Array): number {
  const n = Math.min(x.length, xq.length);
  let s = 0;
  let e = 0;
  for (let i = 0; i < n; i++) {
    s += x[i] * x[i];
    const d = x[i] - xq[i];
    e += d * d;
  }
  return 10 * Math.log10(s / e);
}

/** SQNR teórica de un seno a plena escala: 6,02·N + 1,76 dB. */
export function sqnrTeoricaDb(nBits: number): number {
  return 6.02 * nBits + 1.76;
}

/** Códigos → bits, MSB primero: b[i·N + j] = (c[i] >> (N−1−j)) & 1. */
export function codigosABits(codigos: Int32Array, nBits: number): Uint8Array {
  const b = new Uint8Array(codigos.length * nBits);
  for (let i = 0; i < codigos.length; i++) {
    const c = codigos[i];
    const base = i * nBits;
    for (let j = 0; j < nBits; j++) b[base + j] = (c >> (nBits - 1 - j)) & 1;
  }
  return b;
}

/** Bits → códigos, MSB primero: c = Σ b[j]·2^(N−1−j). */
export function bitsACodigos(bits: Uint8Array, nBits: number): Int32Array {
  const n = Math.floor(bits.length / nBits);
  const c = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    const base = i * nBits;
    for (let j = 0; j < nBits; j++) v = (v << 1) | bits[base + j];
    c[i] = v;
  }
  return c;
}

/** Señal de banda limitada a fa = 8·fs (representa la señal continua): interpolación por FFT ×8. */
export function aAnalogica(v: Float64Array): Float64Array {
  return remuestrearFft(v, FA / FS);
}

let filtroAntialiasing: Float64Array | null = null;

/** FIR antialiasing de 511 coeficientes, fc = 3,4 kHz a fa = 64 kHz (precalculado). */
export function filtroAntialias(): Float64Array {
  if (!filtroAntialiasing) filtroAntialiasing = firPasabajos(3400, FA, 511);
  return filtroAntialiasing;
}

/**
 * Conversión A/D completa de un canal: x[n] = (h_AA ∗ x_a)(n·fa/fs), es decir,
 * señal analógica → filtro antialiasing de 3,4 kHz → muestreo a 8 kHz.
 */
export function conversionAD(v: Float64Array): Float64Array {
  return filtrar(aAnalogica(v), filtroAntialias(), FA / FS);
}
