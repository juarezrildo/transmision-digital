"use client";

import { useMemo, useState } from "react";
import { FS, type Modulacion } from "@/lib/dsp";
import { formatoCompacto, formatoDecimal, formatoEntero } from "@/lib/formato";
import type { DatosGrafica } from "@/lib/grafica/tipos";
import { COLOR_TENUE, ESTILO_MODULACION } from "@/lib/modulacionesUi";
import { Figura } from "@/components/grafica/Figura";
import { GraficaCanvas } from "@/components/grafica/GraficaCanvas";

/** Ventana de la vista de detalle. */
const DETALLE_MS = 20;

interface GraficaVozProps {
  canal: number;
  mod: Modulacion;
  /** Voz tras el A/D (antes de cuantificar). */
  original: Float64Array;
  recuperada: Float64Array;
  indiceDetalle: number;
  muestrasConError: number;
}

export function GraficaFormasVoz({ canal, mod, original, recuperada, indiceDetalle, muestrasConError }: GraficaVozProps) {
  const [vista, setVista] = useState<"completa" | "detalle">("completa");
  const color = ESTILO_MODULACION[mod].trazo;
  const duracionS = original.length / FS;

  const tiempoS = useMemo(() => Float64Array.from({ length: original.length }, (_, i) => i / FS), [original.length]);
  const ventana = useMemo(() => {
    const n = Math.round((DETALLE_MS / 1000) * FS);
    const inicio = Math.max(0, Math.min(original.length - n, indiceDetalle - Math.floor(n / 2)));
    return { inicio, fin: inicio + n };
  }, [indiceDetalle, original.length]);

  const datos = useMemo<DatosGrafica>(() => {
    if (vista === "completa") {
      return {
        ejeX: { titulo: "Tiempo (s)", dominio: [0, duracionS] },
        ejeY: { titulo: "Amplitud (escala completa ±1)", dominio: [-1.05, 1.05], marcas: 5 },
        series: [
          { tipo: "linea", x: tiempoS, y: original, color: COLOR_TENUE, grosor: 1.5 },
          { tipo: "linea", x: tiempoS, y: recuperada, color, grosor: 1, opacidad: 0.85 },
        ],
      };
    }
    const tMs = Float64Array.from({ length: ventana.fin - ventana.inicio }, (_, i) => ((ventana.inicio + i) / FS) * 1000);
    return {
      ejeX: { titulo: "Tiempo (ms)", dominio: [tMs[0], tMs[tMs.length - 1]] },
      ejeY: { titulo: "Amplitud (escala completa ±1)", dominio: [-1.05, 1.05], marcas: 5 },
      series: [
        { tipo: "linea", x: tMs, y: original.subarray(ventana.inicio, ventana.fin), color: COLOR_TENUE, grosor: 2 },
        { tipo: "linea", x: tMs, y: recuperada.subarray(ventana.inicio, ventana.fin), color, grosor: 1.5 },
        { tipo: "puntos", x: tMs, y: recuperada.subarray(ventana.inicio, ventana.fin), color, radio: 2.2 },
      ],
    };
  }, [vista, duracionS, tiempoS, original, recuperada, color, ventana]);

  const centroMs = ((ventana.inicio + ventana.fin) / 2 / FS) * 1000;
  return (
    <Figura
      titulo={`Voz del canal CH${canal + 1}: original y recuperada`}
      estado={
        <div role="group" aria-label="Vista de la forma de onda" className="flex gap-1">
          {(["completa", "detalle"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => setVista(v)}
              className={`min-h-11 rounded border px-3 text-sm ${
                vista === v ? "border-tinta bg-tinta text-white" : "border-borde-fuerte bg-white text-tinta hover:bg-papel"
              }`}
            >
              {v === "completa" ? `${formatoCompacto(duracionS, 1)} s completos` : `Detalle de ${DETALLE_MS} ms`}
            </button>
          ))}
        </div>
      }
      leyenda={[
        { etiqueta: "Original (tras el A/D, 8 kHz)", color: COLOR_TENUE, forma: "linea" },
        { etiqueta: `Recuperada con ${mod}`, color, forma: "linea" },
      ]}
      interpretacion={
        vista === "completa" ? (
          <>
            las dos curvas se superponen salvo donde el canal cambió bits: cada error en un bit alto del código PCM aparece
            como un pico aislado. Aquí hay {formatoEntero(muestrasConError)} muestras con código distinto del transmitido de{" "}
            {formatoEntero(original.length)}.
          </>
        ) : (
          <>
            {DETALLE_MS} ms alrededor de {formatoDecimal(centroMs, 1)} ms,{" "}
            {muestrasConError > 0 ? "donde está el mayor error de esta corrida" : "en el pico de la voz (no hubo errores)"}. Los
            puntos son las muestras recuperadas a 8 kHz; la diferencia pequeña y constante con la original es el ruido de
            cuantificación de 8 bits.
          </>
        )
      }
    >
      <GraficaCanvas
        {...datos}
        proporcion={5 / 2}
        altoMaximo={380}
        etiquetaAccesible={`Forma de onda de la voz del canal ${canal + 1}, original y recuperada con ${mod}`}
      />
    </Figura>
  );
}

interface GraficaEspectroVozProps {
  canal: number;
  mod: Modulacion;
  fHz: Float64Array;
  psdOriginalDb: Float64Array;
  psdRecuperadaDb: Float64Array;
}

export function GraficaEspectroVoz({ canal, mod, fHz, psdOriginalDb, psdRecuperadaDb }: GraficaEspectroVozProps) {
  const color = ESTILO_MODULACION[mod].trazo;
  const fKHz = useMemo(() => fHz.map((f) => f / 1e3), [fHz]);
  const datos = useMemo<DatosGrafica>(
    () => ({
      ejeX: { titulo: "Frecuencia (kHz)", dominio: [0, FS / 2 / 1e3] },
      ejeY: { titulo: "DEP relativa a la original (dB)", dominio: [-90, 5], marcas: 6 },
      series: [
        { tipo: "linea", x: fKHz, y: psdOriginalDb, color: COLOR_TENUE, grosor: 2 },
        { tipo: "linea", x: fKHz, y: psdRecuperadaDb, color, grosor: 1.25 },
      ],
    }),
    [fKHz, psdOriginalDb, psdRecuperadaDb, color],
  );
  return (
    <Figura
      titulo={`Espectro de la voz del canal CH${canal + 1}`}
      leyenda={[
        { etiqueta: "Original", color: COLOR_TENUE, forma: "linea" },
        { etiqueta: `Recuperada con ${mod}`, color, forma: "linea" },
      ]}
      interpretacion={
        <>
          la voz ocupa hasta unos 3,4 kHz por el filtro antialiasing. Donde la curva recuperada se despega de la original
          hacia arriba hay potencia que la voz no tenía: el ruido de cuantificación y, si el canal metió errores, el ruido
          ancho que producen los bits cambiados.
        </>
      }
    >
      <GraficaCanvas
        {...datos}
        proporcion={5 / 2}
        altoMaximo={340}
        etiquetaAccesible={`Espectro de la voz original y recuperada del canal ${canal + 1}`}
      />
    </Figura>
  );
}
