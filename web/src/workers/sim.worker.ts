/**
 * Web Worker de simulación: ejecuta el motor DSP fuera del hilo principal.
 *
 * Las tareas se atienden en orden. Una tarea queda obsoleta si la interfaz la cancela o si llega
 * otra del mismo tipo; entre etapas cede el hilo para poder leer esos mensajes y abandonar el
 * trabajo pendiente. Los resultados viajan como Transferable (sin copia), por eso cada vector que
 * se devuelve es nuevo y el worker no guarda referencias a él.
 */
import {
  berMonteCarlo,
  constelacionRecibida,
  curvaBerMonteCarlo,
  escribirWav,
  espectroPasoBanda,
  formaOndaPasoBanda,
  FC,
  FS,
  FS_PASO_BANDA,
  leerWav,
  MODULACIONES,
  bitsPorSimbolo,
  prepararCanales,
  SEMILLA,
  simularCadena,
  sqnrDb,
  tasaSimbolos,
  welch,
  type EspectroModulado,
  type Modulacion,
} from "@/lib/dsp";
import type {
  CanalRecuperado,
  MensajeAlWorker,
  MensajeDelWorker,
  ParametrosDe,
  ProgresoDe,
  PuntosPorModulacion,
  ResultadoDe,
  SolicitudEjecutar,
  TipoTarea,
} from "./protocolo";
import { BITS_MONTE_CARLO, ERRORES_MONTE_CARLO, SIMBOLOS_CONSTELACION, SIMBOLOS_FORMA } from "./configuracion";
import { recolectarTransferibles } from "./transferibles";

interface AlcanceWorker {
  postMessage(mensaje: MensajeDelWorker, opciones: { transfer: Transferable[] }): void;
  onmessage: ((evento: MessageEvent<MensajeAlWorker>) => void) | null;
}

const alcance = self as unknown as AlcanceWorker;

/** La forma de onda se dibuja a 4·5,12 MHz para que cada ciclo de la portadora tenga 20 muestras. */
const FS_FORMA = 4 * FS_PASO_BANDA;
const ESPECTRO_DESDE_KHZ = 500;
const ESPECTRO_HASTA_KHZ = 1500;
const NPERSEG_VOZ = 512;

class TareaCancelada extends Error {}

interface ContextoTarea<T extends TipoTarea> {
  /** Cede el hilo; lanza TareaCancelada si la tarea quedó obsoleta mientras tanto. */
  ceder(): Promise<void>;
  progresar(progreso: ProgresoDe<T>): void;
}

type Manejadores = {
  [T in TipoTarea]: (parametros: ParametrosDe<T>, contexto: ContextoTarea<T>) => Promise<ResultadoDe<T>>;
};

// MessageChannel cede sin el mínimo de 4 ms que aplica setTimeout anidado.
const canalCesion = new MessageChannel();
const esperandoCesion: (() => void)[] = [];
canalCesion.port1.onmessage = () => esperandoCesion.shift()?.();

function cederHilo(): Promise<void> {
  return new Promise((resolver) => {
    esperandoCesion.push(resolver);
    canalCesion.port2.postMessage(null);
  });
}

function enDb(psd: Float64Array, referencia: number): Float64Array {
  const y = new Float64Array(psd.length);
  for (let i = 0; i < psd.length; i++) y[i] = 10 * Math.log10(psd[i] / referencia + 1e-12);
  return y;
}

function maximo(x: Float64Array): number {
  let m = 0;
  for (let i = 0; i < x.length; i++) if (x[i] > m) m = x[i];
  return m;
}

function indiceMaximoAbs(x: ArrayLike<number>, y?: ArrayLike<number>): number {
  let mejor = 0;
  let indice = 0;
  for (let i = 0; i < x.length; i++) {
    const v = Math.abs(y ? x[i] - y[i] : x[i]);
    if (v > mejor) {
      mejor = v;
      indice = i;
    }
  }
  return indice;
}

/** El espectro sin ruido solo depende de la modulación: se calcula una vez y se entrega por copia. */
const espectrosCache = new Map<Modulacion, EspectroModulado>();

function espectroRecortado(mod: Modulacion) {
  let e = espectrosCache.get(mod);
  if (!e) {
    e = espectroPasoBanda(mod);
    espectrosCache.set(mod, e);
  }
  const indices: number[] = [];
  for (let i = 0; i < e.f.length; i++) {
    const fKHz = e.f[i] / 1e3;
    if (fKHz >= ESPECTRO_DESDE_KHZ && fKHz <= ESPECTRO_HASTA_KHZ) indices.push(i);
  }
  const fuente = e;
  return {
    fKHz: Float64Array.from(indices, (i) => fuente.f[i] / 1e3),
    psdDb: Float64Array.from(indices, (i) => fuente.psdDbNorm[i]),
    anchoBandaHz: e.anchoBandaHz,
  };
}

function agruparBits(bits: Uint8Array, k: number): string[] {
  const grupos: string[] = [];
  for (let i = 0; i + k <= bits.length; i += k) grupos.push(Array.from(bits.subarray(i, i + k)).join(""));
  return grupos;
}

function puntosVacios(): PuntosPorModulacion {
  return { BPSK: [], QPSK: [], "16-QAM": [] };
}

function copiarPuntos(p: PuntosPorModulacion): PuntosPorModulacion {
  return { BPSK: [...p.BPSK], QPSK: [...p.QPSK], "16-QAM": [...p["16-QAM"]] };
}

const manejadores: Manejadores = {
  async pasoBanda({ mod, ebN0Db, formaConRuido }, contexto) {
    const forma = formaOndaPasoBanda(mod, SIMBOLOS_FORMA, {
      fs: FS_FORMA,
      fc: FC,
      ebN0Db: formaConRuido ? ebN0Db : null,
    });
    await contexto.ceder();
    const constelacion = constelacionRecibida(mod, ebN0Db, SIMBOLOS_CONSTELACION);
    await contexto.ceder();
    const espectro = espectroRecortado(mod);
    await contexto.ceder();
    const ber = berMonteCarlo({ mod, ebN0Db, nBits: BITS_MONTE_CARLO, minErrores: ERRORES_MONTE_CARLO, semilla: SEMILLA });
    return {
      mod,
      ebN0Db,
      formaConRuido,
      forma: {
        tUs: Float64Array.from(forma.t, (t) => t * 1e6),
        s: forma.s,
        bitsPorSimbolo: agruparBits(forma.bits, bitsPorSimbolo(mod)),
        duracionSimboloUs: 1e6 / tasaSimbolos(mod),
        fsHz: FS_FORMA,
      },
      constelacion: {
        idealRe: constelacion.ideal.re,
        idealIm: constelacion.ideal.im,
        re: constelacion.recibida.re,
        im: constelacion.recibida.im,
        errores: constelacion.errores,
        bits: constelacion.bits,
      },
      espectro,
      ber: { medida: ber.ber, errores: ber.errores, bits: ber.bits },
    };
  },

  async curvasBer({ ebN0Db, nBitsMax, minErrores }, contexto) {
    const puntos = puntosVacios();
    const total = ebN0Db.length * MODULACIONES.length;
    let completados = 0;
    // Recorre por Eb/N0 creciente alternando modulaciones: las tres curvas avanzan a la vez.
    for (let i = 0; i < ebN0Db.length; i++) {
      for (const mod of MODULACIONES) {
        await contexto.ceder();
        // Misma semilla por punto (SEMILLA + i) que curvaBerMonteCarlo sobre el vector completo.
        const [punto] = curvaBerMonteCarlo(mod, [ebN0Db[i]], nBitsMax, SEMILLA + i, minErrores);
        puntos[mod].push(punto);
        completados++;
        contexto.progresar({ completados, total, ultimo: { mod, ebN0Db: ebN0Db[i] }, puntos: copiarPuntos(puntos) });
      }
    }
    return { puntos, nBitsMax, minErrores };
  },

  async cargarVoz({ wav, nombre }, contexto) {
    const audio = leerWav(wav);
    if (audio.muestras.length === 0) throw new Error("El archivo WAV no contiene muestras de audio.");
    await contexto.ceder();
    const canales = prepararCanales(audio.muestras, audio.fs);
    await contexto.ceder();
    const espectros = canales.map((c) => welch(c, FS, NPERSEG_VOZ));
    return {
      nombre,
      fsArchivo: audio.fs,
      bitsArchivo: audio.bitsPorMuestra,
      duracionArchivoS: audio.muestras.length / audio.fs,
      canales,
      duracionCanalS: canales.length ? canales[0].length / FS : 0,
      wavOriginales: canales.map((c) => escribirWav(c, FS, 16)),
      espectroOriginal: {
        fHz: espectros.length ? espectros[0].f : new Float64Array(0),
        psdDb: espectros.map((e) => enDb(e.psd, maximo(e.psd))),
      },
    };
  },

  async cadena({ canales, mod, ebN0Db, desfaseBits }, contexto) {
    await contexto.ceder();
    const r = simularCadena({ muestras: canales, mod, ebN0Db, desfaseBits, nConstelacion: 0 });
    const recuperados: CanalRecuperado[] = canales.map((original, c) => {
      const recuperada = r.vozRecuperada[c];
      const pcm = r.vozPcm[c];
      let muestrasConError = 0;
      for (let i = 0; i < pcm.length; i++) if (pcm[i] !== recuperada[i]) muestrasConError++;
      const referencia = maximo(welch(original, FS, NPERSEG_VOZ).psd);
      return {
        recuperada,
        wav: escribirWav(recuperada, FS, 16),
        psdDb: enDb(welch(recuperada, FS, NPERSEG_VOZ).psd, referencia),
        snrDb: sqnrDb(original, recuperada),
        indiceDetalle: muestrasConError > 0 ? indiceMaximoAbs(pcm, recuperada) : indiceMaximoAbs(original),
        muestrasConError,
      };
    });
    return {
      mod,
      ebN0Db,
      desfaseBits,
      ber: r.ber,
      errores: r.errores,
      bits: r.bits,
      erroresCable: r.erroresCable,
      desplazamientoTrama: r.desplazamientoTrama,
      calidadSincronia: r.calidadSincronia,
      snrSalidaDb: r.snrSalidaDb,
      canalesIdenticos: r.canalesIdenticos,
      canales: recuperados,
      ranuras: r.vozRecuperada.length,
    };
  },
};

const canceladas = new Set<number>();
const ultimaPorTarea = new Map<TipoTarea, number>();
const cola: SolicitudEjecutar[] = [];
let atendiendo = false;

function esObsoleta(s: { id: number; tarea: TipoTarea }): boolean {
  return canceladas.has(s.id) || ultimaPorTarea.get(s.tarea) !== s.id;
}

function responder(mensaje: MensajeDelWorker): void {
  alcance.postMessage(mensaje, { transfer: recolectarTransferibles(mensaje) });
}

function ejecutar<T extends TipoTarea>(s: SolicitudEjecutar<T>): Promise<ResultadoDe<T>> {
  const contexto: ContextoTarea<T> = {
    async ceder() {
      await cederHilo();
      if (esObsoleta(s)) throw new TareaCancelada();
    },
    progresar(progreso) {
      if (!esObsoleta(s)) responder({ tipo: "progreso", id: s.id, tarea: s.tarea, progreso } as MensajeDelWorker);
    },
  };
  return manejadores[s.tarea](s.parametros, contexto);
}

async function atenderCola(): Promise<void> {
  atendiendo = true;
  for (let s = cola.shift(); s; s = cola.shift()) {
    if (esObsoleta(s)) {
      responder({ tipo: "cancelada", id: s.id });
    } else {
      const inicio = performance.now();
      try {
        const resultado = await ejecutar(s);
        if (esObsoleta(s)) responder({ tipo: "cancelada", id: s.id });
        else
          responder({
            tipo: "resultado",
            id: s.id,
            tarea: s.tarea,
            resultado,
            duracionMs: performance.now() - inicio,
          } as MensajeDelWorker);
      } catch (error) {
        if (error instanceof TareaCancelada) responder({ tipo: "cancelada", id: s.id });
        else responder({ tipo: "error", id: s.id, mensaje: error instanceof Error ? error.message : String(error) });
      }
    }
    canceladas.delete(s.id);
  }
  atendiendo = false;
}

alcance.onmessage = (evento) => {
  const mensaje = evento.data;
  if (mensaje.tipo === "cancelar") {
    canceladas.add(mensaje.id);
    return;
  }
  ultimaPorTarea.set(mensaje.tarea, mensaje.id);
  cola.push(mensaje);
  if (!atendiendo) void atenderCola();
};
