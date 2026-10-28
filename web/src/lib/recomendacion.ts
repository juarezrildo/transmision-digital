import type { FilaModulacion } from "@/lib/dsp";

export interface Recomendacion {
  /** La que cabe en el canal con el menor Eb/N0 requerido; null si ninguna cabe. */
  elegida: FilaModulacion | null;
  /** Otras que caben, de menor a mayor Eb/N0 requerido. */
  alternativas: FilaModulacion[];
  /** Las que no caben en el ancho de banda disponible. */
  descartadas: FilaModulacion[];
}

/** Criterio del caso: primero el ancho de banda (B ≤ 250 kHz), después la menor potencia necesaria. */
export function recomendarModulacion(filas: readonly FilaModulacion[]): Recomendacion {
  const caben = filas.filter((f) => f.cumpleB).sort((a, b) => a.ebN0ReqDb - b.ebN0ReqDb);
  return {
    elegida: caben[0] ?? null,
    alternativas: caben.slice(1),
    descartadas: filas.filter((f) => !f.cumpleB),
  };
}
