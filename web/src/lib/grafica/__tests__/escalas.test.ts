import { describe, expect, it } from "vitest";
import { crearEscala, decimalesDePaso, decimarMinMax, marcasLineales, marcasLog, pasoRedondo } from "../escalas";

describe("escalas de las gráficas", () => {
  it("escala lineal con el eje y invertido", () => {
    const e = crearEscala("lineal", [0, 20], [300, 0]);
    expect(e.aPixel(0)).toBe(300);
    expect(e.aPixel(20)).toBe(0);
    expect(e.aPixel(10)).toBe(150);
  });

  it("escala logarítmica: décadas equiespaciadas y NaN para valores ≤ 0", () => {
    const e = crearEscala("log", [1e-8, 1], [0, 800]);
    expect(e.aPixel(1e-8)).toBeCloseTo(0);
    expect(e.aPixel(1e-4)).toBeCloseTo(400);
    expect(Number.isNaN(e.aPixel(0))).toBe(true);
  });

  it("pasos redondos 1-2-5 y sus decimales", () => {
    expect(pasoRedondo(20, 5)).toBe(5);
    expect(pasoRedondo(800, 8)).toBe(100);
    expect(pasoRedondo(3.6, 6)).toBe(0.5);
    expect(decimalesDePaso(0.5)).toBe(1);
    expect(decimalesDePaso(0.2)).toBe(1);
    expect(decimalesDePaso(5)).toBe(0);
  });

  it("marcas lineales dentro del dominio", () => {
    expect(marcasLineales(-1.8, 1.8, 6).valores).toEqual([-1.5, -1, -0.5, 0, 0.5, 1, 1.5]);
    expect(marcasLineales(0, 16, 8).valores).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16]);
  });

  it("marcas logarítmicas por décadas", () => {
    const m = marcasLog(1e-8, 1);
    expect(m.decadas).toEqual([-8, -7, -6, -5, -4, -3, -2, -1, 0]);
    expect(m.menores).toHaveLength(8 * 8);
  });

  it("la decimación mín-máx conserva los picos y el orden", () => {
    const n = 10000;
    const x = Float64Array.from({ length: n }, (_, i) => i);
    const y = new Float64Array(n);
    y[4321] = 1;
    y[7000] = -1;
    const indices = decimarMinMax(x, y, 0, n, 100);
    expect(indices.length).toBeLessThanOrEqual(200);
    expect(indices).toContain(4321);
    expect(indices).toContain(7000);
    for (let i = 1; i < indices.length; i++) expect(indices[i]).toBeGreaterThan(indices[i - 1]);
  });

  it("sin decimación cuando hay pocos puntos", () => {
    expect(decimarMinMax([0, 1, 2], [3, 4, 5], 0, 2, 100)).toEqual([0, 1, 2]);
  });
});
