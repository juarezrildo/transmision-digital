import { describe, expect, it } from "vitest";
import {
  anchoBanda,
  aPasoBanda,
  bitsPorSimbolo,
  constelacionIdeal,
  demapear,
  demodularBb,
  mapear,
  MODULACIONES,
  modularBb,
  rrc,
  tasaSimbolos,
} from "../modulation";
import { convolucion } from "../math";
import { B_MAX, SPS } from "../params";
import { Rng } from "../random";
import { leerReferencia } from "./referencia";

const ref = leerReferencia();
const S2 = 1 / Math.SQRT2;
const S10 = 1 / Math.sqrt(10);

function bitsDistintos(a: number, b: number): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += x & 1;
    x >>= 1;
  }
  return n;
}

describe("Mapeo Gray", () => {
  it("BPSK ±1 y QPSK (±1 ± j)/√2", () => {
    const b = mapear(Uint8Array.from([0, 1]), "BPSK");
    expect(Array.from(b.re)).toEqual([-1, 1]);
    expect(Array.from(b.im)).toEqual([0, 0]);
    const q = mapear(Uint8Array.from([0, 0, 0, 1, 1, 0, 1, 1]), "QPSK");
    expect(Array.from(q.re)).toEqual([-S2, -S2, S2, S2]);
    expect(Array.from(q.im)).toEqual([-S2, S2, -S2, S2]);
  });

  it("16-QAM con niveles {−3, −1, 1, 3}/√10 y Gray 00, 01, 11, 10", () => {
    const b = Uint8Array.from([0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0]);
    const s = mapear(b, "16-QAM");
    expect(Array.from(s.re)).toEqual([-3 * S10, -1 * S10, 1 * S10, 3 * S10]);
    expect(Array.from(s.im)).toEqual([3 * S10, 1 * S10, -1 * S10, -3 * S10]);
  });

  it.each(MODULACIONES)("%s: Es = 1, vecinos difieren en 1 bit, demapear(mapear(b)) = b", (mod) => {
    const k = bitsPorSimbolo(mod);
    const c = constelacionIdeal(mod);
    const m = c.re.length;
    expect(m).toBe(2 ** k);
    let es = 0;
    for (let i = 0; i < m; i++) es += c.re[i] ** 2 + c.im[i] ** 2;
    expect(es / m).toBeCloseTo(1, 12);
    let dmin = Infinity;
    for (let i = 0; i < m; i++)
      for (let j = i + 1; j < m; j++) dmin = Math.min(dmin, Math.hypot(c.re[i] - c.re[j], c.im[i] - c.im[j]));
    for (let i = 0; i < m; i++)
      for (let j = i + 1; j < m; j++)
        if (Math.hypot(c.re[i] - c.re[j], c.im[i] - c.im[j]) < dmin + 1e-9) expect(bitsDistintos(i, j)).toBe(1);
    const bits = new Rng(4).bits(4000);
    const s = mapear(bits, mod);
    expect(Array.from(demapear(s.re, s.im, mod))).toEqual(Array.from(bits));
  });

  it("16-QAM: decisión con recorte fuera de la constelación", () => {
    const r = demapear(Float64Array.from([5, -5]), Float64Array.from([-5, 5]), "16-QAM");
    expect(Array.from(r)).toEqual([1, 0, 0, 0, 0, 0, 1, 0]);
  });
});

describe("Filtro RRC y ancho de banda", () => {
  it("RRC α = 0,35, 8 sps, 8 símbolos: 65 coeficientes, simétrico y Σh² = 1", () => {
    const h = rrc();
    expect(h).toHaveLength(65);
    expect(h.reduce((a, v) => a + v * v, 0)).toBeCloseTo(1, 12);
    for (let i = 0; i < 65; i++) expect(h[i]).toBeCloseTo(h[64 - i], 14);
    expect(rrc()).toBe(h); // precalculado
    const hPython = [0.00072242, 0.00312321, 0.00471011, 0.00488551, 0.00338484];
    for (let i = 0; i < 5; i++) expect(h[i]).toBeCloseTo(hPython[i], 8);
    // caso singular |4αt| = 1 (α = 0,25 → t = ±1)
    const h2 = rrc(0.25, 4, 4);
    expect(h2.every(Number.isFinite)).toBe(true);
  });

  it("RRC ∗ RRC ≈ coseno alzado: ISI despreciable en los instantes de muestreo", () => {
    const g = convolucion(rrc(), rrc());
    const c = 64;
    expect(g[c]).toBeCloseTo(1, 12);
    // valores de numpy.convolve(rrc, rrc) en la referencia (truncamiento a 8 símbolos)
    const isiPython = [0.00013, 0.00072, -0.00262, 0.01049, -0.00297, 0.00087, -0.00007];
    for (let m = 1; m <= 7; m++) expect(g[c + m * SPS]).toBeCloseTo(isiPython[m - 1], 5);
  });

  it.each(ref.modulaciones)("$mod: B = (1 + α)·Rs = $B_kHz kHz exactos", (fila) => {
    expect(bitsPorSimbolo(fila.mod)).toBe(fila.k);
    expect(tasaSimbolos(fila.mod) / 1e3).toBe(fila.Rs_kbaud);
    expect(anchoBanda(fila.mod) / 1e3).toBe(fila.B_kHz);
    expect(anchoBanda(fila.mod) <= B_MAX).toBe(fila.cumple_B);
  });

  it("valores de diseño: 432, 216 y 108 kHz", () => {
    expect(anchoBanda("BPSK")).toBe(432000);
    expect(anchoBanda("QPSK")).toBe(216000);
    expect(anchoBanda("16-QAM")).toBe(108000);
  });
});

describe("Modulación y demodulación en banda base", () => {
  it.each(MODULACIONES)("%s sin ruido: bits idénticos y muestras ≈ símbolos (ISI < 0,04)", (mod) => {
    const bits = new Rng(8).bits(4800);
    const tx = modularBb(bits, mod);
    const nSim = bits.length / bitsPorSimbolo(mod);
    expect(tx.senal.re).toHaveLength(nSim * SPS + 64);
    const rx = demodularBb(tx.senal, mod, nSim);
    expect(Array.from(rx.bits)).toEqual(Array.from(bits));
    for (let i = 10; i < nSim - 10; i++) {
      // cota de ISI: 2·Σ|g[m·sps]| ≈ 0,036 con |s| ≤ 1
      expect(Math.abs(rx.muestras.re[i] - tx.simbolos.re[i])).toBeLessThan(0.04);
      expect(Math.abs(rx.muestras.im[i] - tx.simbolos.im[i])).toBeLessThan(0.04);
    }
  });

  it("conversión a paso banda: s = √2·[I·cos(2πfc·t) − Q·sin(2πfc·t)]", () => {
    const x = { re: Float64Array.from([1, 1, 0, 0]), im: Float64Array.from([0, 0, 1, 1]) };
    const s = aPasoBanda(x, 4, 1);
    expect(s[0]).toBeCloseTo(Math.SQRT2, 12);
    expect(s[1]).toBeCloseTo(0, 12);
    expect(s[2]).toBeCloseTo(0, 12);
    expect(s[3]).toBeCloseTo(Math.SQRT2, 12);
  });
});
