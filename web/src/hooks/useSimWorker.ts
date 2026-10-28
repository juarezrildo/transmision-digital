"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ClienteSim, type OpcionesSolicitud, type TareaEnCurso } from "@/workers/clienteSim";
import type { ParametrosDe, ResultadoDe, TipoTarea } from "@/workers/protocolo";

export interface SolicitadorSim {
  solicitar<T extends TipoTarea>(
    tarea: T,
    parametros: ParametrosDe<T>,
    opciones?: OpcionesSolicitud<T>,
  ): TareaEnCurso<ResultadoDe<T>>;
}

/**
 * Un worker de simulación por componente. Se crea en la primera solicitud (nunca en el
 * servidor) y se termina al desmontar o al ocultarse la ruta (Activity de Cache Components);
 * si vuelve a hacer falta, se crea otro.
 */
export function useSimWorker(): SolicitadorSim {
  const clienteRef = useRef<ClienteSim | null>(null);

  useEffect(
    () => () => {
      clienteRef.current?.terminar();
      clienteRef.current = null;
    },
    [],
  );

  const solicitar = useCallback(
    <T extends TipoTarea>(tarea: T, parametros: ParametrosDe<T>, opciones?: OpcionesSolicitud<T>) => {
      if (!clienteRef.current) {
        clienteRef.current = new ClienteSim(
          () => new Worker(new URL("../workers/sim.worker.ts", import.meta.url), { type: "module", name: "simulador" }),
        );
      }
      return clienteRef.current.solicitar(tarea, parametros, opciones);
    },
    [],
  );

  return useMemo(() => ({ solicitar }), [solicitar]);
}
