/**
 * Tasa de error de bit: teoría, Eb/N0 requerido (bisección), Monte Carlo y tabla de diseño.
 */
import { n0DesdeEbN0 } from "./channel";
import { funcionQ } from "./math";
import { anchoBanda, bitsPorSimbolo, demapearEn, mapearEn, MODULACIONES, tasaSimbolos, type Modulacion } from "./modulation";
import { B_MAX, BER_MAX, RB } from "./params";
import { Rng } from "./random";

/**
 * BER teórica con mapeo Gray en AWGN:
 * BPSK y QPSK Pb = Q(√(2·Eb/N0));
 * 16-QAM Pb ≈ (4/k)·(1 − 1/√M)·Q(√(3k·Eb/N0 / (M − 1))), M = 16, k = 4.
 */
export function berTeorica(mod: Modulacion, ebN0Db: number): number {
  const g = 10 ** (ebN0Db / 10);
  if (mod === "BPSK" || mod === "QPSK") return funcionQ(Math.sqrt(2 * g));
  const m = 16;
  const k = 4;
  return (4 / k) * (1 - 1 / Math.sqrt(m)) * funcionQ(Math.sqrt((3 * k * g) / (m - 1)));
}

/** Curva teórica Pb(Eb/N0) evaluada en cada punto del vector de Eb/N0 (dB). */
export function curvaBerTeorica(mod: Modulacion, ebN0Db: Float64Array): Float64Array {
  const y = new Float64Array(ebN0Db.length);
  for (let i = 0; i < ebN0Db.length; i++) y[i] = berTeorica(mod, ebN0Db[i]);
  return y;
}

/**
 * Eb/N0 requerido (dB) para Pb = objetivo, por bisección en [0, 30] dB con 60 iteraciones
 * (Pb es decreciente en Eb/N0); devuelve el extremo superior del intervalo final.
 */
export function ebN0Requerido(mod: Modulacion, objetivo: number = BER_MAX): number {
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (berTeorica(mod, m) > objetivo) lo = m;
    else hi = m;
  }
  return hi;
}

/** Opciones del Monte Carlo de BER. */
export interface OpcionesMonteCarlo {
  mod: Modulacion;
  ebN0Db: number;
  /** Número máximo de bits simulados (por defecto 10⁶). */
  nBits?: number;
  /** Semilla del generador (por defecto 2026). */
  semilla?: number;
  /** Detener al alcanzar este número de errores (por defecto sin límite). */
  minErrores?: number;
  /** Bits por bloque de simulación (por defecto 65 536). */
  bloque?: number;
}

/** Resultado de un Monte Carlo de BER. */
export interface ResultadoBer {
  ber: number;
  errores: number;
  bits: number;
}

/**
 * BER por Monte Carlo a nivel de símbolo (como las curvas de la referencia):
 * r = s + √(N0/2)·(n₁ + j·n₂), N0 = 1/(k·Eb/N0), BER = errores / bits.
 */
export function berMonteCarlo(opciones: OpcionesMonteCarlo): ResultadoBer {
  const { mod, ebN0Db } = opciones;
  const nBits = opciones.nBits ?? 1_000_000;
  const minErrores = opciones.minErrores ?? Number.POSITIVE_INFINITY;
  const k = bitsPorSimbolo(mod);
  const bloque = Math.max(k, Math.floor((opciones.bloque ?? 65536) / k) * k);
  const rng = new Rng(opciones.semilla ?? 2026);
  const sigma = Math.sqrt(n0DesdeEbN0(ebN0Db, k) / 2);
  const nSimBloque = bloque / k;
  const simbolos = { re: new Float64Array(nSimBloque), im: new Float64Array(nSimBloque) };
  const decididos = new Uint8Array(bloque);
  const bitsBloque = new Uint8Array(bloque);
  let errores = 0;
  let total = 0;
  while (total < nBits && errores < minErrores) {
    const nb = Math.min(bloque, Math.floor((nBits - total) / k) * k || k);
    const bits = rng.bitsEn(nb === bloque ? bitsBloque : bitsBloque.subarray(0, nb));
    const nSim = nb / k;
    const re = nSim === nSimBloque ? simbolos.re : simbolos.re.subarray(0, nSim);
    const im = nSim === nSimBloque ? simbolos.im : simbolos.im.subarray(0, nSim);
    mapearEn(bits, mod, { re, im });
    for (let i = 0; i < nSim; i++) {
      re[i] += sigma * rng.gaussiana();
      im[i] += sigma * rng.gaussiana();
    }
    demapearEn(re, im, mod, decididos);
    for (let i = 0; i < nb; i++) if (decididos[i] !== bits[i]) errores++;
    total += nb;
  }
  return { ber: total ? errores / total : 0, errores, bits: total };
}

/** Punto de una curva BER: Eb/N0, teoría y simulación (null si no hubo errores). */
export interface PuntoBer {
  ebN0Db: number;
  teorica: number;
  simulada: number | null;
  errores: number;
  bits: number;
}

/** Curva BER vs Eb/N0 por Monte Carlo (cada punto con semilla semilla + i). */
export function curvaBerMonteCarlo(
  mod: Modulacion,
  ebN0Db: readonly number[],
  nBits = 1_000_000,
  semilla = 2026,
  minErrores = Number.POSITIVE_INFINITY,
): PuntoBer[] {
  return ebN0Db.map((e, i) => {
    const r = berMonteCarlo({ mod, ebN0Db: e, nBits, semilla: semilla + i, minErrores });
    return { ebN0Db: e, teorica: berTeorica(mod, e), simulada: r.errores ? r.ber : null, errores: r.errores, bits: r.bits };
  });
}

/** Fila de la tabla de diseño de una modulación (mismos campos que resultados_python.json). */
export interface FilaModulacion {
  mod: Modulacion;
  k: number;
  rsKbaud: number;
  bKHz: number;
  cumpleB: boolean;
  ebN0ReqDb: number;
  /** Eficiencia espectral η = Rb / B (bps/Hz). */
  eficiencia: number;
  cnReqDb: number;
  cumpleBer: boolean;
}

/** Relación portadora a ruido requerida: C/N = Eb/N0 + 10·log10(Rb / B) (dB). */
export function cnRequeridoDb(ebN0Db: number, rb: number, b: number): number {
  return ebN0Db + 10 * Math.log10(rb / b);
}

/**
 * Tabla de diseño: Rs = Rb/k, B = (1 + α)·Rs, ¿B ≤ 250 kHz?, Eb/N0 requerido, η = Rb/B y C/N requerido.
 * `cumpleBer` indica si Eb/N0 disponible (opcional) alcanza el requerido.
 */
export function tablaModulaciones(ebN0Disponible?: number): FilaModulacion[] {
  return MODULACIONES.map((mod) => {
    const b = anchoBanda(mod);
    const req = ebN0Requerido(mod);
    return {
      mod,
      k: bitsPorSimbolo(mod),
      rsKbaud: tasaSimbolos(mod) / 1e3,
      bKHz: b / 1e3,
      cumpleB: b <= B_MAX,
      ebN0ReqDb: req,
      eficiencia: RB / b,
      cnReqDb: cnRequeridoDb(req, RB, b),
      cumpleBer: ebN0Disponible === undefined ? true : ebN0Disponible >= req,
    };
  });
}
