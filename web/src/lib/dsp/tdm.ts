/**
 * Multiplexación TDM: trama [SYNC 8 bits | CH1 | CH2 | CH3 | CH4], 8000 tramas/s.
 */
import { BITS_TRAMA, N_BITS, N_CANALES, SYNC } from "./params";

/** Resultado de la búsqueda de la palabra de sincronía. */
export interface Sincronia {
  /** Desplazamiento (bits) del inicio de trama detectado, 0 ≤ d < 40. */
  desplazamiento: number;
  /** Fracción de bits de SYNC que coinciden en ese desplazamiento (1 = perfecta). */
  calidad: number;
}

/**
 * Multiplexa los códigos PCM de hasta 4 canales: trama t = [SYNC | c₁[t] | c₂[t] | c₃[t] | c₄[t]],
 * cada código en N = 8 bits MSB primero; 40 bits por trama. Las ranuras sin canal quedan en
 * cero (como la referencia en Python cuando recibe menos de 4 canales).
 */
export function multiplexar(codigos: readonly Int32Array[]): Uint8Array {
  if (codigos.length < 1 || codigos.length > N_CANALES)
    throw new Error(`multiplexar: se esperan de 1 a ${N_CANALES} canales`);
  const nTramas = codigos[0].length;
  const bits = new Uint8Array(nTramas * BITS_TRAMA);
  const nSync = SYNC.length;
  for (let t = 0; t < nTramas; t++) {
    const base = t * BITS_TRAMA;
    for (let j = 0; j < nSync; j++) bits[base + j] = SYNC[j];
    for (let k = 0; k < codigos.length; k++) {
      const c = codigos[k][t];
      const off = base + nSync + k * N_BITS;
      for (let j = 0; j < N_BITS; j++) bits[off + j] = (c >> (N_BITS - 1 - j)) & 1;
    }
  }
  return bits;
}

/**
 * Sincronía de trama: elige el desplazamiento d ∈ [0, 40) que maximiza
 * Σₜ Σⱼ [b[d + 40t + j] = SYNC[j]] sobre nt = ⌊len/40⌋ − 1 tramas.
 */
export function sincronizar(bits: Uint8Array): Sincronia {
  const nTramas = Math.floor(bits.length / BITS_TRAMA) - 1;
  if (nTramas <= 0) return { desplazamiento: 0, calidad: 0 };
  const nSync = SYNC.length;
  let mejor = -1;
  let desplazamiento = 0;
  for (let d = 0; d < BITS_TRAMA; d++) {
    let aciertos = 0;
    for (let t = 0; t < nTramas; t++) {
      const base = d + t * BITS_TRAMA;
      for (let j = 0; j < nSync; j++) if (bits[base + j] === SYNC[j]) aciertos++;
    }
    if (aciertos > mejor) {
      mejor = aciertos;
      desplazamiento = d;
    }
  }
  return { desplazamiento, calidad: mejor / (nTramas * nSync) };
}

/**
 * Demultiplexa a partir del desplazamiento d: c_k[t] = Σⱼ b[d + 40t + 8 + 8k + j]·2^(7−j).
 */
export function demultiplexar(bits: Uint8Array, desplazamiento: number): Int32Array[] {
  const nTramas = Math.floor((bits.length - desplazamiento) / BITS_TRAMA);
  const canales: Int32Array[] = [];
  for (let k = 0; k < N_CANALES; k++) canales.push(new Int32Array(Math.max(nTramas, 0)));
  const nSync = SYNC.length;
  for (let t = 0; t < nTramas; t++) {
    const base = desplazamiento + t * BITS_TRAMA + nSync;
    for (let k = 0; k < N_CANALES; k++) {
      const off = base + k * N_BITS;
      let v = 0;
      for (let j = 0; j < N_BITS; j++) v = (v << 1) | bits[off + j];
      canales[k][t] = v;
    }
  }
  return canales;
}
