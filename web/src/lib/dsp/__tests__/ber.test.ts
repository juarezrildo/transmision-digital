import { describe, expect, it } from "vitest";
import {
  berMonteCarlo,
  berTeorica,
  cnRequeridoDb,
  curvaBerMonteCarlo,
  curvaBerTeorica,
  ebN0Requerido,
  tablaModulaciones,
} from "../ber";
import { canalAwgn, n0DesdeEbN0 } from "../channel";
import { MODULACIONES } from "../modulation";
import { Rng } from "../random";
import { leerReferencia } from "./referencia";

const ref = leerReferencia();

describe("BER teórica y Eb/N0 requerido", () => {
  it("valores conocidos de Pb", () => {
    // valores de ber_teorica() en sistema.py (error relativo < 10⁻⁶)
    expect(Math.abs(berTeorica("BPSK", 0) / 0.07864960352514255 - 1)).toBeLessThan(1e-6);
    expect(Math.abs(berTeorica("BPSK", 8) / 0.00019090777407599314 - 1)).toBeLessThan(1e-6);
    expect(berTeorica("QPSK", 0)).toBe(berTeorica("BPSK", 0));
    expect(Math.abs(berTeorica("16-QAM", 10) / 0.0017541506178927245 - 1)).toBeLessThan(1e-6);
    const c = curvaBerTeorica("BPSK", Float64Array.from([0, 4, 8]));
    expect(c[1]).toBe(berTeorica("BPSK", 4));
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeLessThan(c[i - 1]);
  });

  it("Eb/N0 requerido para 10⁻⁶: 10,53 / 10,53 / 14,40 dB (± 0,05)", () => {
    const esperado = { BPSK: 10.53, QPSK: 10.53, "16-QAM": 14.4 } as const;
    for (const mod of MODULACIONES) expect(Math.abs(ebN0Requerido(mod) - esperado[mod])).toBeLessThan(0.05);
  });

  it.each(ref.modulaciones)("$mod: tabla de diseño igual a la referencia en Python", (fila) => {
    const t = tablaModulaciones().find((r) => r.mod === fila.mod);
    if (!t) throw new Error(fila.mod);
    expect(Math.abs(t.ebN0ReqDb - fila.EbN0_req_dB)).toBeLessThan(0.05);
    expect(Math.abs(t.ebN0ReqDb - fila.EbN0_req_dB)).toBeLessThan(1e-4); // misma erfc a 10⁻⁷
    expect(t.bKHz).toBe(fila.B_kHz);
    expect(t.rsKbaud).toBe(fila.Rs_kbaud);
    expect(t.cumpleB).toBe(fila.cumple_B);
    expect(t.eficiencia).toBeCloseTo(fila.eficiencia, 12);
    expect(Math.abs(t.cnReqDb - fila.CN_req_dB)).toBeLessThan(1e-3);
    expect(cnRequeridoDb(10, 2, 1)).toBeCloseTo(10 + 10 * Math.log10(2), 12);
  });

  it("recomendación: QPSK y 16-QAM cumplen B ≤ 250 kHz; con 12 dB solo BPSK/QPSK cumplen BER", () => {
    const t = tablaModulaciones(12);
    expect(t.map((r) => r.cumpleB)).toEqual([false, true, true]);
    expect(t.map((r) => r.cumpleBer)).toEqual([true, true, false]);
    expect(tablaModulaciones().every((r) => r.cumpleBer)).toBe(true);
  });
});

describe("Canal AWGN", () => {
  it("N0 = 1/(k·Eb/N0) y varianza compleja N0 por muestra", () => {
    expect(n0DesdeEbN0(0, 2)).toBe(0.5);
    const n = 200000;
    const x = { re: new Float64Array(n), im: new Float64Array(n) };
    const r = canalAwgn(x, 3, 2, new Rng(1));
    let p = 0;
    for (let i = 0; i < n; i++) p += r.re[i] ** 2 + r.im[i] ** 2;
    expect(Math.abs(p / n - n0DesdeEbN0(3, 2)) / n0DesdeEbN0(3, 2)).toBeLessThan(0.02);
    const limpio = canalAwgn(x, null, 2, new Rng(1));
    expect(limpio.re).not.toBe(x.re);
    expect(limpio.re.every((v) => v === 0)).toBe(true);
  });
});

describe("BER Monte Carlo (10⁶ bits)", () => {
  const puntos = MODULACIONES.flatMap((mod) => [4, 6, 8].map((e) => ({ mod, e })));

  it.each(puntos)("$mod a $e dB: dentro de ±20 % de la teoría", ({ mod, e }) => {
    const t0 = performance.now();
    const r = berMonteCarlo({ mod, ebN0Db: e, nBits: 1_000_000, semilla: 2026 });
    const dt = performance.now() - t0;
    expect(r.bits).toBeGreaterThanOrEqual(1_000_000);
    const teo = berTeorica(mod, e);
    expect(Math.abs(r.ber - teo) / teo).toBeLessThan(0.2);
    expect(dt).toBeLessThan(2000);
  });

  it("coincide con las curvas Monte Carlo de la referencia (±20 %)", () => {
    const ejes = ref.ber_curvas.EbN0_dB as number[];
    for (const mod of MODULACIONES) {
      for (const e of [4, 6, 8]) {
        const py = ref.ber_curvas[mod][ejes.indexOf(e)];
        if (py === null) throw new Error("sin dato");
        const r = berMonteCarlo({ mod, ebN0Db: e, semilla: 7 });
        expect(Math.abs(r.ber - py) / py).toBeLessThan(0.2);
      }
    }
  });

  it("parada por número de errores, bloques parciales y curva", () => {
    const r = berMonteCarlo({ mod: "QPSK", ebN0Db: 0, nBits: 10_000_000, minErrores: 500 });
    expect(r.errores).toBeGreaterThanOrEqual(500);
    expect(r.bits).toBeLessThan(10_000_000);
    const p = berMonteCarlo({ mod: "16-QAM", ebN0Db: 4, nBits: 1001, bloque: 256 });
    expect(p.bits).toBe(1004);
    const c = curvaBerMonteCarlo("BPSK", [0, 20], 20000);
    expect(c[0].simulada).not.toBeNull();
    expect(c[1].simulada).toBeNull();
    expect(c[1].teorica).toBe(berTeorica("BPSK", 20));
  });
});
