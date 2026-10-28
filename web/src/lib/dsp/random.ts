/**
 * Generadores pseudoaleatorios con semilla (reproducibles).
 * mulberry32 para uniformes y Box-Muller para gaussianas.
 */

/**
 * PRNG mulberry32: devuelve una función que genera u ~ U[0, 1) a partir de una semilla de 32 bits.
 */
export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generador con semilla: uniformes, gaussianas N(0, 1) y bits equiprobables. */
export class Rng {
  private readonly u: () => number;
  private reserva: number | null = null;

  constructor(semilla: number) {
    this.u = mulberry32(semilla);
  }

  /** u ~ U[0, 1). */
  uniforme(): number {
    return this.u();
  }

  /**
   * Gaussiana N(0, 1) por Box-Muller: z0 = √(−2·ln u1)·cos(2π·u2), z1 = √(−2·ln u1)·sin(2π·u2).
   */
  gaussiana(): number {
    if (this.reserva !== null) {
      const z = this.reserva;
      this.reserva = null;
      return z;
    }
    let u1 = this.u();
    while (u1 <= 0) u1 = this.u();
    const u2 = this.u();
    const r = Math.sqrt(-2 * Math.log(u1));
    const th = 2 * Math.PI * u2;
    this.reserva = r * Math.sin(th);
    return r * Math.cos(th);
  }

  /** Llena un vector con n gaussianas N(0, 1). */
  gaussianas(n: number): Float64Array {
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) z[i] = this.gaussiana();
    return z;
  }

  /** n bits equiprobables b ∈ {0, 1} (32 bits por cada número de 32 bits generado). */
  bits(n: number): Uint8Array {
    return this.bitsEn(new Uint8Array(n));
  }

  /** Llena `b` con bits equiprobables (sin reservar memoria). */
  bitsEn(b: Uint8Array): Uint8Array {
    const n = b.length;
    let i = 0;
    while (i < n) {
      const w = (this.u() * 4294967296) >>> 0;
      for (let j = 0; j < 32 && i < n; j++, i++) b[i] = (w >>> j) & 1;
    }
    return b;
  }
}
