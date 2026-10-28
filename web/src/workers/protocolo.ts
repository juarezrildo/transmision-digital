/**
 * Protocolo de mensajes entre la interfaz y `sim.worker.ts`.
 * Cada tarea declara sus parámetros, su resultado y su progreso; los tipos de los mensajes
 * se derivan de `Tareas`, así que el worker y el cliente no pueden desalinearse.
 */
import type { Modulacion, PuntoBer } from "@/lib/dsp";

export interface ParametrosPasoBanda {
  mod: Modulacion;
  ebN0Db: number;
  /** Suma el AWGN del canal también a la forma de onda paso banda. */
  formaConRuido: boolean;
}

export interface ResultadoPasoBanda {
  mod: Modulacion;
  ebN0Db: number;
  formaConRuido: boolean;
  forma: {
    /** Tiempo en µs desde el inicio del primer símbolo dibujado. */
    tUs: Float64Array;
    s: Float64Array;
    /** Bits de cada símbolo dibujado, MSB primero ("10", "0111"...). */
    bitsPorSimbolo: string[];
    duracionSimboloUs: number;
    fsHz: number;
  };
  constelacion: {
    idealRe: Float64Array;
    idealIm: Float64Array;
    re: Float64Array;
    im: Float64Array;
    errores: number;
    bits: number;
  };
  espectro: {
    fKHz: Float64Array;
    psdDb: Float64Array;
    anchoBandaHz: number;
  };
  /** Monte Carlo a nivel de símbolo con la semilla de diseño. */
  ber: { medida: number; errores: number; bits: number };
}

export interface ParametrosCurvasBer {
  ebN0Db: readonly number[];
  /** Bits máximos por punto. */
  nBitsMax: number;
  /** El punto se detiene al alcanzar este número de errores. */
  minErrores: number;
}

export type PuntosPorModulacion = Record<Modulacion, PuntoBer[]>;

export interface ProgresoCurvasBer {
  completados: number;
  total: number;
  /** Último punto terminado. */
  ultimo: { mod: Modulacion; ebN0Db: number };
  puntos: PuntosPorModulacion;
}

export interface ResultadoCurvasBer {
  puntos: PuntosPorModulacion;
  nBitsMax: number;
  minErrores: number;
}

export interface ParametrosCargarVoz {
  /** Contenido del archivo WAV (se transfiere al worker, sin copia). */
  wav: ArrayBuffer;
  nombre: string;
}

export interface ResultadoCargarVoz {
  nombre: string;
  fsArchivo: number;
  bitsArchivo: number;
  duracionArchivoS: number;
  /** Canales de voz tras el A/D (8 kHz), uno por ranura ocupada. Entrada exacta de la cadena. */
  canales: Float64Array[];
  duracionCanalS: number;
  /** WAV de 16 bits de cada canal original, listo para el reproductor. */
  wavOriginales: ArrayBuffer[];
  /** DEP de cada canal original en dB, relativa a su propio máximo. */
  espectroOriginal: { fHz: Float64Array; psdDb: Float64Array[] };
}

export interface ParametrosCadena {
  /** Canales a 8 kHz (salida de `cargarVoz`); se envían por copia porque la interfaz los conserva. */
  canales: readonly Float64Array[];
  mod: Modulacion;
  /** null = enlace sin ruido. */
  ebN0Db: number | null;
  /** Bits aleatorios antepuestos al flujo para que el receptor tenga que buscar la trama. */
  desfaseBits: number;
}

export interface CanalRecuperado {
  recuperada: Float64Array;
  wav: ArrayBuffer;
  /** DEP de la voz recuperada en dB, con la misma referencia que la original. */
  psdDb: Float64Array;
  snrDb: number;
  /** Muestra con el mayor |original − recuperada| (o el pico de la voz si no hay errores). */
  indiceDetalle: number;
  muestrasConError: number;
}

export interface ResultadoCadena {
  mod: Modulacion;
  ebN0Db: number | null;
  desfaseBits: number;
  ber: number;
  errores: number;
  bits: number;
  erroresCable: number;
  desplazamientoTrama: number;
  calidadSincronia: number;
  snrSalidaDb: number;
  canalesIdenticos: boolean;
  /** Ranuras con voz, en orden CH1, CH2… */
  canales: CanalRecuperado[];
  /** Ranuras de la trama (siempre 4). */
  ranuras: number;
}

/** Catálogo de tareas: parámetros, resultado y progreso de cada una. */
export interface Tareas {
  pasoBanda: { parametros: ParametrosPasoBanda; resultado: ResultadoPasoBanda; progreso: never };
  curvasBer: { parametros: ParametrosCurvasBer; resultado: ResultadoCurvasBer; progreso: ProgresoCurvasBer };
  cargarVoz: { parametros: ParametrosCargarVoz; resultado: ResultadoCargarVoz; progreso: never };
  cadena: { parametros: ParametrosCadena; resultado: ResultadoCadena; progreso: never };
}

export type TipoTarea = keyof Tareas;
export type ParametrosDe<T extends TipoTarea> = Tareas[T]["parametros"];
export type ResultadoDe<T extends TipoTarea> = Tareas[T]["resultado"];
export type ProgresoDe<T extends TipoTarea> = Tareas[T]["progreso"];

/** Solicitud de ejecución; indexada por T para que `manejadores[s.tarea](s.parametros)` tipe. */
export type SolicitudEjecutar<T extends TipoTarea = TipoTarea> = {
  [K in T]: { tipo: "ejecutar"; id: number; tarea: K; parametros: ParametrosDe<K> };
}[T];

export interface SolicitudCancelar {
  tipo: "cancelar";
  id: number;
}

/** Mensajes interfaz → worker. */
export type MensajeAlWorker = SolicitudEjecutar | SolicitudCancelar;

export type RespuestaResultado<T extends TipoTarea = TipoTarea> = {
  [K in T]: { tipo: "resultado"; id: number; tarea: K; resultado: ResultadoDe<K>; duracionMs: number };
}[T];

export type RespuestaProgreso<T extends TipoTarea = TipoTarea> = {
  [K in T]: { tipo: "progreso"; id: number; tarea: K; progreso: ProgresoDe<K> };
}[T];

/** Mensajes worker → interfaz. */
export type MensajeDelWorker =
  | RespuestaResultado
  | RespuestaProgreso
  | { tipo: "error"; id: number; mensaje: string }
  | { tipo: "cancelada"; id: number };
