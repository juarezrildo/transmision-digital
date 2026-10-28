import { describe, expect, it } from "vitest";
import { constelacionRecibida, espectroBandaBase, espectroPasoBanda, formaOndaPasoBanda, senalPasoBanda } from "../passband";
import { anchoBanda, MODULACIONES } from "../modulation";
import { berTeorica } from "../ber";
import { FC } from "../params";

function fraccionEnBanda(f: Float64Array, psd: Float64Array, f0: number, f1: number): number {
  let dentro = 0;
  let total = 0;
  for (let i = 0; i < f.length; i++) {
    total += psd[i];
    if (f[i] >= f0 && f[i] <= f1) dentro += psd[i];
  }
  return dentro / total;
}

describe("Espectros", () => {
  it.each(MODULACIONES)("%s paso banda: ≥ 99 % de la potencia en fc ± B/2", (mod) => {
    const e = espectroPasoBanda(mod);
    expect(e.anchoBandaHz).toBe(anchoBanda(mod));
    expect(fraccionEnBanda(e.f, e.psd, FC - e.anchoBandaHz / 2, FC + e.anchoBandaHz / 2)).toBeGreaterThan(0.99);
    expect(Math.max(...e.psdDbNorm)).toBeCloseTo(0, 9);
  });

  it("solo QPSK y 16-QAM caben en la máscara de 250 kHz", () => {
    const fuera = MODULACIONES.map((mod) => {
      const e = espectroPasoBanda(mod, { nperseg: 2048 });
      return 1 - fraccionEnBanda(e.f, e.psd, FC - 125e3, FC + 125e3);
    });
    expect(fuera[0]).toBeGreaterThan(0.05);
    expect(fuera[1]).toBeLessThan(0.01);
    expect(fuera[2]).toBeLessThan(0.01);
  });

  it("señal paso banda: largo = nSim·sps + L − 1 con sps = round(fs/Rs)", () => {
    const s = senalPasoBanda("QPSK", { bits: new Uint8Array(4000).fill(1) });
    expect(s).toHaveLength(2000 * 32 + 8 * 32);
  });

  it("banda base equivalente: el ruido eleva el piso del espectro", () => {
    const limpio = espectroBandaBase("QPSK", null, 4000);
    const ruidoso = espectroBandaBase("QPSK", 4, 4000);
    expect(limpio.f[0]).toBeLessThan(0);
    const borde = limpio.f.length - 5;
    expect(ruidoso.psdDbNorm[borde]).toBeGreaterThan(limpio.psdDbNorm[borde] + 10);
  });
});

describe("Forma de onda y constelación", () => {
  it("forma de onda paso banda con I/Q y bits mostrados", () => {
    const w = formaOndaPasoBanda("BPSK", 6);
    expect(w.s).toHaveLength(6 * 16);
    expect(w.t[1]).toBeCloseTo(1 / 5.12e6, 15);
    expect(w.bits).toHaveLength(6);
    // en el instante de muestreo, el signo de I coincide con el bit (BPSK sin ruido)
    for (let i = 0; i < 6; i++) expect(Math.sign(w.i[i * 16 + 8])).toBe(w.bits[i] ? 1 : -1);
    const r = formaOndaPasoBanda("16-QAM", 4, { ebN0Db: 10, fc: 200e3 });
    expect(r.bits).toHaveLength(16);
  });

  it.each(MODULACIONES)("%s: constelación sin ruido sobre los puntos ideales", (mod) => {
    const c = constelacionRecibida(mod, null, 500);
    expect(c.errores).toBe(0);
    for (let i = 0; i < c.recibida.re.length; i++) {
      let d = Infinity;
      for (let j = 0; j < c.ideal.re.length; j++)
        d = Math.min(d, Math.hypot(c.recibida.re[i] - c.ideal.re[j], c.recibida.im[i] - c.ideal.im[j]));
      expect(d).toBeLessThan(0.05);
    }
  });

  it("constelación con ruido: BER medida del orden de la teórica", () => {
    const c = constelacionRecibida("QPSK", 4, 20000);
    const teo = berTeorica("QPSK", 4);
    expect(Math.abs(c.ber - teo) / teo).toBeLessThan(0.3);
  });
});
