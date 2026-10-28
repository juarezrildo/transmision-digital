interface EstadoCalculoProps {
  calculando: boolean;
  error: string | null;
  /** Qué se está calculando, para el texto de espera. */
  que: string;
}

/** Indicador compacto del estado del worker junto al título de una figura o sección. */
export function EstadoCalculo({ calculando, error, que }: EstadoCalculoProps) {
  if (error) {
    return (
      <p role="alert" className="rounded bg-falla-fondo px-2 py-1 text-sm text-falla">
        No se pudo calcular {que}: {error}
      </p>
    );
  }
  return (
    <p role="status" aria-live="polite" className="min-h-5 text-sm text-tenue">
      {calculando ? `Calculando ${que}…` : ""}
    </p>
  );
}

/** Marcador de posición del área de una gráfica antes del primer resultado. */
export function GraficaPendiente({ texto, proporcion = 16 / 9 }: { texto: string; proporcion?: number }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded border border-dashed border-borde bg-papel px-4 text-center text-sm text-tenue"
      style={{ aspectRatio: String(proporcion), maxHeight: 520 }}
    >
      {texto}
    </div>
  );
}
