"use client";

import { useEffect, useRef, useState } from "react";
import { useDevicePixelRatio } from "@/hooks/useDevicePixelRatio";
import { dibujarGrafica } from "@/lib/grafica/dibujo";
import type { DatosGrafica } from "@/lib/grafica/tipos";

export interface GraficaCanvasProps extends DatosGrafica {
  /** Descripción para lectores de pantalla (el canvas es una imagen). */
  etiquetaAccesible: string;
  /** Relación ancho/alto del área (CSS aspect-ratio). */
  proporcion?: number;
  /** Alto máximo en píxeles CSS. */
  altoMaximo?: number;
  /** Alto mínimo en píxeles CSS (en pantallas angostas manda sobre la proporción). */
  altoMinimo?: number;
}

/**
 * Gráfica 2D en canvas. Redibuja en el siguiente cuadro de animación cuando cambian los datos,
 * el tamaño del contenedor o el devicePixelRatio. Los datos deben llegar memorizados: cada
 * objeto nuevo provoca un redibujado.
 */
export function GraficaCanvas({
  etiquetaAccesible,
  proporcion = 16 / 9,
  altoMaximo = 520,
  altoMinimo = 240,
  ejeX,
  ejeY,
  series,
  bandas,
  referencias,
  anotaciones,
}: GraficaCanvasProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  const dpr = useDevicePixelRatio();

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;
      setTamano((t) =>
        t.ancho === Math.floor(width) && t.alto === Math.floor(height)
          ? t
          : { ancho: Math.floor(width), alto: Math.floor(height) },
      );
    });
    observador.observe(contenedor);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const { ancho, alto } = tamano;
    if (!canvas || ancho === 0 || alto === 0) return;
    const cuadro = requestAnimationFrame(() => {
      const anchoPx = Math.round(ancho * dpr);
      const altoPx = Math.round(alto * dpr);
      if (canvas.width !== anchoPx) canvas.width = anchoPx;
      if (canvas.height !== altoPx) canvas.height = altoPx;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fuente = getComputedStyle(canvas).fontFamily || "sans-serif";
      dibujarGrafica(ctx, ancho, alto, fuente, { ejeX, ejeY, series, bandas, referencias, anotaciones });
    });
    return () => cancelAnimationFrame(cuadro);
  }, [tamano, dpr, ejeX, ejeY, series, bandas, referencias, anotaciones]);

  return (
    <div
      ref={contenedorRef}
      className="relative w-full"
      style={{ aspectRatio: String(proporcion), maxHeight: altoMaximo, minHeight: altoMinimo }}
    >
      <canvas ref={canvasRef} role="img" aria-label={etiquetaAccesible} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
