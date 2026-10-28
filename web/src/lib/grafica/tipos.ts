import type { TipoEscala } from "./escalas";

export interface EjeGrafica {
  /** Magnitud y unidad: "Frecuencia (kHz)". */
  titulo: string;
  dominio: readonly [number, number];
  escala?: TipoEscala;
  /** Formato de las marcas; por defecto coma decimal con los decimales del paso. */
  formato?: (v: number) => string;
  /** Número aproximado de marcas en escala lineal. */
  marcas?: number;
}

export type MarcadorGrafica = "circulo" | "cuadrado" | "triangulo" | "cruz";
export type TrazoGrafica = "continuo" | "discontinuo" | "punteado";

export type SerieGrafica =
  | {
      tipo: "linea";
      x: ArrayLike<number>;
      y: ArrayLike<number>;
      color: string;
      grosor?: number;
      trazo?: TrazoGrafica;
      opacidad?: number;
    }
  | {
      tipo: "puntos";
      x: ArrayLike<number>;
      y: ArrayLike<number>;
      color: string;
      radio?: number;
      opacidad?: number;
      marcador?: MarcadorGrafica;
    };

/** Franja sombreada entre dos valores de un eje (la máscara de 250 kHz, por ejemplo). */
export interface BandaGrafica {
  eje: "x" | "y";
  desde: number;
  hasta: number;
  color: string;
  etiqueta?: string;
}

/** Recta de referencia (BER = 10⁻⁶, límites de símbolo…). */
export interface ReferenciaGrafica {
  eje: "x" | "y";
  valor: number;
  color: string;
  etiqueta?: string;
  trazo?: TrazoGrafica;
}

/** Texto en coordenadas de datos; sin `y` se coloca en el borde superior del área. */
export interface AnotacionGrafica {
  x: number;
  y?: number;
  texto: string;
  color?: string;
}

export interface DatosGrafica {
  ejeX: EjeGrafica;
  ejeY: EjeGrafica;
  series: readonly SerieGrafica[];
  bandas?: readonly BandaGrafica[];
  referencias?: readonly ReferenciaGrafica[];
  anotaciones?: readonly AnotacionGrafica[];
}
