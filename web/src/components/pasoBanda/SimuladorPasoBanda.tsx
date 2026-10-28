"use client";

import { useMemo, useState } from "react";
import { berTeorica, tablaModulaciones, type Modulacion } from "@/lib/dsp";
import { formatoBer, formatoDecimal, formatoEntero } from "@/lib/formato";
import { ESTILO_MODULACION } from "@/lib/modulacionesUi";
import { useSimWorker } from "@/hooks/useSimWorker";
import { useTareaSim } from "@/hooks/useTareaSim";
import { DeslizadorEbN0 } from "@/components/controles/DeslizadorEbN0";
import { SelectorModulacion } from "@/components/controles/SelectorModulacion";
import { EstadoCalculo, GraficaPendiente } from "@/components/EstadoCalculo";
import { Lectura } from "@/components/Lectura";
import { ERRORES_MONTE_CARLO } from "@/workers/configuracion";
import { GraficaConstelacion, GraficaEspectro, GraficaFormaOnda } from "./GraficasPasoBanda";
import { VeredictoRequisitos } from "./VeredictoRequisitos";

/** Espera tras el último movimiento del deslizador antes de pedir el cálculo. */
const RETARDO_DESLIZADOR_MS = 150;

export function SimuladorPasoBanda() {
  const sim = useSimWorker();
  const [mod, setMod] = useState<Modulacion>("QPSK");
  const [ebN0Db, setEbN0Db] = useState(8);
  const [formaConRuido, setFormaConRuido] = useState(false);

  const parametros = useMemo(() => ({ mod, ebN0Db, formaConRuido }), [mod, ebN0Db, formaConRuido]);
  const tarea = useTareaSim(sim, "pasoBanda", parametros, RETARDO_DESLIZADOR_MS);
  const resultado = tarea.resultado;

  const filas = useMemo(() => tablaModulaciones(), []);
  const fila = filas.find((f) => f.mod === mod) ?? filas[0];
  const teorica = berTeorica(mod, ebN0Db);

  const estado = <EstadoCalculo calculando={tarea.calculando} error={tarea.error} que="la simulación" />;
  const medidaVigente = resultado && resultado.mod === mod && resultado.ebN0Db === ebN0Db ? resultado.ber : null;
  const sinErrores = medidaVigente !== null && medidaVigente.errores === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-5 lg:sticky lg:top-4">
        <section aria-label="Controles" className="flex flex-col gap-5 rounded-md border border-borde bg-white p-4">
          <SelectorModulacion valor={mod} alCambiar={setMod} />
          <DeslizadorEbN0 valor={ebN0Db} alCambiar={setEbN0Db} color={ESTILO_MODULACION[mod].trazo} />
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tinta">
            <input
              type="checkbox"
              checked={formaConRuido}
              onChange={(e) => setFormaConRuido(e.target.checked)}
              className="h-5 w-5 cursor-pointer"
              style={{ accentColor: ESTILO_MODULACION[mod].trazo }}
            />
            Sumar el ruido del canal a la forma de onda
          </label>
        </section>

        <VeredictoRequisitos fila={fila} ebN0Db={ebN0Db} berTeorica={teorica} />

        <section aria-labelledby="titulo-ber" className="rounded-md border border-borde bg-white p-4">
          <h2 id="titulo-ber" className="text-base font-semibold text-tinta">
            BER medida frente a la teórica
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <Lectura
              etiqueta="Medida (Monte Carlo)"
              valor={medidaVigente ? formatoBer(medidaVigente.medida) : "…"}
              detalle={
                medidaVigente
                  ? `${formatoEntero(medidaVigente.errores)} errores en ${formatoEntero(medidaVigente.bits)} bits`
                  : "calculando"
              }
            />
            <Lectura etiqueta="Teórica (Gray, AWGN)" valor={formatoBer(teorica)} detalle={`a ${formatoDecimal(ebN0Db, 1)} dB`} />
          </dl>
          <p className="mt-3 text-sm text-tenue">
            {sinErrores && medidaVigente
              ? `Sin errores en ${formatoEntero(medidaVigente.bits)} bits: la BER real está por debajo de ${formatoBer(1 / medidaVigente.bits)} y esta muestra no alcanza para medirla.`
              : `El Monte Carlo usa la semilla fija del motor y se detiene al llegar a ${formatoEntero(ERRORES_MONTE_CARLO)} errores, así que el resultado se puede repetir.`}
          </p>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {resultado ? (
          <div className={`flex flex-col gap-6 ${tarea.vigente ? "" : "opacity-75"}`}>
            <div className="grid gap-6 xl:grid-cols-2">
              <GraficaConstelacion resultado={resultado} estado={estado} />
              <GraficaEspectro resultado={resultado} />
            </div>
            <GraficaFormaOnda resultado={resultado} />
          </div>
        ) : (
          <>
          {estado}
          <GraficaPendiente
            texto={tarea.error ? "Las gráficas no están disponibles." : `Simulando ${mod} a ${formatoDecimal(ebN0Db, 1)} dB…`}
          />
          </>
        )}
      </div>
    </div>
  );
}
