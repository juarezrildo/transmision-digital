import type { ReactNode } from "react";

interface LecturaProps {
  etiqueta: ReactNode;
  valor: ReactNode;
  unidad?: string;
  detalle?: ReactNode;
  /** "falla" marca un valor fuera de requisito (además del texto que lo dice). */
  tono?: "normal" | "falla";
}

/** Lectura numérica estilo instrumento: etiqueta pequeña, valor grande con cifras tabulares. */
export function Lectura({ etiqueta, valor, unidad, detalle, tono = "normal" }: LecturaProps) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-tenue">{etiqueta}</dt>
      <dd className={`mt-0.5 text-xl font-semibold leading-tight ${tono === "falla" ? "text-falla" : "text-tinta"}`}>
        {valor}
        {unidad && <span className="ml-1 text-base font-normal text-tenue">{unidad}</span>}
      </dd>
      {detalle && <dd className="mt-0.5 text-sm text-tenue">{detalle}</dd>}
    </div>
  );
}
