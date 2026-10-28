/**
 * Funciones de conveniencia del Tema 3 para la interfaz: espectro paso banda (Welch),
 * espectro en banda base equivalente con ruido, forma de onda paso banda y constelación recibida.
 */
import { sumarAwgnEn } from "./channel";
import { type Complejo, type Espectro, welch } from "./math";
import {
  anchoBanda,
  aPasoBanda,
  bitsPorSimbolo,
  constelacionIdeal,
  demodularBb,
  modularBb,
  rrc,
  tasaSimbolos,
  type Modulacion,
} from "./modulation";
import { ALFA, FC, FS_PASO_BANDA, SEMILLA, SPAN, SPS } from "./params";
import { Rng } from "./random";

/** Espectro con su versión en dB normalizada al máximo y el ancho de banda teórico. */
export interface EspectroModulado extends Espectro {
  /** 10·log10(psd / máx(psd) + 10⁻¹²) en dB. */
  psdDbNorm: Float64Array;
  /** B = (1 + α)·Rs en Hz. */
  anchoBandaHz: number;
}

function normalizarDb(psd: Float64Array, referencia?: number): Float64Array {
  let m = referencia ?? 0;
  if (referencia === undefined) for (let i = 0; i < psd.length; i++) m = Math.max(m, psd[i]);
  const y = new Float64Array(psd.length);
  for (let i = 0; i < psd.length; i++) y[i] = 10 * Math.log10(psd[i] / m + 1e-12);
  return y;
}

/** Opciones de la simulación paso banda. */
export interface OpcionesPasoBanda {
  /** Bits a transmitir (por defecto 40 000 aleatorios con la semilla). */
  bits?: Uint8Array;
  semilla?: number;
  /** Frecuencia de muestreo de la simulación (por defecto 5,12 MHz). */
  fs?: number;
  /** Portadora (por defecto 1 MHz). */
  fc?: number;
  /** Largo de segmento de Welch (por defecto 4096). */
  nperseg?: number;
}

/**
 * Señal paso banda real s(t) = √2·Re{x(t)·e^(j2πfc·t)} con pulso RRC a sps = round(fs/Rs)
 * muestras por símbolo (como la figura de espectros de la referencia).
 */
export function senalPasoBanda(mod: Modulacion, opciones: OpcionesPasoBanda = {}): Float64Array {
  const fs = opciones.fs ?? FS_PASO_BANDA;
  const k = bitsPorSimbolo(mod);
  const bits = opciones.bits ?? new Rng(opciones.semilla ?? SEMILLA).bits(40000);
  const spsV = Math.round(fs / tasaSimbolos(mod));
  const nSim = Math.floor(bits.length / k);
  const { senal } = modularBb(bits.subarray(0, nSim * k), mod, rrc(ALFA, spsV, SPAN), spsV);
  return aPasoBanda(senal, fs, opciones.fc ?? FC);
}

/**
 * Espectro (Welch, Hann, 50 %) de la señal paso banda; psd unilateral en V²/Hz y
 * versión normalizada en dB. Incluye B = (1 + α)·Rs para dibujar la máscara de 250 kHz.
 */
export function espectroPasoBanda(mod: Modulacion, opciones: OpcionesPasoBanda = {}): EspectroModulado {
  const fs = opciones.fs ?? FS_PASO_BANDA;
  const { f, psd } = welch(senalPasoBanda(mod, opciones), fs, opciones.nperseg ?? 4096);
  return { f, psd, psdDbNorm: normalizarDb(psd), anchoBandaHz: anchoBanda(mod) };
}

/**
 * Espectro bilateral en banda base equivalente (fs = Rs·sps) de la señal con AWGN de Eb/N0 dado
 * (null = sin ruido); psdDbNorm se normaliza al máximo de la señal sin ruido.
 */
export function espectroBandaBase(
  mod: Modulacion,
  ebN0Db: number | null,
  nSimbolos = 20000,
  semilla: number = SEMILLA,
  nperseg = 2048,
): EspectroModulado {
  const rng = new Rng(semilla);
  const k = bitsPorSimbolo(mod);
  const fsb = tasaSimbolos(mod) * SPS;
  const { senal } = modularBb(rng.bits(nSimbolos * k), mod, rrc());
  const limpio = welch(senal.re, fsb, nperseg, senal.im);
  let ref = 0;
  for (let i = 0; i < limpio.psd.length; i++) ref = Math.max(ref, limpio.psd[i]);
  let final = limpio;
  if (ebN0Db !== null) {
    const rx = sumarAwgnEn(senal, ebN0Db, k, rng);
    final = welch(rx.re, fsb, nperseg, rx.im);
  }
  return { f: final.f, psd: final.psd, psdDbNorm: normalizarDb(final.psd, ref), anchoBandaHz: anchoBanda(mod) };
}

/** Forma de onda paso banda para graficar: tiempo (s), señal y componentes I/Q en banda base. */
export interface FormaOnda {
  t: Float64Array;
  s: Float64Array;
  i: Float64Array;
  q: Float64Array;
  bits: Uint8Array;
}

/**
 * Forma de onda paso banda de unos pocos símbolos, s(t) = √2·[I(t)·cos(2πfc·t) − Q(t)·sin(2πfc·t)],
 * recortando el transitorio del filtro (span/2 símbolos al inicio). Con ebN0Db se suma AWGN en banda base.
 */
export function formaOndaPasoBanda(
  mod: Modulacion,
  nSimbolos = 12,
  opciones: { fs?: number; fc?: number; semilla?: number; ebN0Db?: number | null } = {},
): FormaOnda {
  const fs = opciones.fs ?? FS_PASO_BANDA;
  const fc = opciones.fc ?? FC;
  const k = bitsPorSimbolo(mod);
  const rng = new Rng(opciones.semilla ?? SEMILLA);
  const spsV = Math.round(fs / tasaSimbolos(mod));
  const bits = rng.bits((nSimbolos + SPAN) * k);
  const { senal } = modularBb(bits, mod, rrc(ALFA, spsV, SPAN), spsV);
  // Con h de energía unitaria, N0 por muestra da el mismo Eb/N0 a la salida del filtro acoplado
  if (opciones.ebN0Db !== undefined && opciones.ebN0Db !== null) sumarAwgnEn(senal, opciones.ebN0Db, k, rng);
  const primerSimbolo = SPAN / 2; // símbolos con contexto completo de ISI a ambos lados
  const ini = (primerSimbolo + SPAN / 2) * spsV - Math.floor(spsV / 2);
  const n = nSimbolos * spsV;
  const re = senal.re.slice(ini, ini + n);
  const im = senal.im.slice(ini, ini + n);
  const s = aPasoBanda({ re, im }, fs, fc);
  const t = new Float64Array(n);
  for (let m = 0; m < n; m++) t[m] = m / fs;
  return { t, s, i: re, q: im, bits: bits.slice(primerSimbolo * k, (primerSimbolo + nSimbolos) * k) };
}

/** Constelación recibida: puntos ideales, muestras del filtro acoplado y BER medida en esas muestras. */
export interface ConstelacionRecibida {
  ideal: Complejo;
  recibida: Complejo;
  ber: number;
  errores: number;
  bits: number;
}

/**
 * Constelación a la salida del filtro acoplado con la forma de onda completa
 * (RRC TX y RX, sps = 8, AWGN con N0 = 1/(k·Eb/N0)).
 */
export function constelacionRecibida(
  mod: Modulacion,
  ebN0Db: number | null,
  nSimbolos = 3000,
  semilla: number = SEMILLA,
): ConstelacionRecibida {
  const rng = new Rng(semilla);
  const k = bitsPorSimbolo(mod);
  const bits = rng.bits(nSimbolos * k);
  const { senal } = modularBb(bits, mod, rrc());
  const rx = ebN0Db === null ? senal : sumarAwgnEn(senal, ebN0Db, k, rng);
  const dem = demodularBb(rx, mod, nSimbolos, rrc());
  let errores = 0;
  for (let i = 0; i < bits.length; i++) if (dem.bits[i] !== bits[i]) errores++;
  return { ideal: constelacionIdeal(mod), recibida: dem.muestras, ber: errores / bits.length, errores, bits: bits.length };
}
