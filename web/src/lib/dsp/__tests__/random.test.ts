import { describe, expect, it } from "vitest";
import { mulberry32, Rng } from "../random";

describe("Generadores con semilla", () => {
  it("mulberry32 es reproducible y uniforme en [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    let s = 0;
    for (let i = 0; i < 100000; i++) {
      const u = a();
      expect(u).toBe(b());
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      s += u;
    }
    expect(s / 100000).toBeCloseTo(0.5, 2);
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it("Box-Muller entrega N(0, 1)", () => {
    const z = new Rng(7).gaussianas(200000);
    let m = 0;
    let v = 0;
    for (const x of z) m += x;
    m /= z.length;
    for (const x of z) v += (x - m) ** 2;
    v /= z.length;
    expect(Math.abs(m)).toBeLessThan(0.01);
    expect(Math.abs(v - 1)).toBeLessThan(0.01);
    expect(Array.from(new Rng(7).gaussianas(5))).toEqual(Array.from(z.subarray(0, 5)));
  });

  it("bits equiprobables y reproducibles", () => {
    const b = new Rng(3).bits(100001);
    let unos = 0;
    for (const x of b) unos += x;
    expect(Math.abs(unos / b.length - 0.5)).toBeLessThan(0.005);
    expect(Array.from(new Rng(3).bits(64))).toEqual(Array.from(b.subarray(0, 64)));
    expect(new Rng(3).uniforme()).toBe(mulberry32(3)());
  });
});
