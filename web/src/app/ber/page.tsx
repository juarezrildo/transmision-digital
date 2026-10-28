import type { Metadata } from "next";
import { ALFA, BER_MAX, RB, tablaModulaciones } from "@/lib/dsp";
import { formatoCientifico, formatoCompacto, formatoEntero } from "@/lib/formato";
import { recomendarModulacion } from "@/lib/recomendacion";
import { SimuladorBer } from "@/components/ber/SimuladorBer";
import { TablaModulaciones } from "@/components/TablaModulaciones";

export const metadata: Metadata = {
  title: "Curvas de BER",
  description: "BER teórica y por Monte Carlo de BPSK, QPSK y 16-QAM, Eb/N0 y C/N requeridos para BER = 10⁻⁶.",
};

export default function PaginaBer() {
  const filas = tablaModulaciones();
  const { elegida } = recomendarModulacion(filas);
  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-tenue">Tema 3 · Desempeño en ruido</p>
        <h1 className="mt-1 text-[clamp(1.6rem,1.2rem+1.6vw,2.25rem)] font-semibold leading-tight text-tinta">
          ¿Cuánto E<sub>b</sub>/N<sub>0</sub> hace falta para BER = {formatoCientifico(BER_MAX)}?
        </h1>
        <p className="mt-3 leading-relaxed text-tenue">
          El Monte Carlo corre en un hilo aparte del navegador y va dibujando cada punto en cuanto termina. Compáralo con la
          teoría y con la línea del requisito; la tabla de abajo resume el diseño del enlace de{" "}
          {formatoEntero(RB / 1e3)} kbps con α = {formatoCompacto(ALFA, 2)}.
        </p>
      </header>

      <SimuladorBer />

      <section aria-labelledby="titulo-tabla" className="flex flex-col gap-3">
        <h2 id="titulo-tabla" className="text-lg font-semibold text-tinta">
          Requisitos de cada modulación
        </h2>
        <TablaModulaciones filas={filas} completa recomendada={elegida?.mod ?? null} />
        <p className="max-w-3xl text-sm leading-relaxed text-tenue">
          C/N = E<sub>b</sub>/N<sub>0</sub> + 10·log₁₀(R<sub>b</sub>/B) y η = R<sub>b</sub>/B. El E<sub>b</sub>/N<sub>0</sub>{" "}
          requerido se obtiene por bisección sobre la BER teórica.
          {elegida &&
            ` ${elegida.mod} es la que cabe en el canal con el menor Eb/N0 requerido (${formatoCompacto(elegida.ebN0ReqDb, 2)} dB).`}
        </p>
      </section>
    </div>
  );
}
