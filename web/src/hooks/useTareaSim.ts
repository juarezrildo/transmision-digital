"use client";

import { useEffect, useRef, useState } from "react";
import { TareaCancelada, type TareaEnCurso } from "@/workers/clienteSim";
import type { ParametrosDe, ProgresoDe, ResultadoDe, TipoTarea } from "@/workers/protocolo";
import type { SolicitadorSim } from "./useSimWorker";

export interface EstadoTarea<T extends TipoTarea> {
  /** Último resultado recibido; puede corresponder a parámetros anteriores (ver `vigente`). */
  resultado: ResultadoDe<T> | null;
  /** Parámetros con los que se obtuvo `resultado`. */
  parametrosResultado: ParametrosDe<T> | null;
  /** El resultado corresponde a los parámetros actuales. */
  vigente: boolean;
  calculando: boolean;
  error: string | null;
  /** Progreso de la solicitud actual. */
  progreso: ProgresoDe<T> | null;
  /** Último progreso recibido, aunque la solicitud se haya cancelado (resultados parciales). */
  ultimoProgreso: ProgresoDe<T> | null;
}

interface EstadoInterno<T extends TipoTarea> {
  resultado: ResultadoDe<T> | null;
  resultadoPara: ParametrosDe<T> | null;
  error: string | null;
  errorPara: ParametrosDe<T> | null;
  progreso: ProgresoDe<T> | null;
  progresoPara: ParametrosDe<T> | null;
}

/**
 * Ejecuta una tarea del worker cada vez que cambian los parámetros (comparados por identidad:
 * el componente debe memorizarlos). Espera `retardoMs` sin cambios antes de pedirla (debounce
 * del deslizador), cancela la solicitud anterior y conserva el último resultado mientras calcula.
 * `parametros = null` no pide nada y cancela lo que esté en curso.
 */
export function useTareaSim<T extends TipoTarea>(
  sim: SolicitadorSim,
  tarea: T,
  parametros: ParametrosDe<T> | null,
  retardoMs = 0,
): EstadoTarea<T> {
  const [estado, setEstado] = useState<EstadoInterno<T>>({
    resultado: null,
    resultadoPara: null,
    error: null,
    errorPara: null,
    progreso: null,
    progresoPara: null,
  });
  // Parámetros ya resueltos: evita repetir el cálculo cuando la ruta vuelve a mostrarse.
  const resueltosRef = useRef<ParametrosDe<T> | null>(null);

  useEffect(() => {
    if (parametros === null || resueltosRef.current === parametros) return;
    let enCurso: TareaEnCurso<ResultadoDe<T>> | null = null;
    const temporizador = setTimeout(() => {
      enCurso = sim.solicitar(tarea, parametros, {
        alProgresar: (progreso) => setEstado((e) => ({ ...e, progreso, progresoPara: parametros })),
      });
      enCurso.promesa.then(
        (resultado) => {
          resueltosRef.current = parametros;
          setEstado((e) => ({ ...e, resultado, resultadoPara: parametros, error: null, errorPara: null }));
        },
        (error: unknown) => {
          if (error instanceof TareaCancelada) return;
          const mensaje = error instanceof Error ? error.message : String(error);
          setEstado((e) => ({ ...e, error: mensaje, errorPara: parametros }));
        },
      );
    }, retardoMs);
    return () => {
      clearTimeout(temporizador);
      enCurso?.cancelar();
    };
  }, [sim, tarea, parametros, retardoMs]);

  const vigente = parametros !== null && estado.resultadoPara === parametros;
  const error = parametros !== null && estado.errorPara === parametros ? estado.error : null;
  return {
    resultado: estado.resultado,
    parametrosResultado: estado.resultadoPara,
    vigente,
    calculando: parametros !== null && !vigente && error === null,
    error,
    progreso: parametros !== null && estado.progresoPara === parametros ? estado.progreso : null,
    ultimoProgreso: estado.progreso,
  };
}
