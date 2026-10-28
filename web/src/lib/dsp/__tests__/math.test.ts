import { describe, expect, it } from "vitest";
import {
  anchoBandaPotencia,
  convolucion,
  dft,
  erfc,
  esPotenciaDe2,
  fft,
  filtrar,
  firPasabajos,
  funcionQ,
  hamming,
  hann,
  remuestrearFft,
  siguientePotenciaDe2,
  welch,
} from "../math";
import { Rng } from "../random";

function dftIngenua(re: Float64Array, im: Float64Array) {
  const n = re.length;
  const xr = new Float64Array(n);
  const xi = new Float64Array(n);
  for (let k = 0; k < n; k++)
    for (let t = 0; t < n; t++) {
      const a = (-2 * Math.PI * k * t) / n;
      xr[k] += re[t] * Math.cos(a) - im[t] * Math.sin(a);
      xi[k] += re[t] * Math.sin(a) + im[t] * Math.cos(a);
    }
  return { re: xr, im: xi };
}

describe("erfc y Q(x)", () => {
  it("erfc con error relativo < 10⁻⁶ frente a valores de referencia", () => {
    const tabla: [number, number][] = [
      [0, 1],
      [0.5, 0.4795001221869535],
      [1, 0.15729920705028513],
      [2, 0.004677734981047266],
      [3, 2.209049699858544e-5],
      [4, 1.541725790028002e-8],
      [-1, 1.8427007929497148],
    ];
    for (const [x, y] of tabla) expect(Math.abs(erfc(x) - y) / y).toBeLessThan(1e-6);
  });

  it("Q(x) = ½·erfc(x/√2)", () => {
    expect(funcionQ(0)).toBeCloseTo(0.5, 7);
    expect(Math.abs(funcionQ(4.753424308822899) - 1e-6) / 1e-6).toBeLessThan(1e-5);
    expect(funcionQ(-1) + funcionQ(1)).toBeCloseTo(1, 7);
  });
});

describe("FFT", () => {
  it("radix-2 coincide con la DFT directa y la inversa recupera la señal", () => {
    const rng = new Rng(1);
    const re = rng.gaussianas(64);
    const im = rng.gaussianas(64);
    const ref = dftIngenua(re, im);
    const r = Float64Array.from(re);
    const i = Float64Array.from(im);
    fft(r, i);
    for (let k = 0; k < 64; k++) {
      expect(r[k]).toBeCloseTo(ref.re[k], 9);
      expect(i[k]).toBeCloseTo(ref.im[k], 9);
    }
    fft(r, i, true);
    for (let k = 0; k < 64; k++) {
      expect(r[k]).toBeCloseTo(re[k], 12);
      expect(i[k]).toBeCloseTo(im[k], 12);
    }
  });

  it("Bluestein para largos arbitrarios (N = 1, 12, 100)", () => {
    const rng = new Rng(2);
    for (const n of [12, 100]) {
      const re = rng.gaussianas(n);
      const im = rng.gaussianas(n);
      const ref = dftIngenua(re, im);
      const x = dft(re, im);
      for (let k = 0; k < n; k++) {
        expect(x.re[k]).toBeCloseTo(ref.re[k], 8);
        expect(x.im[k]).toBeCloseTo(ref.im[k], 8);
      }
      const y = dft(x.re, x.im, true);
      for (let k = 0; k < n; k++) expect(y.re[k]).toBeCloseTo(re[k], 10);
    }
    const uno = dft(Float64Array.from([3]), Float64Array.from([0]));
    expect(uno.re[0]).toBe(3);
  });

  it("valida los argumentos y las utilidades de potencias de 2", () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
    expect(() => fft(new Float64Array(4), new Float64Array(2))).toThrow();
    expect(esPotenciaDe2(1024)).toBe(true);
    expect(esPotenciaDe2(1000)).toBe(false);
    expect(siguientePotenciaDe2(1000)).toBe(1024);
  });
});

describe("Welch y ventanas", () => {
  it("ventanas simétricas como numpy", () => {
    const w = hann(5);
    expect(Array.from(w)).toEqual([0, 0.5, 1, 0.5, 0].map((v) => expect.closeTo(v, 12)));
    expect(hamming(3)[0]).toBeCloseTo(0.08, 12);
    expect(hann(1)[0]).toBe(1);
    expect(hamming(1)[0]).toBe(1);
  });

  it("ruido blanco real de varianza σ²: DEP unilateral ≈ 2σ²/fs (Parseval)", () => {
    const fs = 1000;
    const x = new Rng(5).gaussianas(1 << 16);
    const { f, psd } = welch(x, fs, 1024);
    expect(f).toHaveLength(513);
    expect(f[512]).toBe(500);
    let m = 0;
    for (let k = 1; k < 512; k++) m += psd[k];
    m /= 511;
    expect(Math.abs(m - 2 / fs) / (2 / fs)).toBeLessThan(0.05);
  });

  it("señal compleja: espectro bilateral centrado con el tono en su frecuencia", () => {
    const fs = 1024;
    const n = 8192;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      re[i] = Math.cos((2 * Math.PI * 100 * i) / fs);
      im[i] = Math.sin((2 * Math.PI * 100 * i) / fs);
    }
    const { f, psd } = welch(re, fs, 256, im);
    expect(f[0]).toBe(-512);
    let kMax = 0;
    for (let k = 0; k < psd.length; k++) if (psd[k] > psd[kMax]) kMax = k;
    expect(f[kMax]).toBe(100);
    // largo no potencia de 2 y señal corta
    expect(welch(re.subarray(0, 300), fs, 300).f).toHaveLength(151);
    expect(welch(re.subarray(0, 100), fs, 256).f).toHaveLength(33);
  });

  it("ancho de banda por fracción de potencia", () => {
    const f = Float64Array.from([0, 1, 2, 3]);
    const p = Float64Array.from([0.5, 0.3, 0.15, 0.05]);
    expect(anchoBandaPotencia(f, p, 0.9)).toBe(2);
    expect(anchoBandaPotencia(f, p, 1.1)).toBe(3);
  });
});

describe("FIR, convolución y remuestreo", () => {
  it("FIR pasa bajos: Σh = 1, simétrico y atenúa fuera de banda", () => {
    const h = firPasabajos(3400, 64000, 511);
    expect(h.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(h[0]).toBeCloseTo(h[510], 15);
    const n = 8192;
    const x = new Float64Array(n).map((_, i) => Math.sin((2 * Math.PI * 8000 * i) / 64000));
    const y = filtrar(x, h);
    let p = 0;
    for (let i = 1000; i < n - 1000; i++) p += y[i] * y[i];
    expect(10 * Math.log10(p / ((n - 2000) / 2))).toBeLessThan(-50);
  });

  it("convolución completa y filtro con retardo compensado", () => {
    const y = convolucion(Float64Array.from([1, 0, 2]), Float64Array.from([1, 1]));
    expect(Array.from(y)).toEqual([1, 1, 2, 2]);
    expect(Array.from(filtrar(Float64Array.from([1, 2, 3]), Float64Array.from([0, 1, 0])))).toEqual([1, 2, 3]);
    expect(Array.from(filtrar(Float64Array.from([1, 2, 3, 4, 5]), Float64Array.from([0, 1, 0]), 2))).toEqual([1, 3, 5]);
  });

  it("interpolación por FFT reproduce un tono de banda limitada", () => {
    const n = 200;
    const x = new Float64Array(n).map((_, i) => Math.cos((2 * Math.PI * 7 * i) / n));
    const y = remuestrearFft(x, 8);
    expect(y).toHaveLength(1600);
    for (let m = 0; m < 1600; m += 37) expect(y[m]).toBeCloseTo(Math.cos((2 * Math.PI * 7 * m) / 1600), 9);
  });
});
