import { describe, expect, it } from "vitest";
import { escribirWav, leerWav } from "../wav";
import { leerVozPrototipo } from "./referencia";

describe("WAV PCM", () => {
  it("lee voz_prototipo.wav (8 kHz, 8 bits, mono)", () => {
    const w = leerWav(leerVozPrototipo());
    expect(w.fs).toBe(8000);
    expect(w.canales).toBe(1);
    expect(w.bitsPorMuestra).toBe(8);
    expect(w.muestras).toHaveLength(79189);
    expect(w.muestras.every((v) => v >= -1 && v < 1)).toBe(true);
  });

  it("8 bits: escribir → leer conserva el código (b = ⌊(x + 1)·127,5⌋)", () => {
    const x = Float64Array.from([-1, -0.5, 0, 0.5, 0.999, 2, -3]);
    const w = leerWav(escribirWav(x, 8000, 8));
    const esperado = [0, 63, 127, 191, 254, 255, 0].map((b) => (b - 128) / 128);
    expect(Array.from(w.muestras)).toEqual(esperado);
  });

  it("16 bits: ida y vuelta con error ≤ ½·2⁻¹⁵", () => {
    const x = new Float64Array(1000).map((_, i) => 0.9 * Math.sin(i / 10));
    const w = leerWav(escribirWav(x, 16000, 16));
    expect(w.fs).toBe(16000);
    expect(w.bitsPorMuestra).toBe(16);
    for (let i = 0; i < x.length; i++) expect(Math.abs(w.muestras[i] - x[i])).toBeLessThanOrEqual(0.5 / 32768 + 1e-12);
    const sat = leerWav(escribirWav(Float64Array.from([5, -5]), 8000, 16)).muestras;
    expect(Array.from(sat)).toEqual([32767 / 32768, -1]);
  });

  it("estéreo: promedio de canales y bloques extra con relleno impar", () => {
    const datos = [1000, -1000, 3000, 1000];
    const buf = new ArrayBuffer(12 + 8 + 16 + 8 + 3 + 1 + 8 + 8);
    const v = new DataView(buf);
    const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    txt(0, "RIFF");
    v.setUint32(4, buf.byteLength - 8, true);
    txt(8, "WAVE");
    txt(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 2, true);
    v.setUint32(24, 44100, true);
    v.setUint16(34, 16, true);
    txt(36, "LIST");
    v.setUint32(40, 3, true); // bloque impar → 1 byte de relleno
    txt(48, "data");
    v.setUint32(52, 8, true);
    datos.forEach((d, i) => v.setInt16(56 + 2 * i, d, true));
    const w = leerWav(buf);
    expect(w.canales).toBe(2);
    expect(w.fs).toBe(44100);
    expect(Array.from(w.muestras)).toEqual([0, 2000 / 32768]);
  });

  it("rechaza archivos no válidos o no soportados", () => {
    expect(() => leerWav(new ArrayBuffer(4))).toThrow();
    const sinData = escribirWav(new Float64Array(2), 8000).slice(0, 36);
    expect(() => leerWav(sinData)).toThrow();
    const b24 = escribirWav(new Float64Array(4), 8000, 16);
    new DataView(b24).setUint16(34, 24, true);
    expect(() => leerWav(b24)).toThrow(/8 o 16/);
    const flotante = escribirWav(new Float64Array(4), 8000, 16);
    new DataView(flotante).setUint16(20, 3, true);
    expect(() => leerWav(flotante)).toThrow(/PCM/);
  });
});
