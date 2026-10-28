import Link from "next/link";
import { ALFA, B_MAX, BER_MAX, FC, FS, N_BITS, N_CANALES, RB, tablaModulaciones } from "@/lib/dsp";
import { formatoCientifico, formatoCompacto, formatoDecimal, formatoEntero } from "@/lib/formato";
import { recomendarModulacion } from "@/lib/recomendacion";
import { TablaModulaciones } from "@/components/TablaModulaciones";
import { TramaTdm } from "@/components/TramaTdm";

interface Etapa {
  nombre: string;
  detalle: string;
  tema: string;
  enlace?: { href: string; texto: string };
}

const ETAPAS: Etapa[] = [
  { nombre: "Voz", detalle: "grabada con el micrófono del Prototipo 1", tema: "Tema 1" },
  {
    nombre: "Conversión A/D",
    detalle: `antialiasing, muestreo a ${formatoEntero(FS)} Hz y PCM uniforme de ${N_BITS} bits`,
    tema: "Tema 1",
  },
  { nombre: "Multiplexación TDM", detalle: `SYNC + ${N_CANALES} ranuras de ${N_BITS} bits por trama`, tema: "Tema 4" },
  { nombre: "Código de línea", detalle: "Manchester en el tramo de cable, sin componente continua", tema: "Tema 2" },
  {
    nombre: "Modulador",
    detalle: `BPSK, QPSK o 16-QAM con raíz de coseno alzado, α = ${formatoCompacto(ALFA, 2)}`,
    tema: "Tema 3",
    enlace: { href: "/paso-banda", texto: "Ver la señal modulada" },
  },
  {
    nombre: "Canal AWGN",
    detalle: `ruido blanco gaussiano con el Eb/N0 que elijas, portadora de ${formatoCompacto(FC / 1e6, 0)} MHz`,
    tema: "Tema 3",
    enlace: { href: "/ber", texto: "Comparar las curvas de BER" },
  },
  { nombre: "Filtro acoplado y decisión", detalle: "RRC en el receptor y demapeo Gray a bits", tema: "Tema 3" },
  { nombre: "Sincronía de trama", detalle: "busca la palabra SYNC para hallar el inicio de trama", tema: "Tema 4" },
  { nombre: "Demultiplexación y PCM", detalle: "separa las ranuras y reconstruye cada muestra", tema: "Temas 4 y 1" },
  {
    nombre: "Voz recuperada",
    detalle: "se escucha y se compara con la original",
    tema: "Cadena",
    enlace: { href: "/cadena", texto: "Escuchar la voz recuperada" },
  },
];

export default function Inicio() {
  const filas = tablaModulaciones();
  const { elegida, alternativas, descartadas } = recomendarModulacion(filas);
  const alternativa = alternativas[0];
  const bMaxKHz = formatoCompacto(B_MAX / 1e3, 0);

  return (
    <div className="flex flex-col gap-14">
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <h1 className="text-[clamp(1.8rem,1.3rem+2vw,2.75rem)] font-semibold leading-[1.15] text-tinta">
            {N_CANALES} llamadas de voz por un solo enlace de {bMaxKHz} kHz
          </h1>
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-tenue">
            Una empresa necesita llevar {N_CANALES} canales de voz digitalizados entre dos sedes por un único radioenlace.
            El canal contratado tiene {bMaxKHz} kHz y el servicio exige una tasa de error de bit de{" "}
            {formatoCientifico(BER_MAX)} o menos. Este simulador recorre la cadena completa, del micrófono al parlante, y
            compara tres modulaciones para decidir cuál usar.
          </p>
          <dl className="mt-6 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 border-t border-borde pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-tenue">Tasa del enlace</dt>
              <dd className="text-xl font-semibold text-tinta">{formatoEntero(RB / 1e3)} kbps</dd>
            </div>
            <div>
              <dt className="text-sm text-tenue">Ancho de banda máximo</dt>
              <dd className="text-xl font-semibold text-tinta">{bMaxKHz} kHz</dd>
            </div>
            <div>
              <dt className="text-sm text-tenue">BER máxima</dt>
              <dd className="text-xl font-semibold text-tinta">{formatoCientifico(BER_MAX)}</dd>
            </div>
          </dl>
        </div>

        <section aria-labelledby="titulo-decision" className="min-w-0 self-start rounded-md border-2 border-tinta bg-white p-5">
          <h2 id="titulo-decision" className="text-sm font-semibold text-tenue">
            Decisión que sale del motor
          </h2>
          {elegida ? (
            <>
              <p className="mt-1 text-2xl font-semibold text-tinta">Usar {elegida.mod}</p>
              <p className="mt-2 leading-relaxed text-tinta">
                Ocupa {formatoCompacto(elegida.bKHz, 1)} kHz y llega a BER = {formatoCientifico(BER_MAX)} con E
                <sub>b</sub>/N<sub>0</sub> = {formatoDecimal(elegida.ebN0ReqDb, 2)} dB.
                {alternativa &&
                  ` ${alternativa.mod} también cabe (${formatoCompacto(alternativa.bKHz, 1)} kHz), pero necesita ${formatoDecimal(alternativa.ebN0ReqDb - elegida.ebN0ReqDb, 2)} dB más de potencia.`}
                {descartadas.map(
                  (d) => ` ${d.mod} ocupa ${formatoCompacto(d.bKHz, 1)} kHz y no entra en el canal.`,
                )}
              </p>
            </>
          ) : (
            <p className="mt-1 text-tinta">Ninguna modulación cabe en el canal disponible.</p>
          )}
          <div className="mt-4">
            <TablaModulaciones filas={filas} recomendada={elegida?.mod ?? null} />
          </div>
        </section>
      </section>

      <section aria-labelledby="titulo-recorrido">
        <h2 id="titulo-recorrido" className="text-xl font-semibold text-tinta">
          Recorrido de la señal
        </h2>
        <p className="mt-1 max-w-prose text-tenue">
          Cada bloque es una función del motor DSP; el número indica el orden en que la señal lo atraviesa.
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ETAPAS.map((e, i) => (
            <li key={e.nombre} className="flex flex-col rounded-md border border-borde bg-white p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-tenue">{i + 1}</span>
                <span className="text-xs text-tenue">{e.tema}</span>
              </div>
              <p className="mt-1 font-semibold text-tinta">{e.nombre}</p>
              <p className="mt-1 text-sm leading-snug text-tenue">{e.detalle}</p>
              {e.enlace && (
                <Link
                  href={e.enlace.href}
                  className="mt-auto inline-flex min-h-11 items-end pt-2 text-sm font-medium text-tinta underline underline-offset-4"
                >
                  {e.enlace.texto}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="titulo-trama" className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
        <div>
          <h2 id="titulo-trama" className="text-xl font-semibold text-tinta">
            La trama que viaja por el enlace
          </h2>
          <p className="mt-2 max-w-prose leading-relaxed text-tenue">
            Cada {formatoCompacto(1e6 / FS, 0)} µs sale una trama con la palabra de sincronía y una muestra PCM de cada
            canal. El receptor busca la palabra SYNC para saber dónde empieza cada trama y separar los canales.
          </p>
        </div>
        <TramaTdm />
      </section>

      <section aria-labelledby="titulo-paginas">
        <h2 id="titulo-paginas" className="text-xl font-semibold text-tinta">
          Qué hay en cada página
        </h2>
        <ul className="mt-4 divide-y divide-borde border-y border-borde">
          {[
            {
              href: "/paso-banda",
              titulo: "Paso banda",
              texto: `Forma de onda, constelación, espectro frente al canal de ${bMaxKHz} kHz y BER en vivo para cada modulación.`,
            },
            {
              href: "/ber",
              titulo: "Curvas BER",
              texto: "Teoría y Monte Carlo de las tres modulaciones, con el Eb/N0 y el C/N que exige el requisito.",
            },
            {
              href: "/cadena",
              titulo: "Cadena completa",
              texto: "La voz del prototipo atraviesa todo el sistema; se escucha, se mide la BER, la sincronía y la SNR.",
            },
            {
              href: "/acerca",
              titulo: "Acerca",
              texto: "Integrantes, materia y cómo se relaciona este simulador con el Prototipo 1 y la simulación en Python.",
            },
          ].map((p) => (
            <li key={p.href}>
              <Link href={p.href} className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="font-semibold text-tinta underline-offset-4 group-hover:underline sm:w-44 sm:shrink-0">
                  {p.titulo}
                </span>
                <span className="text-tenue">{p.texto}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
