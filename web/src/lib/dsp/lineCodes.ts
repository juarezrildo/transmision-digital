/**
 * Códigos de línea del tramo de cable (banda base): NRZ unipolar, NRZ polar, Manchester y AMI.
 */

/** Códigos de línea disponibles. */
export type CodigoLinea = "NRZ unipolar" | "NRZ polar" | "Manchester" | "AMI";

/** Lista ordenada de códigos de línea. */
export const CODIGOS_LINEA: readonly CodigoLinea[] = ["NRZ unipolar", "NRZ polar", "Manchester", "AMI"];

/**
 * Codifica bits con `spb` muestras por bit:
 * NRZ unipolar 1→1, 0→0; NRZ polar 1→+1, 0→−1;
 * Manchester (IEEE 802.3) 1→[−1, +1] (subida), 0→[+1, −1] (bajada);
 * AMI 0→0, los unos alternan +1, −1, +1, …
 */
export function codificarLinea(bits: Uint8Array, tipo: CodigoLinea, spb = 16): Float64Array {
  const x = new Float64Array(bits.length * spb);
  if (tipo === "Manchester") {
    const medio = spb >> 1;
    for (let i = 0; i < bits.length; i++) {
      const primero = bits[i] === 1 ? -1 : 1;
      const base = i * spb;
      for (let j = 0; j < medio; j++) {
        x[base + j] = primero;
        x[base + medio + j] = -primero;
      }
    }
    return x;
  }
  let signoAmi = 1;
  for (let i = 0; i < bits.length; i++) {
    let v: number;
    if (tipo === "NRZ unipolar") v = bits[i];
    else if (tipo === "NRZ polar") v = 2 * bits[i] - 1;
    else if (bits[i] === 1) {
      v = signoAmi;
      signoAmi = -signoAmi;
    } else v = 0;
    x.fill(v, i * spb, (i + 1) * spb);
  }
  return x;
}

/**
 * Decodificador con filtro acoplado (integración por bit, y = media de las spb muestras):
 * NRZ unipolar y > 0,5; NRZ polar y > 0; AMI |y| > 0,5; Manchester: 2.ª mitad > 1.ª mitad.
 */
export function decodificarLinea(x: Float64Array, tipo: CodigoLinea, spb = 16): Uint8Array {
  const nBits = Math.floor(x.length / spb);
  const b = new Uint8Array(nBits);
  if (tipo === "Manchester") {
    const medio = spb >> 1;
    for (let i = 0; i < nBits; i++) {
      const base = i * spb;
      let h0 = 0;
      let h1 = 0;
      for (let j = 0; j < medio; j++) {
        h0 += x[base + j];
        h1 += x[base + medio + j];
      }
      b[i] = h1 > h0 ? 1 : 0;
    }
    return b;
  }
  for (let i = 0; i < nBits; i++) {
    const base = i * spb;
    let s = 0;
    for (let j = 0; j < spb; j++) s += x[base + j];
    const y = s / spb;
    if (tipo === "NRZ unipolar") b[i] = y > 0.5 ? 1 : 0;
    else if (tipo === "NRZ polar") b[i] = y > 0 ? 1 : 0;
    else b[i] = Math.abs(y) > 0.5 ? 1 : 0;
  }
  return b;
}

/** Componente DC de la señal de línea: media = (1/N)·Σ x[n]. */
export function componenteDc(x: Float64Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i];
  return x.length ? s / x.length : 0;
}
