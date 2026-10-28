/**
 * Cadena completa de transmisión digital (4 canales de voz por un solo enlace):
 * voz → A/D (antialiasing, 8 kHz, PCM 8 bits) → TDM → Manchester (cable) → modulación con RRC
 * → AWGN → filtro acoplado → decisión → sincronía de trama → demultiplexación → voz recuperada.
 */
import { sumarAwgnEn } from "./channel";
import type { Complejo } from "./math";
import { filtrar, firPasabajos } from "./math";
import { bitsPorSimbolo, demodularBb, modularBb, rrc, type Modulacion } from "./modulation";
import { codificarLinea, decodificarLinea } from "./lineCodes";
import { DUR, FS, N_BITS, N_CANALES, SEMILLA } from "./params";
import { conversionAD, cuantificar, decodificar, sqnrDb } from "./pcm";
import { Rng } from "./random";
import { demultiplexar, multiplexar, sincronizar } from "./tdm";

/**
 * Remuestreo a otra frecuencia por interpolación lineal, precedido de un FIR pasa bajos
 * (fc = 0,45·min(fs_in, fs_out)) cuando se reduce la frecuencia: y[m] = x(m·fs_in/fs_out).
 */
export function remuestrear(x: Float64Array, fsIn: number, fsOut: number): Float64Array {
  if (fsIn === fsOut) return Float64Array.from(x);
  const fuente = fsOut < fsIn ? filtrar(x, firPasabajos(0.45 * fsOut, fsIn, 127)) : x;
  const n = Math.floor((x.length * fsOut) / fsIn);
  const y = new Float64Array(n);
  const r = fsIn / fsOut;
  for (let m = 0; m < n; m++) {
    const p = m * r;
    const i = Math.floor(p);
    const a = p - i;
    const x0 = fuente[i];
    const x1 = i + 1 < fuente.length ? fuente[i + 1] : x0;
    y[m] = x0 + a * (x1 - x0);
  }
  return y;
}

/** Opciones para elegir los canales de voz. */
export interface OpcionesCanales {
  /** Segundos por canal (por defecto 2 s). */
  duracion?: number;
  /** Número de canales (por defecto 4). */
  nCanales?: number;
  /** Amplitud pico tras normalizar (carga del cuantificador; por defecto 0,95). */
  pico?: number;
}

function normalizarPico(x: Float64Array, pico: number): Float64Array {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  const y = new Float64Array(x.length);
  const g = m > 0 ? pico / m : 0;
  for (let i = 0; i < x.length; i++) y[i] = x[i] * g;
  return y;
}

/**
 * Elige las "llamadas" exactamente como la referencia: quita la media, evalúa ventanas de 2 s
 * cada fs/4 muestras, toma en orden de energía E = Σx² las que no se solapan (hasta 4) y
 * normaliza cada una a pico 0,95. Puede devolver menos de 4 canales si la voz es corta
 * (con voz_prototipo.wav, de 9,9 s, la referencia obtiene 3). Si la voz dura menos que una
 * ventana, la divide en partes iguales. La voz debe estar a 8 kHz (usar `remuestrear` si no).
 */
export function seleccionarCanales(voz: Float64Array, opciones: OpcionesCanales = {}): Float64Array[] {
  const nCanales = opciones.nCanales ?? N_CANALES;
  const pico = opciones.pico ?? 0.95;
  let media = 0;
  for (let i = 0; i < voz.length; i++) media += voz[i];
  media /= voz.length || 1;
  const x = new Float64Array(voz.length);
  for (let i = 0; i < voz.length; i++) x[i] = voz[i] - media;
  let n = Math.round((opciones.duracion ?? DUR) * FS);
  const acum = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) acum[i + 1] = acum[i] + x[i] * x[i];
  const paso = FS / 4;
  const candidatos: { e: number; i: number }[] = [];
  for (let i = 0; i < x.length - n; i += paso) candidatos.push({ e: acum[i + n] - acum[i], i });
  candidatos.sort((a, b) => b.e - a.e || b.i - a.i);
  const elegidos: number[] = [];
  for (const c of candidatos) {
    if (elegidos.every((j) => Math.abs(c.i - j) >= n)) elegidos.push(c.i);
    if (elegidos.length === nCanales) break;
  }
  if (elegidos.length === 0) {
    n = Math.floor(x.length / nCanales);
    elegidos.length = 0;
    for (let k = 0; k < nCanales; k++) elegidos.push(k * n);
  }
  elegidos.sort((a, b) => a - b);
  return elegidos.map((i) => normalizarPico(x.subarray(i, i + n), pico));
}

/**
 * Prepara los canales para la cadena: remuestrea a 8 kHz si hace falta, elige las cuatro
 * ventanas de voz y aplica la conversión A/D (señal analógica ×8, antialiasing 3,4 kHz, muestreo).
 */
export function prepararCanales(voz: Float64Array, fs: number, opciones: OpcionesCanales = {}): Float64Array[] {
  const v8k = fs === FS ? voz : remuestrear(voz, fs, FS);
  return seleccionarCanales(v8k, opciones).map(conversionAD);
}

/** Opciones de una corrida de la cadena completa. */
export interface OpcionesCadena {
  /** Canales ya muestreados a 8 kHz (salida de `prepararCanales`), de 1 a 4, valores en [−1, 1). */
  muestras: readonly Float64Array[];
  mod: Modulacion;
  /** Eb/N0 del tramo de radio (dB); null = sin ruido. */
  ebN0Db: number | null;
  semilla?: number;
  /** Bits aleatorios antepuestos al flujo para ejercitar la sincronía de trama (por defecto 0). */
  desfaseBits?: number;
  /** Muestras del filtro acoplado que se devuelven para la constelación (por defecto 3000). */
  nConstelacion?: number;
}

/** Resultado de la cadena completa. */
export interface ResultadoCadena {
  mod: Modulacion;
  ebN0Db: number | null;
  /** Voz recuperada de las 4 ranuras TDM (8 kHz, [−1, 1)); las ranuras sin canal llevan ceros. */
  vozRecuperada: Float64Array[];
  /** Voz cuantificada en el transmisor (referencia sin errores de canal). */
  vozPcm: Float64Array[];
  ber: number;
  errores: number;
  bits: number;
  /** Errores en el tramo de cable Manchester. */
  erroresCable: number;
  desplazamientoTrama: number;
  calidadSincronia: number;
  /** SNR de la voz recuperada, promedio de los canales con voz: 10·log10(Σx² / Σ(x − x̂)²) (dB). */
  snrSalidaDb: number;
  /** true si los códigos PCM de los canales con voz se recuperaron idénticos. */
  canalesIdenticos: boolean;
  /** Primeras muestras del filtro acoplado (constelación recibida). */
  constelacion: Complejo;
}

function codigosIguales(a: readonly Int32Array[], b: readonly Int32Array[]): boolean {
  if (a.length !== b.length) return false;
  for (let k = 0; k < a.length; k++) {
    if (a[k].length !== b[k].length) return false;
    for (let i = 0; i < a[k].length; i++) if (a[k][i] !== b[k][i]) return false;
  }
  return true;
}

/** Antepone `d` bits aleatorios al flujo (simula llegar a mitad de trama). */
function anteponerBits(bits: Uint8Array, d: number, rng: Rng): Uint8Array {
  if (d <= 0) return bits;
  const y = new Uint8Array(bits.length + d);
  rng.bitsEn(y.subarray(0, d));
  y.set(bits, d);
  return y;
}

/**
 * Ejecuta la cadena completa sobre canales ya muestreados: PCM 8 bits → TDM 320 kbps →
 * Manchester → modulación (Es = 1, RRC α = 0,35) → AWGN (N0 = 1/(k·Eb/N0)) → filtro acoplado
 * → sincronía → demultiplexación → decodificación. BER = errores / bits del tramo de radio.
 */
export function simularCadena(opciones: OpcionesCadena): ResultadoCadena {
  const { muestras, mod, ebN0Db } = opciones;
  const rng = new Rng(opciones.semilla ?? SEMILLA);
  const k = bitsPorSimbolo(mod);
  const cuantizados = muestras.map((m) => cuantificar(m, N_BITS));
  const codigosTx = cuantizados.map((c) => c.codigos);
  const bits = multiplexar(codigosTx);
  // Tramo de cable: Manchester con 8 muestras por bit
  const bitsCable = decodificarLinea(codificarLinea(bits, "Manchester", 8), "Manchester", 8);
  let erroresCable = 0;
  for (let i = 0; i < bits.length; i++) if (bitsCable[i] !== bits[i]) erroresCable++;
  // Tramo de radio
  const flujo = anteponerBits(bitsCable, opciones.desfaseBits ?? 0, rng);
  const nSim = Math.floor(flujo.length / k);
  const tx = flujo.subarray(0, nSim * k);
  const { senal } = modularBb(tx, mod, rrc());
  const rx = ebN0Db === null ? senal : sumarAwgnEn(senal, ebN0Db, k, rng);
  const dem = demodularBb(rx, mod, nSim, rrc());
  let errores = 0;
  for (let i = 0; i < tx.length; i++) if (dem.bits[i] !== tx[i]) errores++;
  // Receptor: sincronía, demultiplexación y PCM
  const sinc = sincronizar(dem.bits);
  const codigosRx = demultiplexar(dem.bits, sinc.desplazamiento);
  const vozRecuperada = codigosRx.map((c) => decodificar(c, N_BITS));
  let snr = 0;
  for (let c = 0; c < muestras.length; c++) snr += sqnrDb(muestras[c], vozRecuperada[c]);
  const nConst = Math.min(opciones.nConstelacion ?? 3000, nSim);
  return {
    mod,
    ebN0Db,
    vozRecuperada,
    vozPcm: cuantizados.map((c) => c.valores),
    ber: tx.length ? errores / tx.length : 0,
    errores,
    bits: tx.length,
    erroresCable,
    desplazamientoTrama: sinc.desplazamiento,
    calidadSincronia: sinc.calidad,
    snrSalidaDb: snr / muestras.length,
    canalesIdenticos: codigosIguales(codigosTx, codigosRx.slice(0, codigosTx.length)),
    constelacion: { re: dem.muestras.re.slice(0, nConst), im: dem.muestras.im.slice(0, nConst) },
  };
}

/**
 * Cadena completa sobre un buffer de voz (cualquier fs): prepara los 4 canales y simula
 * el enlace con la modulación y el Eb/N0 indicados.
 */
export function cadenaCompleta(
  voz: Float64Array,
  fs: number,
  mod: Modulacion,
  ebN0Db: number | null,
  semilla: number = SEMILLA,
): ResultadoCadena & { muestras: Float64Array[] } {
  const muestras = prepararCanales(voz, fs);
  return { ...simularCadena({ muestras, mod, ebN0Db, semilla }), muestras };
}
