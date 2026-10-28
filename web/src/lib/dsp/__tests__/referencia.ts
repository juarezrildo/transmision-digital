/** Utilidades de prueba: lectura de la referencia en Python y del WAV del prototipo (solo Node). */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
/** Raíz del repositorio (web/src/lib/dsp/__tests__ → ../../../../..). */
export const RAIZ = resolve(aqui, "../../../../..");

export interface FilaSqnr {
  N: number;
  teorico: number;
  seno: number;
  voz: number;
  Rb_canal: number;
  Rb_total: number;
}
export interface FilaModRef {
  mod: "BPSK" | "QPSK" | "16-QAM";
  k: number;
  Rs_kbaud: number;
  B_kHz: number;
  cumple_B: boolean;
  EbN0_req_dB: number;
  eficiencia: number;
  CN_req_dB: number;
}
export interface FilaCadenaRef {
  mod: "BPSK" | "QPSK" | "16-QAM";
  EbN0_dB: number | "sin ruido";
  BER: number;
  errores: number;
  bits: number;
  desplazamiento_trama: number;
  SNR_salida_dB: number;
}
export interface ResultadosPython {
  sqnr: FilaSqnr[];
  tdm: { bits_trama: number; Rb_kbps: number; bits_totales: number };
  codigos_linea: { codigo: string; B90_kHz: number; DC: number; errores_sin_ruido: number }[];
  modulaciones: FilaModRef[];
  ber_curvas: Record<string, (number | null)[]>;
  tramo_cable: { codigo: string; errores: number; bits: number };
  cadena: FilaCadenaRef[];
}

/** Lee docs/resultados_python.json. */
export function leerReferencia(): ResultadosPython {
  return JSON.parse(readFileSync(resolve(RAIZ, "docs/resultados_python.json"), "utf-8")) as ResultadosPython;
}

/** Lee web/public/voz_prototipo.wav como ArrayBuffer. */
export function leerVozPrototipo(): ArrayBuffer {
  const b = readFileSync(resolve(RAIZ, "web/public/voz_prototipo.wav"));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}
