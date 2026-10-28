/**
 * Lectura y escritura de archivos WAV PCM (8 bits sin signo y 16 bits con signo).
 * Trabaja sobre ArrayBuffer/DataView: sirve en el navegador, en un Web Worker y en Node.
 */

/** Profundidades de bits soportadas. */
export type BitsWav = 8 | 16;

/** Audio decodificado de un WAV. */
export interface AudioWav {
  /** Frecuencia de muestreo (Hz). */
  fs: number;
  /** Número de canales del archivo. */
  canales: number;
  bitsPorMuestra: BitsWav;
  /** Muestras normalizadas a [−1, 1) (promedio de canales si es estéreo). */
  muestras: Float64Array;
}

function leerTexto(v: DataView, off: number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(off + i));
  return s;
}

function escribirTexto(v: DataView, off: number, s: string): void {
  for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
}

/**
 * Lee un WAV PCM: 8 bits x = (b − 128)/128; 16 bits x = s/32768.
 * Si hay varios canales devuelve su promedio.
 */
export function leerWav(buffer: ArrayBuffer): AudioWav {
  const v = new DataView(buffer);
  if (v.byteLength < 12 || leerTexto(v, 0, 4) !== "RIFF" || leerTexto(v, 8, 4) !== "WAVE")
    throw new Error("WAV inválido: falta la cabecera RIFF/WAVE");
  let off = 12;
  let fs = 0;
  let canales = 0;
  let bits = 0;
  let formato = 0;
  let datos: { off: number; len: number } | null = null;
  while (off + 8 <= v.byteLength) {
    const id = leerTexto(v, off, 4);
    const len = v.getUint32(off + 4, true);
    const ini = off + 8;
    if (id === "fmt ") {
      formato = v.getUint16(ini, true);
      canales = v.getUint16(ini + 2, true);
      fs = v.getUint32(ini + 4, true);
      bits = v.getUint16(ini + 14, true);
    } else if (id === "data") {
      datos = { off: ini, len: Math.min(len, v.byteLength - ini) };
    }
    off = ini + len + (len & 1);
  }
  if (!fs || !datos) throw new Error("WAV inválido: faltan los bloques fmt o data");
  if (formato !== 1 && formato !== 0xfffe) throw new Error("WAV no soportado: solo PCM");
  if (bits !== 8 && bits !== 16) throw new Error("WAV no soportado: solo 8 o 16 bits");
  const bytes = bits / 8;
  const nFrames = Math.floor(datos.len / (bytes * canales));
  const muestras = new Float64Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let s = 0;
    for (let c = 0; c < canales; c++) {
      const p = datos.off + (i * canales + c) * bytes;
      s += bits === 8 ? (v.getUint8(p) - 128) / 128 : v.getInt16(p, true) / 32768;
    }
    muestras[i] = s / canales;
  }
  return { fs, canales, bitsPorMuestra: bits, muestras };
}

/**
 * Escribe un WAV PCM mono: 8 bits b = clip(⌊(x + 1)·127,5⌋, 0, 255) (como la referencia);
 * 16 bits s = clip(round(x·32768), −32768, 32767) (inversa exacta de la lectura).
 */
export function escribirWav(muestras: Float64Array, fs: number, bits: BitsWav = 8): ArrayBuffer {
  const bytes = bits / 8;
  const n = muestras.length;
  const buffer = new ArrayBuffer(44 + n * bytes);
  const v = new DataView(buffer);
  escribirTexto(v, 0, "RIFF");
  v.setUint32(4, 36 + n * bytes, true);
  escribirTexto(v, 8, "WAVE");
  escribirTexto(v, 12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, fs, true);
  v.setUint32(28, fs * bytes, true);
  v.setUint16(32, bytes, true);
  v.setUint16(34, bits, true);
  escribirTexto(v, 36, "data");
  v.setUint32(40, n * bytes, true);
  for (let i = 0; i < n; i++) {
    if (bits === 8) {
      const b = Math.floor((muestras[i] + 1) * 127.5);
      v.setUint8(44 + i, b < 0 ? 0 : b > 255 ? 255 : b);
    } else {
      const s = Math.round(muestras[i] * 32768);
      v.setInt16(44 + 2 * i, s < -32768 ? -32768 : s > 32767 ? 32767 : s, true);
    }
  }
  return buffer;
}
