"use client";

import { useMemo, useState } from "react";
import { BER_MAX, berTeorica, MODULACIONES, tablaModulaciones, type Modulacion } from "@/lib/dsp";
import { formatoCientifico, formatoCompacto, formatoDecimal, formatoEntero, formatoPotencia10 } from "@/lib/formato";
import type { DatosGrafica, SerieGrafica } from "@/lib/grafica/tipos";
import { COLOR_TINTA, ESTILO_MODULACION } from "@/lib/modulacionesUi";
import { useSimWorker } from "@/hooks/useSimWorker";
import { useTareaSim } from "@/hooks/useTareaSim";
import { ERRORES_CURVAS } from "@/workers/configuracion";
import type { ParametrosCurvasBer, PuntosPorModulacion } from "@/workers/protocolo";
import { EstadoCalculo } from "@/components/EstadoCalculo";
import { Figura, type ElementoLeyenda } from "@/components/grafica/Figura";
import { GraficaCanvas } from "@/components/grafica/GraficaCanvas";

/** Mismos puntos que la referencia en Python: 0 a 16 dB de 1 en 1. */
const EB_N0_CURVAS = Array.from({ length: 17 }, (_, i) => i);
const EB_N0_TEORIA = Float64Array.from({ length: 161 }, (_, i) => i / 10);
const OPCIONES_BITS = [
  { valor: 1e5, exponente: 5, nota: "unos segundos" },
  { valor: 1e6, exponente: 6, nota: "recomendado" },
  { valor: 1e7, exponente: 7, nota: "lento, llega a 10⁻⁷" },
] as const;
const DOMINIO_BER: readonly [number, number] = [1e-8, 1];

function crearParametros(nBitsMax: number): ParametrosCurvasBer {
  return { ebN0Db: EB_N0_CURVAS, nBitsMax, minErrores: ERRORES_CURVAS };
}

function seriesMonteCarlo(puntos: PuntosPorModulacion | null): SerieGrafica[] {
  if (!puntos) return [];
  return MODULACIONES.map((mod) => {
    const conErrores = puntos[mod].filter((p) => p.simulada !== null);
    return {
      tipo: "puntos" as const,
      x: conErrores.map((p) => p.ebN0Db),
      y: conErrores.map((p) => p.simulada ?? Number.NaN),
      color: ESTILO_MODULACION[mod].trazo,
      radio: 4,
      marcador: ESTILO_MODULACION[mod].marcador,
    };
  });
}

export function SimuladorBer() {
  const sim = useSimWorker();
  const [nBitsMax, setNBitsMax] = useState(1e6);
  const [parametros, setParametros] = useState<ParametrosCurvasBer | null>(() => crearParametros(1e6));
  const tarea = useTareaSim(sim, "curvasBer", parametros);

  const filas = useMemo(() => tablaModulaciones(), []);
  const requerido = (mod: Modulacion) => filas.find((f) => f.mod === mod)?.ebN0ReqDb ?? Number.NaN;
  const diferencia16Qam = requerido("16-QAM") - requerido("QPSK");

  const teoria = useMemo<SerieGrafica[]>(
    () =>
      MODULACIONES.map((mod) => ({
        tipo: "linea",
        x: EB_N0_TEORIA,
        y: EB_N0_TEORIA.map((e) => berTeorica(mod, e)),
        color: ESTILO_MODULACION[mod].trazo,
        grosor: 1.5,
        opacidad: 0.85,
      })),
    [],
  );

  const puntos: PuntosPorModulacion | null = tarea.vigente
    ? (tarea.resultado?.puntos ?? null)
    : (tarea.progreso?.puntos ?? (parametros === null ? (tarea.ultimoProgreso?.puntos ?? null) : null));
  const datos = useMemo<DatosGrafica>(
    () => ({
      ejeX: { titulo: "Eb/N0 (dB)", dominio: [0, 16], marcas: 8 },
      ejeY: { titulo: "Probabilidad de error de bit", dominio: DOMINIO_BER, escala: "log" },
      // BPSK se dibuja al final: su teoría coincide con la de QPSK y así no queda oculta.
      series: [...teoria.slice(1), teoria[0], ...seriesMonteCarlo(puntos)],
      referencias: [
        { eje: "y", valor: BER_MAX, color: COLOR_TINTA, trazo: "discontinuo", etiqueta: `BER máxima del caso: ${formatoCientifico(BER_MAX)}` },
      ],
    }),
    [teoria, puntos],
  );

  const leyenda: ElementoLeyenda[] = MODULACIONES.flatMap((mod) => [
    { etiqueta: `${mod} teoría`, color: ESTILO_MODULACION[mod].trazo, forma: "linea" as const },
    { etiqueta: `${mod} Monte Carlo`, color: ESTILO_MODULACION[mod].trazo, forma: ESTILO_MODULACION[mod].marcador },
  ]);
  leyenda.push({ etiqueta: "Requisito de BER", color: COLOR_TINTA, forma: "discontinua" });

  const progreso = tarea.progreso;
  const total = EB_N0_CURVAS.length * MODULACIONES.length;
  const detenida = parametros === null;
  const exponenteActual = Math.round(Math.log10(nBitsMax));

  const elegirBits = (valor: number) => {
    setNBitsMax(valor);
    setParametros(crearParametros(valor));
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Controles de la simulación" className="flex flex-col gap-4 rounded-md border border-borde bg-white p-4 md:flex-row md:items-end md:justify-between">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold text-tinta">Bits simulados por punto (máximo)</legend>
          <div className="flex flex-wrap gap-2">
            {OPCIONES_BITS.map((o) => (
              <label
                key={o.valor}
                className={`flex min-h-11 cursor-pointer flex-col justify-center rounded border px-3 py-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tinta ${
                  nBitsMax === o.valor ? "border-2 border-tinta font-semibold" : "border-borde-fuerte"
                }`}
              >
                <input
                  type="radio"
                  name="bits-por-punto"
                  value={o.valor}
                  checked={nBitsMax === o.valor}
                  onChange={() => elegirBits(o.valor)}
                  className="sr-only"
                />
                <span className="text-tinta">{formatoPotencia10(o.exponente)} bits</span>
                <span className="text-xs font-normal text-tenue">{o.nota}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2 md:min-w-72 md:items-end">
          {tarea.calculando ? (
            <button
              type="button"
              onClick={() => setParametros(null)}
              className="min-h-11 rounded border border-tinta bg-white px-4 font-medium text-tinta hover:bg-papel"
            >
              Detener la simulación
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setParametros(crearParametros(nBitsMax))}
              className="min-h-11 rounded bg-tinta px-4 font-medium text-white hover:bg-[#2c3646]"
            >
              {detenida ? "Reanudar desde 0 dB" : "Repetir la simulación"}
            </button>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-2" aria-live="polite">
        {tarea.calculando && (
          <>
            <label htmlFor="progreso-ber" className="text-sm text-tenue">
              {progreso
                ? `Simulado ${progreso.ultimo.mod} a ${formatoCompacto(progreso.ultimo.ebN0Db, 1)} dB: ${progreso.completados} de ${total} puntos`
                : `Preparando ${total} puntos de Monte Carlo…`}
            </label>
            <progress id="progreso-ber" max={total} value={progreso?.completados ?? 0} className="h-2 w-full accent-tinta" />
          </>
        )}
        {detenida && (
          <p className="text-sm text-tenue">
            Simulación detenida
            {tarea.ultimoProgreso ? ` con ${tarea.ultimoProgreso.completados} de ${total} puntos` : ""}. La gráfica muestra lo
            calculado hasta ese momento.
          </p>
        )}
        <EstadoCalculo calculando={false} error={tarea.error} que="las curvas" />
      </div>

      <Figura
        titulo="BER frente a Eb/N0 de BPSK, QPSK y 16-QAM en canal AWGN"
        leyenda={leyenda}
        interpretacion={
          <>
            las líneas son la probabilidad de error teórica con mapeo Gray; los marcadores, el Monte Carlo con hasta{" "}
            {formatoPotencia10(exponenteActual)} bits por punto (cada punto se detiene al llegar a {ERRORES_CURVAS} errores). BPSK y
            QPSK coinciden: QPSK son dos BPSK en cuadratura con la misma energía por bit. 16-QAM necesita{" "}
            {formatoDecimal(diferencia16Qam, 2)} dB más para cruzar la línea de {formatoCientifico(BER_MAX)}. Los puntos sin
            errores no se dibujan porque su BER está por debajo de 1/N.
          </>
        }
      >
        <GraficaCanvas
          {...datos}
          proporcion={16 / 10}
          altoMaximo={560}
          altoMinimo={300}
          etiquetaAccesible="Curvas de BER frente a Eb/N0 en escala logarítmica para BPSK, QPSK y 16-QAM, con la línea del requisito de 10 a la menos 6"
        />
      </Figura>

      <MuestraPuntos puntos={puntos} />
    </div>
  );
}

/** Valores simulados y teóricos en cuatro Eb/N0, para leerlos en voz alta en la exposición. */
function MuestraPuntos({ puntos }: { puntos: PuntosPorModulacion | null }) {
  if (!puntos || MODULACIONES.every((m) => puntos[m].length === 0)) return null;
  const ebMuestra = [4, 6, 8, 10];
  return (
    <section aria-labelledby="titulo-muestra" className="flex flex-col gap-3">
      <h2 id="titulo-muestra" className="text-lg font-semibold text-tinta">
        Monte Carlo frente a teoría en algunos puntos
      </h2>
      <div className="overflow-x-auto rounded-md border border-borde bg-white">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead className="bg-papel">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-semibold">Modulación</th>
              {ebMuestra.map((e) => (
                <th key={e} scope="col" className="px-3 py-2.5 text-right font-semibold">
                  {e} dB: simulada / teórica
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULACIONES.map((mod) => (
              <tr key={mod} className="border-t border-borde">
                <th scope="row" className="px-3 py-2.5 font-semibold" style={{ color: ESTILO_MODULACION[mod].texto }}>
                  {mod}
                </th>
                {ebMuestra.map((e) => {
                  const p = puntos[mod].find((q) => q.ebN0Db === e);
                  return (
                    <td key={e} className="px-3 py-2.5 text-right">
                      {p
                        ? `${p.simulada === null ? "0 errores" : formatoCientifico(p.simulada)} / ${formatoCientifico(p.teorica)}`
                        : "pendiente"}
                      {p && <span className="block text-xs text-tenue">{formatoEntero(p.bits)} bits</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
