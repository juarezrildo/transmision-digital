import { describe, expect, it } from "vitest";
import { bitsACodigos, codigosABits, conversionAD, cuantificar, decodificar, sqnrDb, sqnrTeoricaDb } from "../pcm";
import { prepararCanales } from "../chain";
import { leerWav } from "../wav";
import { DUR, FS } from "../params";
import { leerReferencia, leerVozPrototipo } from "./referencia";

const ref = leerReferencia();

function senoPlenaEscala(): Float64Array {
  const n = DUR * FS;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = 0.999 * Math.sin((2 * Math.PI * 1013 * i) / FS);
  return x;
}

describe("PCM: cuantificador uniforme de media contrahuella", () => {
  it("niveles, recorte y decodificación coinciden con la definición", () => {
    const x = Float64Array.from([-1.5, -1, -0.0001, 0, 0.0001, 0.999, 1, 2]);
    const { codigos, valores } = cuantificar(x, 3);
    expect(Array.from(codigos)).toEqual([0, 0, 3, 4, 4, 7, 7, 7]);
    expect(Array.from(valores)).toEqual([-0.875, -0.875, -0.125, 0.125, 0.125, 0.875, 0.875, 0.875]);
    expect(Array.from(decodificar(codigos, 3))).toEqual(Array.from(valores));
  });

  it("el error de cuantificación está acotado por Δ/2 dentro del rango", () => {
    const x = new Float64Array(1000).map((_, i) => -1 + (2 * i) / 1000);
    for (const n of [6, 8, 10]) {
      const { valores } = cuantificar(x, n);
      const d = 2 / 2 ** n;
      for (let i = 0; i < x.length; i++) expect(Math.abs(x[i] - valores[i])).toBeLessThanOrEqual(d / 2 + 1e-12);
    }
  });

  it("códigos ↔ bits (MSB primero) es reversible", () => {
    const c = Int32Array.from([0, 1, 127, 128, 200, 255]);
    const b = codigosABits(c, 8);
    expect(Array.from(b.subarray(0, 16))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(Array.from(bitsACodigos(b, 8))).toEqual(Array.from(c));
  });

  it.each(ref.sqnr)("SQNR del seno a plena escala con N = $N: |sim − (6,02·N + 1,76)| < 0,5 dB", (fila) => {
    const x = senoPlenaEscala();
    const s = sqnrDb(x, cuantificar(x, fila.N).valores);
    expect(sqnrTeoricaDb(fila.N)).toBeCloseTo(fila.teorico, 10);
    expect(Math.abs(s - sqnrTeoricaDb(fila.N))).toBeLessThan(0.5);
    // mismo seno y mismo cuantificador que la referencia → mismo valor
    expect(Math.abs(s - fila.seno)).toBeLessThan(1e-6);
  });

  it("SQNR de la voz del prototipo (canales tras el A/D) coincide con Python", () => {
    const wav = leerWav(leerVozPrototipo());
    const muestras = prepararCanales(wav.muestras, wav.fs);
    // con 9,9 s de voz la selección de ventanas de 2 s sin solape de la referencia obtiene 3 canales
    expect(muestras).toHaveLength(3);
    expect(muestras[0]).toHaveLength(DUR * FS);
    for (const fila of ref.sqnr) {
      const sv = muestras.reduce((a, m) => a + sqnrDb(m, cuantificar(m, fila.N).valores), 0) / muestras.length;
      expect(Math.abs(sv - fila.voz)).toBeLessThan(0.05);
    }
  });

  it("la conversión A/D conserva un tono dentro de la banda de voz", () => {
    const n = 4000;
    const x = new Float64Array(n).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 1000 * i) / FS));
    const y = conversionAD(x);
    expect(y).toHaveLength(n);
    // lejos de los bordes, el tono de 1 kHz pasa casi sin cambios
    let e = 0;
    let s = 0;
    for (let i = 500; i < n - 500; i++) {
      e += (y[i] - x[i]) ** 2;
      s += x[i] ** 2;
    }
    expect(10 * Math.log10(s / e)).toBeGreaterThan(40);
  });
});
