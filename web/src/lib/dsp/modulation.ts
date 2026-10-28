/**
 * Modulación digital del tramo de radio: mapeo Gray BPSK / QPSK / 16-QAM (Es = 1),
 * pulso de raíz de coseno alzado (RRC), modulación y demodulación en banda base compleja
 * y conversión a paso banda con portadora fc.
 */
import type { Complejo } from "./math";
import { ALFA, RB, SPAN, SPS } from "./params";

/** Modulaciones del sistema. */
export type Modulacion = "BPSK" | "QPSK" | "16-QAM";

/** Lista ordenada de modulaciones. */
export const MODULACIONES: readonly Modulacion[] = ["BPSK", "QPSK", "16-QAM"];

/** Bits por símbolo k = log2(M): BPSK 1, QPSK 2, 16-QAM 4. */
export function bitsPorSimbolo(mod: Modulacion): number {
  return mod === "BPSK" ? 1 : mod === "QPSK" ? 2 : 4;
}

/** Tasa de símbolos Rs = Rb / k (baudios). */
export function tasaSimbolos(mod: Modulacion, rb: number = RB): number {
  return rb / bitsPorSimbolo(mod);
}

/** Ancho de banda ocupado con coseno alzado: B = (1 + α)·Rs (Hz). */
export function anchoBanda(mod: Modulacion, rb: number = RB, alfa: number = ALFA): number {
  return (1 + alfa) * tasaSimbolos(mod, rb);
}

const INV_SQRT2 = 1 / Math.SQRT2;
const SQRT10 = Math.sqrt(10);
const INV_SQRT10 = 1 / SQRT10;
/** Nivel 16-QAM por eje según 2 bits Gray (índice 2·b₀ + b₁): 00→−3, 01→−1, 11→+1, 10→+3. */
const NIVEL_GRAY_4 = Float64Array.from([-3, -1, 3, 1]);
/** Bits Gray (b₀, b₁) para el índice de nivel 0..3 (−3, −1, +1, +3). */
const BIT0_NIVEL = Uint8Array.from([0, 0, 1, 1]);
const BIT1_NIVEL = Uint8Array.from([0, 1, 1, 0]);

/**
 * Mapeo Gray con Es = 1: BPSK s = 2b − 1; QPSK s = [(2b₀−1) + j(2b₁−1)]/√2;
 * 16-QAM s = (I + jQ)/√10 con I, Q ∈ {−3, −1, 1, 3} (Gray 00, 01, 11, 10).
 */
export function mapear(bits: Uint8Array, mod: Modulacion): Complejo {
  const n = Math.floor(bits.length / bitsPorSimbolo(mod));
  return mapearEn(bits, mod, { re: new Float64Array(n), im: new Float64Array(n) });
}

/** Mapeo Gray (ver `mapear`) escribiendo en vectores ya reservados de largo ⌊len(bits)/k⌋. */
export function mapearEn(bits: Uint8Array, mod: Modulacion, salida: Complejo): Complejo {
  const n = Math.floor(bits.length / bitsPorSimbolo(mod));
  const { re, im } = salida;
  if (mod === "BPSK") {
    for (let i = 0; i < n; i++) {
      re[i] = 2 * bits[i] - 1;
      im[i] = 0;
    }
  } else if (mod === "QPSK") {
    for (let i = 0; i < n; i++) {
      re[i] = (2 * bits[2 * i] - 1) * INV_SQRT2;
      im[i] = (2 * bits[2 * i + 1] - 1) * INV_SQRT2;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const b = 4 * i;
      re[i] = NIVEL_GRAY_4[2 * bits[b] + bits[b + 1]] * INV_SQRT10;
      im[i] = NIVEL_GRAY_4[2 * bits[b + 2] + bits[b + 3]] * INV_SQRT10;
    }
  }
  return salida;
}

/** Índice del nivel 16-QAM más cercano por eje: clip(round((v·√10 + 3)/2), 0, 3). */
function indiceNivel16(v: number): number {
  const idx = Math.round((v * SQRT10 + 3) / 2);
  return idx < 0 ? 0 : idx > 3 ? 3 : idx;
}

/**
 * Demapeo por decisión de mínima distancia (escribe en `salida`, de largo n·k):
 * BPSK b = [Re r > 0]; QPSK (b₀, b₁) = ([Re r > 0], [Im r > 0]); 16-QAM por eje con Gray.
 */
export function demapearEn(re: Float64Array, im: Float64Array, mod: Modulacion, salida: Uint8Array): Uint8Array {
  const n = re.length;
  if (mod === "BPSK") {
    for (let i = 0; i < n; i++) salida[i] = re[i] > 0 ? 1 : 0;
  } else if (mod === "QPSK") {
    for (let i = 0; i < n; i++) {
      salida[2 * i] = re[i] > 0 ? 1 : 0;
      salida[2 * i + 1] = im[i] > 0 ? 1 : 0;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const a = indiceNivel16(re[i]);
      const q = indiceNivel16(im[i]);
      const b = 4 * i;
      salida[b] = BIT0_NIVEL[a];
      salida[b + 1] = BIT1_NIVEL[a];
      salida[b + 2] = BIT0_NIVEL[q];
      salida[b + 3] = BIT1_NIVEL[q];
    }
  }
  return salida;
}

/** Demapeo Gray de símbolos recibidos a bits (ver `demapearEn`). */
export function demapear(re: Float64Array, im: Float64Array, mod: Modulacion): Uint8Array {
  return demapearEn(re, im, mod, new Uint8Array(re.length * bitsPorSimbolo(mod)));
}

/** Constelación ideal (M puntos, Es = 1) en el orden de los índices binarios 0..M−1. */
export function constelacionIdeal(mod: Modulacion): Complejo {
  const k = bitsPorSimbolo(mod);
  const m = 1 << k;
  const bits = new Uint8Array(m * k);
  for (let s = 0; s < m; s++) for (let j = 0; j < k; j++) bits[s * k + j] = (s >> (k - 1 - j)) & 1;
  return mapear(bits, mod);
}

const cacheRrc = new Map<string, Float64Array>();

/**
 * Pulso de raíz de coseno alzado con energía unitaria (Σh² = 1), t = (n − span·sps/2)/sps:
 * h(t) = [sin(πt(1−α)) + 4αt·cos(πt(1+α))] / [πt(1 − (4αt)²)], con los casos t = 0 y |t| = 1/(4α).
 * Los filtros se precalculan y se reutilizan (no modificar el vector devuelto).
 */
export function rrc(alfa: number = ALFA, sps: number = SPS, span: number = SPAN): Float64Array {
  const clave = `${alfa}|${sps}|${span}`;
  const enCache = cacheRrc.get(clave);
  if (enCache) return enCache;
  const n = span * sps + 1;
  const h = new Float64Array(n);
  let energia = 0;
  for (let i = 0; i < n; i++) {
    const t = (i - (span * sps) / 2) / sps;
    let v: number;
    if (Math.abs(t) < 1e-12) v = 1 - alfa + (4 * alfa) / Math.PI;
    else if (Math.abs(Math.abs(4 * alfa * t) - 1) < 1e-9)
      v =
        (alfa / Math.SQRT2) *
        ((1 + 2 / Math.PI) * Math.sin(Math.PI / (4 * alfa)) + (1 - 2 / Math.PI) * Math.cos(Math.PI / (4 * alfa)));
    else
      v =
        (Math.sin(Math.PI * t * (1 - alfa)) + 4 * alfa * t * Math.cos(Math.PI * t * (1 + alfa))) /
        (Math.PI * t * (1 - (4 * alfa * t) ** 2));
    h[i] = v;
    energia += v * v;
  }
  const esc = 1 / Math.sqrt(energia);
  for (let i = 0; i < n; i++) h[i] *= esc;
  cacheRrc.set(clave, h);
  return h;
}

/**
 * Conformación de pulso: x[n] = Σᵢ sᵢ·h[n − i·sps] (convolución completa del tren de símbolos
 * sobremuestreado con el RRC; largo nSim·sps + L − 1).
 */
export function conformarPulso(simbolos: Complejo, h: Float64Array, sps: number = SPS): Complejo {
  const nSim = simbolos.re.length;
  const largo = nSim * sps + h.length - 1;
  const re = new Float64Array(largo);
  const im = new Float64Array(largo);
  const nh = h.length;
  for (let i = 0; i < nSim; i++) {
    const sr = simbolos.re[i];
    const si = simbolos.im[i];
    const base = i * sps;
    if (si === 0) {
      for (let k = 0; k < nh; k++) re[base + k] += sr * h[k];
    } else {
      for (let k = 0; k < nh; k++) {
        re[base + k] += sr * h[k];
        im[base + k] += si * h[k];
      }
    }
  }
  return { re, im };
}

/** Señal modulada en banda base y símbolos transmitidos. */
export interface SenalModulada {
  senal: Complejo;
  simbolos: Complejo;
}

/** Modulación en banda base compleja: mapeo Gray (Es = 1) y pulso RRC, x(t) = Σ sᵢ·h(t − iTs). */
export function modularBb(
  bits: Uint8Array,
  mod: Modulacion,
  h: Float64Array = rrc(),
  sps: number = SPS,
): SenalModulada {
  const simbolos = mapear(bits, mod);
  return { senal: conformarPulso(simbolos, h, sps), simbolos };
}

/** Salida del demodulador: bits decididos y muestras del filtro acoplado. */
export interface SenalDemodulada {
  bits: Uint8Array;
  muestras: Complejo;
}

/**
 * Filtro acoplado y muestreo: y = r ∗ h, muestras yᵢ = y[d + i·sps] con d = L − 1
 * (retardo total TX + RX); luego decisión Gray.
 */
export function demodularBb(
  r: Complejo,
  mod: Modulacion,
  nSimbolos: number,
  h: Float64Array = rrc(),
  sps: number = SPS,
): SenalDemodulada {
  const nh = h.length;
  const d = nh - 1;
  const re = new Float64Array(nSimbolos);
  const im = new Float64Array(nSimbolos);
  const largo = r.re.length;
  for (let i = 0; i < nSimbolos; i++) {
    const n = d + i * sps;
    const kMin = Math.max(0, n - largo + 1);
    const kMax = Math.min(nh - 1, n);
    let sr = 0;
    let si = 0;
    for (let k = kMin; k <= kMax; k++) {
      sr += h[k] * r.re[n - k];
      si += h[k] * r.im[n - k];
    }
    re[i] = sr;
    im[i] = si;
  }
  return { bits: demapear(re, im, mod), muestras: { re, im } };
}

/** Conversión a paso banda: s(t) = √2·Re{x(t)·e^(j2πfc·t)} = √2·[xI·cos(2πfc·t) − xQ·sin(2πfc·t)]. */
export function aPasoBanda(x: Complejo, fs: number, fc: number): Float64Array {
  const n = x.re.length;
  const s = new Float64Array(n);
  const w = (2 * Math.PI * fc) / fs;
  for (let i = 0; i < n; i++) s[i] = Math.SQRT2 * (x.re[i] * Math.cos(w * i) - x.im[i] * Math.sin(w * i));
  return s;
}
