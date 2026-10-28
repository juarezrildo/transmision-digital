/**
 * Cliente del worker de simulación: numera las solicitudes, asocia cada respuesta con su
 * promesa y permite cancelar. Una tarea cancelada rechaza con `TareaCancelada`, que la
 * interfaz ignora; su resultado, si llega tarde, se descarta.
 */
import type { MensajeAlWorker, MensajeDelWorker, ParametrosDe, ProgresoDe, ResultadoDe, TipoTarea } from "./protocolo";
import { recolectarTransferibles } from "./transferibles";

export class TareaCancelada extends Error {
  constructor() {
    super("Tarea cancelada");
    this.name = "TareaCancelada";
  }
}

export interface TareaEnCurso<R> {
  id: number;
  promesa: Promise<R>;
  cancelar(): void;
}

export interface OpcionesSolicitud<T extends TipoTarea> {
  alProgresar?: (progreso: ProgresoDe<T>) => void;
  /**
   * Transfiere los buffers de los parámetros en lugar de copiarlos. Solo para datos que la
   * interfaz no vuelve a usar (el WAV leído del disco), porque quedan separados del hilo principal.
   */
  transferir?: boolean;
}

interface Pendiente {
  atender(mensaje: MensajeDelWorker): void;
  fallar(error: Error): void;
}

export class ClienteSim {
  private readonly worker: Worker;
  private readonly pendientes = new Map<number, Pendiente>();
  private siguienteId = 1;
  private averia: Error | null = null;

  constructor(crearWorker: () => Worker) {
    this.worker = crearWorker();
    this.worker.onmessage = (evento: MessageEvent<MensajeDelWorker>) => {
      this.pendientes.get(evento.data.id)?.atender(evento.data);
    };
    this.worker.onerror = (evento) => {
      evento.preventDefault();
      this.averia = new Error(`El simulador se detuvo: ${evento.message || "error desconocido"}. Recarga la página.`);
      this.fallarTodas(this.averia);
    };
    this.worker.onmessageerror = () => {
      this.fallarTodas(new Error("El simulador devolvió un mensaje que no se pudo leer."));
    };
  }

  solicitar<T extends TipoTarea>(
    tarea: T,
    parametros: ParametrosDe<T>,
    opciones: OpcionesSolicitud<T> = {},
  ): TareaEnCurso<ResultadoDe<T>> {
    const id = this.siguienteId++;
    if (this.averia) return { id, promesa: Promise.reject(this.averia), cancelar: () => {} };
    let rechazar: (error: Error) => void = () => {};
    const promesa = new Promise<ResultadoDe<T>>((resolver, rechazarPromesa) => {
      rechazar = rechazarPromesa;
      this.pendientes.set(id, {
        atender: (mensaje) => {
          if (mensaje.tipo === "progreso") {
            // El worker responde con la misma tarea que se pidió con este id.
            if (mensaje.tarea === tarea) opciones.alProgresar?.(mensaje.progreso as ProgresoDe<T>);
            return;
          }
          this.pendientes.delete(id);
          if (mensaje.tipo === "resultado" && mensaje.tarea === tarea) resolver(mensaje.resultado as ResultadoDe<T>);
          else if (mensaje.tipo === "error") rechazarPromesa(new Error(mensaje.mensaje));
          else rechazarPromesa(new TareaCancelada());
        },
        fallar: rechazarPromesa,
      });
    });
    const mensaje: MensajeAlWorker = { tipo: "ejecutar", id, tarea, parametros } as MensajeAlWorker;
    this.worker.postMessage(mensaje, { transfer: opciones.transferir ? recolectarTransferibles(parametros) : [] });
    return {
      id,
      promesa,
      cancelar: () => {
        if (!this.pendientes.delete(id)) return;
        this.worker.postMessage({ tipo: "cancelar", id } satisfies MensajeAlWorker);
        rechazar(new TareaCancelada());
      },
    };
  }

  terminar(): void {
    this.worker.terminate();
    this.fallarTodas(new TareaCancelada());
  }

  private fallarTodas(error: Error): void {
    for (const p of this.pendientes.values()) p.fallar(error);
    this.pendientes.clear();
  }
}
