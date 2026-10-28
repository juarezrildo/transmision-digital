/**
 * Canal AWGN complejo con la normalización del modelo de referencia (Es = 1).
 */
import type { Complejo } from "./math";
import type { Rng } from "./random";

/** Densidad espectral de ruido con Es = 1: N0 = 1 / (k·Eb/N0), con Eb/N0 en veces = 10^(dB/10). */
export function n0DesdeEbN0(ebN0Db: number, k: number): number {
  return 1 / (k * 10 ** (ebN0Db / 10));
}

/**
 * Suma ruido complejo en el lugar: r = x + √(N0/2)·(n₁ + j·n₂), n₁, n₂ ~ N(0, 1).
 * Varianza total N0 por muestra (Es = 1).
 */
export function sumarAwgnEn(x: Complejo, ebN0Db: number, k: number, rng: Rng): Complejo {
  const sigma = Math.sqrt(n0DesdeEbN0(ebN0Db, k) / 2);
  const n = x.re.length;
  for (let i = 0; i < n; i++) {
    x.re[i] += sigma * rng.gaussiana();
    x.im[i] += sigma * rng.gaussiana();
  }
  return x;
}

/**
 * Canal AWGN: devuelve una copia r = x + ruido con N0 = 1/(k·Eb/N0);
 * si `ebN0Db` es null, el canal es ideal (r = x).
 */
export function canalAwgn(x: Complejo, ebN0Db: number | null, k: number, rng: Rng): Complejo {
  const r: Complejo = { re: Float64Array.from(x.re), im: Float64Array.from(x.im) };
  if (ebN0Db === null) return r;
  return sumarAwgnEn(r, ebN0Db, k, rng);
}
