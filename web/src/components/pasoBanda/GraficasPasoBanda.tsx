"use client";

import type React from "react";
import { useMemo } from "react";
import { B_MAX, FC } from "@/lib/dsp";
import { formatoCompacto, formatoDecimal, formatoEntero } from "@/lib/formato";
import type { DatosGrafica } from "@/lib/grafica/tipos";
import { COLOR_BANDA, COLOR_TENUE, COLOR_TINTA, ESTILO_MODULACION } from "@/lib/modulacionesUi";
import type { ResultadoPasoBanda } from "@/workers/protocolo";
import { Figura } from "@/components/grafica/Figura";
import { GraficaCanvas } from "@/components/grafica/GraficaCanvas";

interface GraficaProps {
  resultado: ResultadoPasoBanda;
}

const LIMITE_CONSTELACION = 1.8;

export function GraficaConstelacion({ resultado, estado }: GraficaProps & { estado?: React.ReactNode }) {
  const { mod, ebN0Db, constelacion } = resultado;
  const color = ESTILO_MODULACION[mod].trazo;
  const datos = useMemo<DatosGrafica>(
    () => ({
      ejeX: { titulo: "Componente en fase I (Es = 1)", dominio: [-LIMITE_CONSTELACION, LIMITE_CONSTELACION], marcas: 6 },
      ejeY: { titulo: "Cuadratura Q", dominio: [-LIMITE_CONSTELACION, LIMITE_CONSTELACION], marcas: 6 },
      series: [
        { tipo: "puntos", x: constelacion.re, y: constelacion.im, color, radio: 1.7, opacidad: 0.35 },
        { tipo: "puntos", x: constelacion.idealRe, y: constelacion.idealIm, color: COLOR_TINTA, radio: 6, marcador: "cruz" },
      ],
      referencias: [
        { eje: "x", valor: 0, color: COLOR_TENUE, trazo: "punteado" },
        { eje: "y", valor: 0, color: COLOR_TENUE, trazo: "punteado" },
      ],
    }),
    [constelacion, color],
  );
  const simbolos = constelacion.re.length;
  return (
    <Figura
      titulo={`Constelación recibida de ${mod} a ${formatoDecimal(ebN0Db, 1)} dB`}
      estado={estado}
      leyenda={[
        { etiqueta: `${formatoEntero(simbolos)} muestras del filtro acoplado`, color, forma: "circulo" },
        { etiqueta: "Símbolos ideales", color: COLOR_TINTA, forma: "cruz" },
      ]}
      interpretacion={
        <>
          cada punto es un símbolo recibido después del filtro acoplado RRC, justo antes de decidir. El ruido abre una
          nube alrededor de cada símbolo ideal; los puntos que cruzan los ejes (en 16-QAM, también las fronteras entre
          niveles) se deciden mal. En esta nube hubo {formatoEntero(constelacion.errores)}{" "}
          {constelacion.errores === 1 ? "bit errado" : "bits errados"} de{" "}
          {formatoEntero(constelacion.bits)}.
        </>
      }
    >
      <div className="mx-auto w-full max-w-[460px]">
        <GraficaCanvas
          {...datos}
          proporcion={1}
          altoMaximo={460}
          etiquetaAccesible={`Diagrama de constelación de ${mod} con ruido de ${formatoDecimal(ebN0Db, 1)} dB de Eb/N0`}
        />
      </div>
    </Figura>
  );
}

export function GraficaEspectro({ resultado }: GraficaProps) {
  const { mod, espectro } = resultado;
  const color = ESTILO_MODULACION[mod].trazo;
  const fcKHz = FC / 1e3;
  const bKHz = espectro.anchoBandaHz / 1e3;
  const bMaxKHz = B_MAX / 1e3;
  const cabe = espectro.anchoBandaHz <= B_MAX;
  const datos = useMemo<DatosGrafica>(
    () => ({
      ejeX: { titulo: "Frecuencia (kHz)", dominio: [600, 1400] },
      ejeY: { titulo: "DEP normalizada (dB)", dominio: [-60, 3], marcas: 7 },
      series: [{ tipo: "linea", x: espectro.fKHz, y: espectro.psdDb, color, grosor: 1.5 }],
      bandas: [
        {
          eje: "x",
          desde: fcKHz - bMaxKHz / 2,
          hasta: fcKHz + bMaxKHz / 2,
          color: COLOR_BANDA,
        },
      ],
      referencias: [
        { eje: "x", valor: fcKHz - bKHz / 2, color: COLOR_TINTA, trazo: "discontinuo" },
        { eje: "x", valor: fcKHz + bKHz / 2, color: COLOR_TINTA, trazo: "discontinuo", etiqueta: `B = ${formatoCompacto(bKHz, 1)} kHz` },
      ],
    }),
    [espectro, color, fcKHz, bKHz, bMaxKHz],
  );
  return (
    <Figura
      titulo={`Espectro de ${mod} alrededor de la portadora de ${formatoCompacto(fcKHz, 0)} kHz`}
      leyenda={[
        { etiqueta: `DEP de ${mod} (Welch, ventana de Hann)`, color, forma: "linea" },
        { etiqueta: "Ancho de banda calculado (1 + α)·Rs", color: COLOR_TINTA, forma: "discontinua" },
        { etiqueta: `Canal de ${formatoCompacto(bMaxKHz, 0)} kHz`, color: COLOR_BANDA, forma: "banda" },
      ]}
      interpretacion={
        <>
          la potencia de {mod} se concentra en B = {formatoCompacto(bKHz, 1)} kHz centrados en {formatoCompacto(fcKHz, 0)} kHz
          (líneas discontinuas). La franja gris es el canal contratado de {formatoCompacto(bMaxKHz, 0)} kHz:{" "}
          {cabe
            ? `${mod} cabe con ${formatoCompacto(bMaxKHz - bKHz, 1)} kHz de margen.`
            : `${mod} se sale ${formatoCompacto(bKHz - bMaxKHz, 1)} kHz, así que no cumple aunque su BER sea buena.`}
        </>
      }
    >
      <GraficaCanvas
        {...datos}
        proporcion={4 / 3}
        altoMaximo={460}
        etiquetaAccesible={`Espectro de ${mod}: ocupa ${formatoCompacto(bKHz, 1)} kHz frente a un canal de ${formatoCompacto(bMaxKHz, 0)} kHz`}
      />
    </Figura>
  );
}

export function GraficaFormaOnda({ resultado }: GraficaProps) {
  const { mod, forma, ebN0Db, formaConRuido: conRuido } = resultado;
  const color = ESTILO_MODULACION[mod].trazo;
  const nSimbolos = forma.bitsPorSimbolo.length;
  const ts = forma.duracionSimboloUs;
  const datos = useMemo<DatosGrafica>(() => {
    let pico = 0;
    for (let i = 0; i < forma.s.length; i++) pico = Math.max(pico, Math.abs(forma.s[i]));
    const limite = Math.max(0.1, Math.ceil(pico * 1.15 * 10) / 10);
    return {
      ejeX: { titulo: "Tiempo (µs)", dominio: [0, nSimbolos * ts] },
      ejeY: { titulo: "s(t) (normalizada)", dominio: [-limite, limite], marcas: 5 },
      series: [{ tipo: "linea", x: forma.tUs, y: forma.s, color, grosor: 1.25 }],
      referencias: Array.from({ length: nSimbolos - 1 }, (_, i) => ({
        eje: "x" as const,
        valor: (i + 1) * ts,
        color: COLOR_TENUE,
        trazo: "punteado" as const,
      })),
      anotaciones: forma.bitsPorSimbolo.map((bits, i) => ({ x: (i + 0.5) * ts, texto: bits, color: COLOR_TINTA })),
    };
  }, [forma, color, nSimbolos, ts]);
  return (
    <Figura
      titulo={`Forma de onda paso banda de ${mod}: ${nSimbolos} símbolos`}
      leyenda={[
        { etiqueta: conRuido ? `s(t) con ruido de ${formatoDecimal(ebN0Db, 1)} dB` : "s(t) sin ruido", color, forma: "linea" },
        { etiqueta: `Límites de símbolo (Ts = ${formatoCompacto(ts, 3)} µs)`, color: COLOR_TENUE, forma: "punteada" },
      ]}
      interpretacion={
        <>
          la portadora de {formatoCompacto(FC / 1e6, 0)} MHz modulada por {nSimbolos} símbolos; arriba, los bits de cada
          uno. En cada límite la portadora cambia de fase
          {mod === "16-QAM" ? " y de amplitud" : ""} según esos bits, con transiciones suaves por el filtro de coseno
          alzado. Se dibuja a {formatoCompacto(forma.fsHz / 1e6, 2)} MHz de muestreo.
          {conRuido
            ? " El ruido blanco cubre toda esa banda; el filtro acoplado del receptor deja pasar solo la parte que cae dentro del canal."
            : ""}
        </>
      }
    >
      <GraficaCanvas
        {...datos}
        proporcion={21 / 8}
        altoMaximo={360}
        etiquetaAccesible={`Forma de onda paso banda de ${mod} con los bits ${forma.bitsPorSimbolo.join(" ")}`}
      />
    </Figura>
  );
}
