import { describe, expect, it } from "vitest";
import { ClienteSim, TareaCancelada } from "../clienteSim";
import type { MensajeAlWorker, MensajeDelWorker, PuntosPorModulacion } from "../protocolo";

/** Worker falso: guarda lo enviado y deja responder a mano. */
class WorkerFalso {
  enviados: { mensaje: MensajeAlWorker; transfer: Transferable[] }[] = [];
  onmessage: ((e: MessageEvent<MensajeDelWorker>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminado = false;
  postMessage(mensaje: MensajeAlWorker, opciones?: { transfer?: Transferable[] }) {
    this.enviados.push({ mensaje, transfer: opciones?.transfer ?? [] });
  }
  terminate() {
    this.terminado = true;
  }
  responder(m: MensajeDelWorker) {
    this.onmessage?.({ data: m } as MessageEvent<MensajeDelWorker>);
  }
}

function crear() {
  const falso = new WorkerFalso();
  const cliente = new ClienteSim(() => falso as unknown as Worker);
  return { falso, cliente };
}

const parametrosCadena = { canales: [new Float64Array(8)], mod: "QPSK" as const, ebN0Db: 8, desfaseBits: 0 };

describe("ClienteSim", () => {
  it("asocia la respuesta a su solicitud por id", async () => {
    const { falso, cliente } = crear();
    const t = cliente.solicitar("cargarVoz", { wav: new ArrayBuffer(4), nombre: "a.wav" });
    expect(falso.enviados[0].mensaje).toMatchObject({ tipo: "ejecutar", tarea: "cargarVoz", id: t.id });
    falso.responder({ tipo: "error", id: t.id, mensaje: "WAV inválido" });
    await expect(t.promesa).rejects.toThrow("WAV inválido");
  });

  it("copia los parámetros por defecto y transfiere solo si se pide", () => {
    const { falso, cliente } = crear();
    cliente.solicitar("cadena", parametrosCadena);
    expect(falso.enviados[0].transfer).toEqual([]);
    const wav = new ArrayBuffer(16);
    cliente.solicitar("cargarVoz", { wav, nombre: "b.wav" }, { transferir: true });
    expect(falso.enviados[1].transfer).toEqual([wav]);
  });

  it("cancelar avisa al worker, rechaza con TareaCancelada e ignora la respuesta tardía", async () => {
    const { falso, cliente } = crear();
    const t = cliente.solicitar("cadena", parametrosCadena);
    t.cancelar();
    expect(falso.enviados[1].mensaje).toEqual({ tipo: "cancelar", id: t.id });
    await expect(t.promesa).rejects.toBeInstanceOf(TareaCancelada);
    expect(() => falso.responder({ tipo: "cancelada", id: t.id })).not.toThrow();
  });

  it("entrega el progreso antes del resultado", async () => {
    const { falso, cliente } = crear();
    const vistos: number[] = [];
    const t = cliente.solicitar(
      "curvasBer",
      { ebN0Db: [0], nBitsMax: 10, minErrores: 1 },
      { alProgresar: (p) => vistos.push(p.completados) },
    );
    const puntos: PuntosPorModulacion = { BPSK: [], QPSK: [], "16-QAM": [] };
    falso.responder({
      tipo: "progreso",
      id: t.id,
      tarea: "curvasBer",
      progreso: { completados: 1, total: 3, ultimo: { mod: "BPSK", ebN0Db: 0 }, puntos },
    });
    falso.responder({
      tipo: "resultado",
      id: t.id,
      tarea: "curvasBer",
      resultado: { puntos, nBitsMax: 10, minErrores: 1 },
      duracionMs: 1,
    });
    await expect(t.promesa).resolves.toMatchObject({ nBitsMax: 10 });
    expect(vistos).toEqual([1]);
  });

  it("terminar cancela lo pendiente", async () => {
    const { falso, cliente } = crear();
    const t = cliente.solicitar("cadena", parametrosCadena);
    cliente.terminar();
    expect(falso.terminado).toBe(true);
    await expect(t.promesa).rejects.toBeInstanceOf(TareaCancelada);
  });
});
