"use client";

import { useEffect, useRef, useState } from "react";
import { TareaCancelada, type TareaEnCurso } from "@/workers/clienteSim";
import type { ResultadoCargarVoz } from "@/workers/protocolo";
import type { SolicitadorSim } from "./useSimWorker";

/** De dónde sale la voz: el WAV del prototipo servido por el sitio o un archivo del usuario. */
export type FuenteVoz = { origen: "prototipo"; url: string; nombre: string } | { origen: "archivo"; archivo: File };

export interface EstadoCargaVoz {
  voz: ResultadoCargarVoz | null;
  cargando: boolean;
  error: string | null;
}

async function leerFuente(fuente: FuenteVoz, senal: AbortSignal): Promise<{ wav: ArrayBuffer; nombre: string }> {
  if (fuente.origen === "archivo") return { wav: await fuente.archivo.arrayBuffer(), nombre: fuente.archivo.name };
  const respuesta = await fetch(fuente.url, { signal: senal });
  if (!respuesta.ok) throw new Error(`no se pudo descargar ${fuente.nombre} (HTTP ${respuesta.status})`);
  return { wav: await respuesta.arrayBuffer(), nombre: fuente.nombre };
}

/**
 * Lee el WAV y lo digitaliza en el worker (selección de ventanas de voz + A/D a 8 kHz).
 * El buffer leído se transfiere al worker sin copia; la interfaz no lo vuelve a usar.
 */
export function useCargaVoz(sim: SolicitadorSim, fuente: FuenteVoz): EstadoCargaVoz {
  const [estado, setEstado] = useState<{
    voz: ResultadoCargarVoz | null;
    vozDe: FuenteVoz | null;
    error: string | null;
    errorDe: FuenteVoz | null;
  }>({ voz: null, vozDe: null, error: null, errorDe: null });
  const cargadaRef = useRef<FuenteVoz | null>(null);

  useEffect(() => {
    if (cargadaRef.current === fuente) return;
    const abortar = new AbortController();
    let tarea: TareaEnCurso<ResultadoCargarVoz> | null = null;
    leerFuente(fuente, abortar.signal)
      .then(({ wav, nombre }) => {
        if (abortar.signal.aborted) throw new TareaCancelada();
        tarea = sim.solicitar("cargarVoz", { wav, nombre }, { transferir: true });
        return tarea.promesa;
      })
      .then(
        (voz) => {
          cargadaRef.current = fuente;
          setEstado({ voz, vozDe: fuente, error: null, errorDe: null });
        },
        (error: unknown) => {
          if (error instanceof TareaCancelada || abortar.signal.aborted) return;
          const mensaje = error instanceof Error ? error.message : String(error);
          setEstado((e) => ({ ...e, error: mensaje, errorDe: fuente }));
        },
      );
    return () => {
      abortar.abort();
      tarea?.cancelar();
    };
  }, [sim, fuente]);

  const error = estado.errorDe === fuente ? estado.error : null;
  return { voz: estado.voz, cargando: estado.vozDe !== fuente && error === null, error };
}
