import { describe, expect, it } from "vitest";
import { demultiplexar, multiplexar, sincronizar } from "../tdm";
import { BITS_TRAMA, RB, SYNC } from "../params";
import { Rng } from "../random";
import { leerReferencia } from "./referencia";

const ref = leerReferencia();

function canalesAleatorios(n: number, semilla: number): Int32Array[] {
  const rng = new Rng(semilla);
  return [0, 1, 2, 3].map(() => new Int32Array(n).map(() => Math.floor(rng.uniforme() * 256)));
}

describe("TDM: trama [SYNC | CH1 | CH2 | CH3 | CH4]", () => {
  it("40 bits por trama y 320 kbps", () => {
    expect(BITS_TRAMA).toBe(ref.tdm.bits_trama);
    expect(RB / 1e3).toBe(ref.tdm.Rb_kbps);
    expect(Array.from(SYNC).join("")).toBe("10011011");
  });

  it("multiplexar ubica SYNC y los canales MSB primero", () => {
    const c = [Int32Array.from([1]), Int32Array.from([128]), Int32Array.from([255]), Int32Array.from([0])];
    const b = multiplexar(c);
    expect(Array.from(b).join("")).toBe("10011011" + "00000001" + "10000000" + "11111111" + "00000000");
  });

  it("multiplexar → sincronizar → demultiplexar recupera los 4 canales", () => {
    const c = canalesAleatorios(2000, 11);
    const b = multiplexar(c);
    expect(b).toHaveLength(2000 * 40);
    const s = sincronizar(b);
    expect(s).toEqual({ desplazamiento: 0, calidad: 1 });
    const r = demultiplexar(b, s.desplazamiento);
    for (let k = 0; k < 4; k++) expect(Array.from(r[k])).toEqual(Array.from(c[k]));
  });

  it("la sincronía encuentra el inicio de trama con desfase y errores de bit", () => {
    const c = canalesAleatorios(1000, 12);
    const b = multiplexar(c);
    const rng = new Rng(99);
    for (const d of [1, 17, 39]) {
      const conDesfase = new Uint8Array(b.length + d);
      rng.bitsEn(conDesfase.subarray(0, d));
      conDesfase.set(b, d);
      for (let i = 0; i < conDesfase.length; i += 97) conDesfase[i] ^= 1; // ~1 % de errores
      const s = sincronizar(conDesfase);
      expect(s.desplazamiento).toBe(d);
      expect(s.calidad).toBeGreaterThan(0.95);
    }
  });

  it("menos de 4 canales: ranuras vacías en cero; casos límite", () => {
    const b = multiplexar([Int32Array.from([255])]);
    expect(Array.from(b.subarray(16))).toEqual(new Array(24).fill(0));
    expect(() => multiplexar([])).toThrow();
    expect(sincronizar(new Uint8Array(40))).toEqual({ desplazamiento: 0, calidad: 0 });
    expect(demultiplexar(new Uint8Array(10), 0)[0]).toHaveLength(0);
  });
});
