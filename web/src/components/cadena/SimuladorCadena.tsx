"use client";

import { useId, useMemo, useState } from "react";
import { BITS_TRAMA, FS, N_CANALES, type Modulacion } from "@/lib/dsp";
import { wavADataUrl } from "@/lib/audio";
import { formatoBer, formatoCompacto, formatoDecimal, formatoEntero } from "@/lib/formato";
import { ESTILO_MODULACION } from "@/lib/modulacionesUi";
import { useCargaVoz, type FuenteVoz } from "@/hooks/useCargaVoz";
import { useSimWorker } from "@/hooks/useSimWorker";
import { useTareaSim } from "@/hooks/useTareaSim";
import type { ResultadoCadena, ResultadoCargarVoz } from "@/workers/protocolo";
import { DeslizadorEbN0 } from "@/components/controles/DeslizadorEbN0";
import { SelectorModulacion } from "@/components/controles/SelectorModulacion";
import { EstadoCalculo, GraficaPendiente } from "@/components/EstadoCalculo";
import { Lectura } from "@/components/Lectura";
import { TramaTdm } from "@/components/TramaTdm";
import { GraficaEspectroVoz, GraficaFormasVoz } from "./GraficasCadena";

const RETARDO_DESLIZADOR_MS = 250;
const FUENTE_PROTOTIPO: FuenteVoz = { origen: "prototipo", url: "/voz_prototipo.wav", nombre: "voz_prototipo.wav" };

export function SimuladorCadena() {
  const sim = useSimWorker();
  const [fuente, setFuente] = useState<FuenteVoz>(FUENTE_PROTOTIPO);
  const carga = useCargaVoz(sim, fuente);
  const voz = carga.voz;

  const [mod, setMod] = useState<Modulacion>("QPSK");
  const [ebN0Db, setEbN0Db] = useState(8);
  const [sinRuido, setSinRuido] = useState(false);
  const [desfaseBits, setDesfaseBits] = useState(0);
  const [canalElegido, setCanalElegido] = useState(0);

  const parametros = useMemo(
    () => (voz ? { canales: voz.canales, mod, ebN0Db: sinRuido ? null : ebN0Db, desfaseBits } : null),
    [voz, mod, ebN0Db, sinRuido, desfaseBits],
  );
  const tarea = useTareaSim(sim, "cadena", parametros, RETARDO_DESLIZADOR_MS);
  // Un resultado de otra voz no sirve: sus canales no se corresponden con los actuales.
  const resultado = voz && tarea.parametrosResultado?.canales === voz.canales ? tarea.resultado : null;
  const canal = voz ? Math.min(canalElegido, voz.canales.length - 1) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PanelEntrada
        voz={voz}
        cargando={carga.cargando}
        error={carga.error}
        alElegirArchivo={(archivo) => setFuente({ origen: "archivo", archivo })}
        alRestaurar={() => setFuente(FUENTE_PROTOTIPO)}
        usandoPrototipo={fuente === FUENTE_PROTOTIPO}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
        <section aria-label="Controles del enlace" className="flex flex-col gap-5 rounded-md border border-borde bg-white p-4 lg:sticky lg:top-4">
          <SelectorModulacion valor={mod} alCambiar={setMod} nombre="modulacion-cadena" />
          <DeslizadorEbN0
            valor={ebN0Db}
            alCambiar={setEbN0Db}
            paso={1}
            color={ESTILO_MODULACION[mod].trazo}
            deshabilitado={sinRuido}
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tinta">
            <input
              type="checkbox"
              checked={sinRuido}
              onChange={(e) => setSinRuido(e.target.checked)}
              className="h-5 w-5 cursor-pointer"
              style={{ accentColor: ESTILO_MODULACION[mod].trazo }}
            />
            Enlace sin ruido (canal ideal)
          </label>
          <CampoDesfase valor={desfaseBits} alCambiar={setDesfaseBits} />
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <EstadoCalculo calculando={tarea.calculando} error={tarea.error} que="la cadena completa" />
          {resultado && voz ? (
            <div className={`flex flex-col gap-6 ${tarea.vigente ? "" : "opacity-75"}`}>
              <Mediciones resultado={resultado} />
              <SelectorCanal
                voz={voz}
                resultado={resultado}
                canal={canal}
                alCambiar={setCanalElegido}
              />
              <GraficaFormasVoz
                canal={canal}
                mod={resultado.mod}
                original={voz.canales[canal]}
                recuperada={resultado.canales[canal].recuperada}
                indiceDetalle={resultado.canales[canal].indiceDetalle}
                muestrasConError={resultado.canales[canal].muestrasConError}
              />
              <GraficaEspectroVoz
                canal={canal}
                mod={resultado.mod}
                fHz={voz.espectroOriginal.fHz}
                psdOriginalDb={voz.espectroOriginal.psdDb[canal]}
                psdRecuperadaDb={resultado.canales[canal].psdDb}
              />
            </div>
          ) : (
            <GraficaPendiente
              texto={
                carga.error || tarea.error
                  ? "Sin voz no hay cadena que simular. Elige otro archivo WAV o vuelve a la voz del prototipo."
                  : carga.cargando
                    ? "Leyendo y digitalizando la voz…"
                    : "Transmitiendo la voz por la cadena…"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PanelEntrada({
  voz,
  cargando,
  error,
  alElegirArchivo,
  alRestaurar,
  usandoPrototipo,
}: {
  voz: ResultadoCargarVoz | null;
  cargando: boolean;
  error: string | null;
  alElegirArchivo: (archivo: File) => void;
  alRestaurar: () => void;
  usandoPrototipo: boolean;
}) {
  const idArchivo = useId();
  const conVoz = voz?.canales.length ?? 0;
  const vacias = N_CANALES - conVoz;
  return (
    <section aria-labelledby="titulo-entrada" className="grid gap-5 rounded-md border border-borde bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="min-w-0">
        <h2 id="titulo-entrada" className="text-base font-semibold text-tinta">
          Voz de entrada
        </h2>
        {voz && (
          <>
            <p className="mt-1 break-words text-tinta">
              <span className="font-mono text-sm">{voz.nombre}</span>: {formatoDecimal(voz.duracionArchivoS, 1)} s a{" "}
              {formatoEntero(voz.fsArchivo)} Hz, {voz.bitsArchivo} bits
            </p>
            <p className="mt-2 text-lg font-semibold text-tinta">
              {conVoz} {conVoz === 1 ? "canal" : "canales"} con voz
              {vacias > 0 && ` + ${vacias} ${vacias === 1 ? "ranura vacía" : "ranuras vacías"}`}
            </p>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-tenue">
              El motor busca ventanas de {formatoCompacto(voz.duracionCanalS, 1)} s que no se solapen y elige las de más
              energía, hasta {N_CANALES}.{" "}
              {vacias > 0
                ? `Este archivo da para ${conVoz}; ${vacias === 1 ? "la ranura restante viaja" : "las ranuras restantes viajan"} con el código 0 en cada trama y no lleva voz. Un WAV más largo puede llenar las ${N_CANALES}.`
                : `Las ${N_CANALES} ranuras de la trama llevan voz.`}
            </p>
          </>
        )}
        {cargando && <p role="status" className="mt-2 text-sm text-tenue">Leyendo y digitalizando la voz…</p>}
        {error && (
          <p role="alert" className="mt-2 rounded bg-falla-fondo px-2 py-1 text-sm text-falla">
            No se pudo usar el archivo: {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label
            htmlFor={idArchivo}
            className="flex min-h-11 cursor-pointer items-center rounded border border-tinta px-4 text-sm font-medium text-tinta hover:bg-papel has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tinta"
          >
            Subir otro WAV (PCM de 8 o 16 bits)
            <input
              id={idArchivo}
              type="file"
              accept=".wav,audio/wav,audio/x-wav"
              className="sr-only"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) alElegirArchivo(archivo);
                e.target.value = "";
              }}
            />
          </label>
          {!usandoPrototipo && (
            <button
              type="button"
              onClick={alRestaurar}
              className="min-h-11 rounded px-3 text-sm font-medium text-tinta underline underline-offset-4 hover:bg-papel"
            >
              Volver a la voz del prototipo
            </button>
          )}
        </div>
      </div>
      <div className="min-w-0 self-center">
        <TramaTdm ranurasConVoz={voz ? conVoz : N_CANALES} />
      </div>
    </section>
  );
}

function CampoDesfase({ valor, alCambiar }: { valor: number; alCambiar: (bits: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-tinta">
        Bits aleatorios antes de la primera trama
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={BITS_TRAMA - 1}
        step={1}
        value={valor}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          alCambiar(Number.isFinite(n) ? Math.min(BITS_TRAMA - 1, Math.max(0, n)) : 0);
        }}
        className="mt-1 block min-h-11 w-28 rounded border border-borde-fuerte bg-white px-3 text-tinta"
        aria-describedby={`${id}-nota`}
      />
      <p id={`${id}-nota`} className="mt-1 text-sm text-tenue">
        De 0 a {BITS_TRAMA - 1}. Obliga al receptor a buscar la palabra SYNC para encontrar el inicio de trama.
      </p>
    </div>
  );
}

function Mediciones({ resultado }: { resultado: ResultadoCadena }) {
  const r = resultado;
  const conEsperado = r.desplazamientoTrama === r.desfaseBits % BITS_TRAMA;
  return (
    <section aria-labelledby="titulo-mediciones" className="rounded-md border border-borde bg-white p-4">
      <h2 id="titulo-mediciones" className="text-base font-semibold text-tinta">
        Resultado del enlace con {r.mod}
        {r.ebN0Db === null ? " sin ruido" : ` a ${formatoDecimal(r.ebN0Db, 0)} dB`}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
        <Lectura
          etiqueta="BER del tramo de radio"
          valor={formatoBer(r.ber)}
          detalle={`${formatoEntero(r.errores)} errores en ${formatoEntero(r.bits)} bits`}
        />
        <Lectura
          etiqueta="Desplazamiento de trama detectado"
          valor={formatoEntero(r.desplazamientoTrama)}
          unidad="bits"
          detalle={`SYNC coincide en ${formatoCompacto(r.calidadSincronia * 100, 2)} %${conEsperado ? "" : ", distinto del desfase aplicado"}`}
          tono={conEsperado ? "normal" : "falla"}
        />
        <Lectura
          etiqueta="SNR de la voz recuperada"
          valor={formatoDecimal(r.snrSalidaDb, 1)}
          unidad="dB"
          detalle={`promedio de ${r.canales.length} ${r.canales.length === 1 ? "canal" : "canales"} con voz`}
        />
        <Lectura
          etiqueta="Códigos PCM recuperados"
          valor={r.canalesIdenticos ? "Idénticos" : "Con errores"}
          detalle="comparados con los transmitidos"
          tono={r.canalesIdenticos ? "normal" : "falla"}
        />
        <Lectura
          etiqueta="Errores en el cable Manchester"
          valor={formatoEntero(r.erroresCable)}
          detalle="tramo de banda base, sin ruido"
        />
        <Lectura etiqueta="Tramas transmitidas" valor={formatoEntero(Math.floor(r.bits / BITS_TRAMA))} detalle={`${formatoEntero(FS)} por segundo`} />
      </dl>
    </section>
  );
}

function SelectorCanal({
  voz,
  resultado,
  canal,
  alCambiar,
}: {
  voz: ResultadoCargarVoz;
  resultado: ResultadoCadena;
  canal: number;
  alCambiar: (canal: number) => void;
}) {
  const datosCanal = resultado.canales[canal];
  const urlOriginal = useMemo(() => wavADataUrl(voz.wavOriginales[canal]), [voz, canal]);
  const urlRecuperada = useMemo(() => wavADataUrl(datosCanal.wav), [datosCanal]);
  return (
    <section aria-labelledby="titulo-escuchar" className="rounded-md border border-borde bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 id="titulo-escuchar" className="text-base font-semibold text-tinta">
          Escuchar un canal
        </h2>
        <fieldset className="min-w-0">
          <legend className="sr-only">Canal</legend>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: resultado.ranuras }, (_, i) => {
              const conVoz = i < resultado.canales.length;
              const elegido = i === canal;
              return (
                <label
                  key={i}
                  className={`flex min-h-11 flex-col items-center justify-center rounded border px-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tinta ${
                    !conVoz
                      ? "cursor-not-allowed border-dashed border-borde-fuerte text-tenue"
                      : elegido
                        ? "cursor-pointer border-2 border-tinta font-semibold text-tinta"
                        : "cursor-pointer border-borde-fuerte text-tinta hover:bg-papel"
                  }`}
                >
                  <input
                    type="radio"
                    name="canal"
                    value={i}
                    checked={elegido}
                    disabled={!conVoz}
                    onChange={() => alCambiar(i)}
                    className="sr-only"
                  />
                  CH{i + 1}
                  {!conVoz && <span className="text-xs">vacía</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-tinta">Original (tras el A/D)</p>
          <audio controls preload="metadata" src={urlOriginal} className="mt-1 w-full">
            Tu navegador no reproduce audio WAV.
          </audio>
        </div>
        <div>
          <p className="text-sm font-medium text-tinta">
            Recuperada: SNR {formatoDecimal(datosCanal.snrDb, 1)} dB
          </p>
          <audio controls preload="metadata" src={urlRecuperada} className="mt-1 w-full">
            Tu navegador no reproduce audio WAV.
          </audio>
        </div>
      </div>
    </section>
  );
}
