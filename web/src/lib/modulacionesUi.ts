import type { Modulacion } from "@/lib/dsp";

/** Presentación de cada modulación: un color fijo en toda la interfaz y en las figuras. */
export interface EstiloModulacion {
  /** Color de trazo en gráficas (el mismo de las figuras de simulacion-python). */
  trazo: string;
  /** Variante oscura para texto sobre blanco (contraste ≥ 4,5:1). */
  texto: string;
  /** Marcador de los puntos Monte Carlo (como en la figura de Python: o, s, ^). */
  marcador: "circulo" | "cuadrado" | "triangulo";
  descripcion: string;
}

export const ESTILO_MODULACION: Record<Modulacion, EstiloModulacion> = {
  BPSK: { trazo: "#1f4e9c", texto: "#1f4e9c", marcador: "circulo", descripcion: "1 bit por símbolo, fases 0° y 180°" },
  QPSK: { trazo: "#d9731f", texto: "#a4510c", marcador: "cuadrado", descripcion: "2 bits por símbolo, cuatro fases" },
  "16-QAM": { trazo: "#2e8b57", texto: "#22704a", marcador: "triangulo", descripcion: "4 bits por símbolo, fase y amplitud" },
};

/** Colores neutros compartidos por las gráficas. */
export const COLOR_TINTA = "#1b2330";
export const COLOR_TENUE = "#4a5361";
export const COLOR_REJILLA = "#e3e5e8";
export const COLOR_BANDA = "rgba(74, 83, 97, 0.14)";
export const COLOR_FALLA = "#b42318";
