"use client";

import { useId } from "react";
import { formatoDecimal } from "@/lib/formato";

interface DeslizadorEbN0Props {
  valor: number;
  alCambiar: (ebN0Db: number) => void;
  minimo?: number;
  maximo?: number;
  paso?: number;
  /** Color del control (el de la modulación elegida). */
  color: string;
  deshabilitado?: boolean;
  nota?: string;
}

export function DeslizadorEbN0({
  valor,
  alCambiar,
  minimo = 0,
  maximo = 20,
  paso = 0.5,
  color,
  deshabilitado = false,
  nota,
}: DeslizadorEbN0Props) {
  const id = useId();
  const decimales = paso < 1 ? 1 : 0;
  const marcas = [0, 1, 2, 3, 4].map((i) => minimo + ((maximo - minimo) * i) / 4);
  return (
    <div className={deshabilitado ? "opacity-60" : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-tinta">
          E<sub>b</sub>/N<sub>0</sub> del canal
        </label>
        <output htmlFor={id} className="text-lg font-semibold text-tinta">
          {formatoDecimal(valor, decimales)} dB
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={minimo}
        max={maximo}
        step={paso}
        value={valor}
        disabled={deshabilitado}
        onChange={(e) => alCambiar(Number(e.target.value))}
        aria-valuetext={`${formatoDecimal(valor, decimales)} decibelios`}
        className="w-full cursor-pointer disabled:cursor-not-allowed"
        style={{ accentColor: color }}
      />
      <div aria-hidden className="-mt-2 flex justify-between text-xs text-tenue">
        {marcas.map((m) => (
          <span key={m}>{formatoDecimal(m, 0)}</span>
        ))}
      </div>
      {nota && <p className="mt-2 text-sm text-tenue">{nota}</p>}
    </div>
  );
}
