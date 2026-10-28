/**
 * Escalas, marcas de eje y decimación para las gráficas en canvas. Sin dependencias del DOM.
 */

export type TipoEscala = "lineal" | "log";

export interface Escala {
  tipo: TipoEscala;
  dominio: readonly [number, number];
  rango: readonly [number, number];
  /** Valor → píxel; NaN si el valor no es representable (≤ 0 en escala log). */
  aPixel(v: number): number;
}

export function crearEscala(tipo: TipoEscala, dominio: readonly [number, number], rango: readonly [number, number]): Escala {
  const [r0, r1] = rango;
  if (tipo === "log") {
    const l0 = Math.log10(dominio[0]);
    const l1 = Math.log10(dominio[1]);
    const k = (r1 - r0) / (l1 - l0);
    return { tipo, dominio, rango, aPixel: (v) => (v > 0 ? r0 + (Math.log10(v) - l0) * k : Number.NaN) };
  }
  const [d0, d1] = dominio;
  const k = (r1 - r0) / (d1 - d0 || 1);
  return { tipo, dominio, rango, aPixel: (v) => r0 + (v - d0) * k };
}

/** Paso "redondo" (1, 2 o 5 × 10ⁿ) para que haya unas `objetivo` marcas en el intervalo. */
export function pasoRedondo(intervalo: number, objetivo: number): number {
  const bruto = intervalo / Math.max(1, objetivo);
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const relativo = bruto / potencia;
  const factor = relativo < 1.5 ? 1 : relativo < 3.5 ? 2 : relativo < 7.5 ? 5 : 10;
  return factor * potencia;
}

/** Decimales necesarios para escribir múltiplos de `paso` sin redondear. */
export function decimalesDePaso(paso: number): number {
  return Math.max(0, -Math.floor(Math.log10(paso) + 1e-9));
}

/** Marcas lineales múltiplos de un paso redondo dentro de [min, max]. */
export function marcasLineales(min: number, max: number, objetivo = 6): { valores: number[]; paso: number } {
  const paso = pasoRedondo(max - min, objetivo);
  const valores: number[] = [];
  const inicio = Math.ceil(min / paso - 1e-9);
  for (let i = inicio; i * paso <= max + paso * 1e-9; i++) valores.push(Number((i * paso).toPrecision(12)));
  return { valores, paso };
}

/** Marcas logarítmicas: décadas enteras (exponentes) y subdivisiones 2…9 dentro de [min, max]. */
export function marcasLog(min: number, max: number): { decadas: number[]; menores: number[] } {
  const decadas: number[] = [];
  const menores: number[] = [];
  const e0 = Math.floor(Math.log10(min));
  const e1 = Math.ceil(Math.log10(max));
  for (let e = e0; e <= e1; e++) {
    const base = 10 ** e;
    if (base >= min * (1 - 1e-9) && base <= max * (1 + 1e-9)) decadas.push(e);
    for (let m = 2; m <= 9; m++) {
      const v = m * base;
      if (v > min && v < max) menores.push(v);
    }
  }
  return { decadas, menores };
}

/**
 * Reduce una polilínea de x creciente a, como mucho, un mínimo y un máximo por columna de
 * píxel. Conserva los picos (errores de bit en la voz, por ejemplo) que un submuestreo perdería.
 * Devuelve índices de las muestras a dibujar, en orden.
 */
export function decimarMinMax(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  xMin: number,
  xMax: number,
  columnas: number,
): number[] {
  const n = Math.min(x.length, y.length);
  if (n <= columnas * 2) return Array.from({ length: n }, (_, i) => i);
  const indices: number[] = [];
  const ancho = (xMax - xMin) / columnas;
  let columna = Number.NaN;
  let iMin = -1;
  let iMax = -1;
  const volcar = () => {
    if (iMin < 0) return;
    if (iMin === iMax) indices.push(iMin);
    else if (iMin < iMax) indices.push(iMin, iMax);
    else indices.push(iMax, iMin);
  };
  for (let i = 0; i < n; i++) {
    const c = Math.floor((x[i] - xMin) / ancho);
    if (c !== columna) {
      volcar();
      columna = c;
      iMin = iMax = Number.isFinite(y[i]) ? i : -1;
      continue;
    }
    if (!Number.isFinite(y[i])) continue;
    if (iMin < 0) {
      iMin = iMax = i;
    } else {
      if (y[i] < y[iMin]) iMin = i;
      if (y[i] > y[iMax]) iMax = i;
    }
  }
  volcar();
  return indices;
}
