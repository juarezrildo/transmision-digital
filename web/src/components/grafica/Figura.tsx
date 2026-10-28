import type { ReactNode } from "react";

export type FormaLeyenda = "linea" | "discontinua" | "punteada" | "circulo" | "cuadrado" | "triangulo" | "cruz" | "banda";

export interface ElementoLeyenda {
  etiqueta: string;
  color: string;
  forma: FormaLeyenda;
}

function Muestra({ color, forma }: Omit<ElementoLeyenda, "etiqueta">) {
  const comun = { width: 26, height: 14, viewBox: "0 0 26 14", "aria-hidden": true } as const;
  switch (forma) {
    case "banda":
      return (
        <svg {...comun}>
          <rect x="1" y="1" width="24" height="12" fill={color} stroke="#4a5361" strokeWidth="0.75" />
        </svg>
      );
    case "circulo":
      return (
        <svg {...comun}>
          <circle cx="13" cy="7" r="4.5" fill={color} />
        </svg>
      );
    case "cuadrado":
      return (
        <svg {...comun}>
          <rect x="8.5" y="2.5" width="9" height="9" fill={color} />
        </svg>
      );
    case "triangulo":
      return (
        <svg {...comun}>
          <path d="M13 1.5 L18.5 11.5 L7.5 11.5 Z" fill={color} />
        </svg>
      );
    case "cruz":
      return (
        <svg {...comun}>
          <path d="M8.5 2.5 L17.5 11.5 M17.5 2.5 L8.5 11.5" stroke={color} strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg {...comun}>
          <line
            x1="1"
            y1="7"
            x2="25"
            y2="7"
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray={forma === "discontinua" ? "6 4" : forma === "punteada" ? "2 3" : undefined}
          />
        </svg>
      );
  }
}

export interface FiguraProps {
  titulo: string;
  leyenda: readonly ElementoLeyenda[];
  /** Línea "Qué muestra esta gráfica". */
  interpretacion: ReactNode;
  /** Estado del cálculo (calculando, error) mostrado junto al título. */
  estado?: ReactNode;
  children: ReactNode;
}

/** Marco común de las gráficas: título, leyenda, área de dibujo e interpretación. */
export function Figura({ titulo, leyenda, interpretacion, estado, children }: FiguraProps) {
  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-md border border-borde bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold text-tinta">{titulo}</h3>
        {estado}
      </div>
      {leyenda.length > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-tenue" aria-label="Leyenda">
          {leyenda.map((e) => (
            <li key={e.etiqueta} className="flex items-center gap-2">
              <Muestra color={e.color} forma={e.forma} />
              <span>{e.etiqueta}</span>
            </li>
          ))}
        </ul>
      )}
      {children}
      <figcaption className="text-sm leading-relaxed text-tenue">
        <span className="font-semibold text-tinta">Qué muestra esta gráfica: </span>
        {interpretacion}
      </figcaption>
    </figure>
  );
}
