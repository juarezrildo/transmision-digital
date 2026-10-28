import type { Metadata } from "next";
import { SimuladorCadena } from "@/components/cadena/SimuladorCadena";

export const metadata: Metadata = {
  title: "Cadena completa",
  description:
    "Voz del Prototipo 1 por la cadena PCM, TDM, Manchester, modulación y canal AWGN: escucha la voz recuperada y mide BER, sincronía de trama y SNR.",
};

export default function PaginaCadena() {
  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-tenue">Temas 1 a 4 · Cadena completa</p>
        <h1 className="mt-1 text-[clamp(1.6rem,1.2rem+1.6vw,2.25rem)] font-semibold leading-tight text-tinta">
          De la voz a la voz: ¿cómo suena después del canal?
        </h1>
        <p className="mt-3 leading-relaxed text-tenue">
          La voz grabada con el Prototipo 1 se digitaliza, se multiplexa en la trama TDM, cruza el cable en Manchester y el
          radioenlace con la modulación elegida, y el receptor la reconstruye. Baja el E<sub>b</sub>/N<sub>0</sub> hasta
          oír los errores y compara las formas de onda.
        </p>
      </header>
      <SimuladorCadena />
    </div>
  );
}
