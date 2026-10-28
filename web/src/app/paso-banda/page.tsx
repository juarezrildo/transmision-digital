import type { Metadata } from "next";
import { ALFA, FC, RB } from "@/lib/dsp";
import { formatoCompacto, formatoEntero } from "@/lib/formato";
import { SimuladorPasoBanda } from "@/components/pasoBanda/SimuladorPasoBanda";

export const metadata: Metadata = {
  title: "Tema 3: paso banda",
  description: "BPSK, QPSK y 16-QAM con coseno alzado: forma de onda, constelación, espectro y BER frente a Eb/N0.",
};

export default function PaginaPasoBanda() {
  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-tenue">Tema 3 · Transmisión en paso banda</p>
        <h1 className="mt-1 text-[clamp(1.6rem,1.2rem+1.6vw,2.25rem)] font-semibold leading-tight text-tinta">
          ¿Qué modulación lleva {formatoEntero(RB / 1e3)} kbps por el canal de radio?
        </h1>
        <p className="mt-3 leading-relaxed text-tenue">
          Elige la modulación y mueve el E<sub>b</sub>/N<sub>0</sub>. El tramo de radio usa portadora de{" "}
          {formatoCompacto(FC / 1e6, 0)} MHz y filtros de raíz de coseno alzado con α = {formatoCompacto(ALFA, 2)} en
          el transmisor y en el receptor. La tarjeta de la izquierda dice si la combinación cumple el ancho de banda y
          la BER del caso.
        </p>
      </header>
      <SimuladorPasoBanda />
    </div>
  );
}
