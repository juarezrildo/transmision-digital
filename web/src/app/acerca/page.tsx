import type { Metadata } from "next";
import Link from "next/link";
import { ALFA, BITS_TRAMA, FC, FS, FS_PASO_BANDA, N_BITS, N_CANALES, RB, SEMILLA, SPAN, SPS, SYNC } from "@/lib/dsp";
import { formatoCompacto, formatoEntero } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Acerca",
  description:
    "Integrantes, materia y relación del simulador web con el Prototipo 1 y con la simulación de referencia en Python.",
};

const INTEGRANTES = ["Rildo Jimmy Juarez Romero", "Moises Antonio Cruz Garzon", "Denis Yhair Rodriguez Quispe"];

export default function PaginaAcerca() {
  const parametros: [string, string][] = [
    ["Muestreo y cuantificación", `${formatoEntero(FS)} Hz, PCM uniforme de ${N_BITS} bits en [−1, 1)`],
    ["Trama TDM", `SYNC ${Array.from(SYNC).join("")} + ${N_CANALES} × ${N_BITS} bits = ${BITS_TRAMA} bits`],
    ["Tasa binaria del enlace", `${formatoEntero(RB / 1e3)} kbps`],
    ["Código de línea del cable", "Manchester (IEEE 802.3: 1 = subida, 0 = bajada)"],
    ["Pulso", `raíz de coseno alzado, α = ${formatoCompacto(ALFA, 2)}, ${SPS} muestras por símbolo, ${SPAN} símbolos de duración`],
    ["Portadora y muestreo paso banda", `${formatoCompacto(FC / 1e6, 0)} MHz a ${formatoCompacto(FS_PASO_BANDA / 1e6, 2)} MHz`],
    ["Semilla de los generadores aleatorios", String(SEMILLA)],
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <header>
        <h1 className="text-[clamp(1.6rem,1.2rem+1.6vw,2.25rem)] font-semibold leading-tight text-tinta">Acerca del proyecto</h1>
        <p className="mt-3 leading-relaxed text-tenue">
          Actividad 6 de Comunicaciones Digitales I (RED-0310), UPDS. El proyecto integra los
          cuatro temas de la materia en una sola cadena de transmisión: conversión A/D, banda base, paso banda y
          multiplexación.
        </p>
      </header>

      <section aria-labelledby="titulo-equipo" className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 id="titulo-equipo" className="text-lg font-semibold text-tinta">
            Integrantes
          </h2>
          <ul className="mt-2 space-y-1 text-tinta">
            {INTEGRANTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
        <dl className="grid content-start gap-3">
          <div>
            <dt className="text-sm text-tenue">Docente</dt>
            <dd className="text-tinta">Ing. Esteban Soruco Sanchez</dd>
          </div>
          <div>
            <dt className="text-sm text-tenue">Materia</dt>
            <dd className="text-tinta">Comunicaciones Digitales I (RED-0310)</dd>
          </div>
          <div>
            <dt className="text-sm text-tenue">Entrega</dt>
            <dd className="text-tinta">28 de octubre de 2026</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="titulo-prototipo">
        <h2 id="titulo-prototipo" className="text-lg font-semibold text-tinta">
          Relación con el Prototipo 1
        </h2>
        <div className="mt-2 space-y-3 leading-relaxed text-tinta">
          <p>
            El Prototipo 1 es el enlace físico, armado con dos Arduino Uno y un Arduino Nano. El transmisor toma la voz del
            micrófono, la digitaliza en PCM de {N_BITS} bits a {formatoEntero(FS)} Hz y la envía en una trama TDM con la
            misma palabra de sincronía que usa este simulador, por un cable UTP. El Nano inyecta ruido regulable en la línea
            y el receptor decide los bits, alinea la trama, devuelve la voz al parlante y muestra la BER en un display.
          </p>
          <p>
            El archivo <span className="font-mono text-sm">voz_prototipo.wav</span> que usa la página{" "}
            <Link href="/cadena" className="font-medium underline underline-offset-4">
              Cadena completa
            </Link>{" "}
            es voz real capturada con ese prototipo. El simulador extiende el enlace a {N_CANALES} canales, cambia el
            código de línea a Manchester y agrega el tramo de radio con BPSK, QPSK y 16-QAM, que el hardware no tiene.
          </p>
        </div>
      </section>

      <section aria-labelledby="titulo-python">
        <h2 id="titulo-python" className="text-lg font-semibold text-tinta">
          Relación con la simulación en Python
        </h2>
        <div className="mt-2 space-y-3 leading-relaxed text-tinta">
          <p>
            <span className="font-mono text-sm">simulacion-python/sistema.py</span> es la referencia validada del
            proyecto. El motor de este sitio (<span className="font-mono text-sm">web/src/lib/dsp</span>) es una
            reimplementación en TypeScript de esa cadena, y sus pruebas automáticas comparan cada resultado con{" "}
            <span className="font-mono text-sm">docs/resultados_python.json</span>: SQNR, anchos de banda, E<sub>b</sub>/N
            <sub>0</sub> requeridos, curvas de BER y la cadena completa, que sin ruido recupera los canales bit a bit.
          </p>
          <p>
            Todo el cálculo corre en tu navegador, en un Web Worker, para que la página no se congele. Los generadores
            aleatorios usan una semilla fija, así que la misma combinación de controles da siempre el mismo resultado.
          </p>
        </div>
      </section>

      <section aria-labelledby="titulo-parametros">
        <h2 id="titulo-parametros" className="text-lg font-semibold text-tinta">
          Parámetros de diseño
        </h2>
        <dl className="mt-3 divide-y divide-borde border-y border-borde">
          {parametros.map(([nombre, valor]) => (
            <div key={nombre} className="grid gap-1 py-2.5 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm text-tenue">{nombre}</dt>
              <dd className="text-tinta">{valor}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
