import { describe, expect, it } from "vitest";
import { CODIGOS_LINEA, codificarLinea, componenteDc, decodificarLinea } from "../lineCodes";
import { Rng } from "../random";
import { leerReferencia } from "./referencia";

const ref = leerReferencia();
const bits = new Rng(2026).bits(200000);

function filaRef(codigo: string) {
  const fila = ref.codigos_linea.find((c) => c.codigo === codigo);
  if (!fila) throw new Error(`sin referencia para ${codigo}`);
  return fila;
}

describe("Códigos de línea", () => {
  it("formas de onda de referencia (2 muestras por bit)", () => {
    const b = Uint8Array.from([1, 0, 1, 1]);
    expect(Array.from(codificarLinea(b, "NRZ unipolar", 2))).toEqual([1, 1, 0, 0, 1, 1, 1, 1]);
    expect(Array.from(codificarLinea(b, "NRZ polar", 2))).toEqual([1, 1, -1, -1, 1, 1, 1, 1]);
    // IEEE 802.3: 1 = subida (−1 → +1), 0 = bajada (+1 → −1)
    expect(Array.from(codificarLinea(b, "Manchester", 2))).toEqual([-1, 1, 1, -1, -1, 1, -1, 1]);
    expect(Array.from(codificarLinea(b, "AMI", 2))).toEqual([1, 1, 0, 0, -1, -1, 1, 1]);
  });

  it.each(CODIGOS_LINEA)("%s: decodificación sin ruido sin errores", (tipo) => {
    for (const spb of [8, 16]) {
      const x = codificarLinea(bits, tipo, spb);
      expect(x).toHaveLength(bits.length * spb);
      const r = decodificarLinea(x, tipo, spb);
      let e = 0;
      for (let i = 0; i < bits.length; i++) if (r[i] !== bits[i]) e++;
      expect(e).toBe(filaRef(tipo).errores_sin_ruido);
    }
  });

  it.each(["Manchester", "AMI"] as const)("%s sin componente DC (|media| < 10⁻³)", (tipo) => {
    const dc = componenteDc(codificarLinea(bits, tipo, 16));
    expect(Math.abs(dc)).toBeLessThan(1e-3);
    expect(Math.abs(dc - filaRef(tipo).DC)).toBeLessThan(1e-3);
  });

  it("NRZ unipolar sí tiene DC (≈ 0,5 con bits equiprobables)", () => {
    expect(componenteDc(codificarLinea(bits, "NRZ unipolar", 16))).toBeCloseTo(0.5, 2);
    expect(componenteDc(new Float64Array(0))).toBe(0);
  });
});
