import { describe, expect, it } from "vitest";
import { cadenaCompleta, prepararCanales, remuestrear, seleccionarCanales, simularCadena } from "../chain";
import { berTeorica } from "../ber";
import { MODULACIONES } from "../modulation";
import { leerWav } from "../wav";
import { DUR, FS } from "../params";
import { leerReferencia, leerVozPrototipo } from "./referencia";

const ref = leerReferencia();
const wav = leerWav(leerVozPrototipo());
const muestras = prepararCanales(wav.muestras, wav.fs);

function filaCadena(mod: string, e: number | "sin ruido") {
  const f = ref.cadena.find((c) => c.mod === mod && c.EbN0_dB === e);
  if (!f) throw new Error(`${mod} ${e}`);
  return f;
}

describe("Cadena completa voz → … → voz", () => {
  it.each(MODULACIONES)("%s sin ruido: canales bit a bit idénticos, BER = 0", (mod) => {
    const r = simularCadena({ muestras, mod, ebN0Db: null });
    const py = filaCadena(mod, "sin ruido");
    expect(r.canalesIdenticos).toBe(true);
    expect(r.errores).toBe(0);
    expect(r.ber).toBe(0);
    expect(r.erroresCable).toBe(ref.tramo_cable.errores);
    expect(r.bits).toBe(py.bits);
    expect(r.desplazamientoTrama).toBe(py.desplazamiento_trama);
    expect(r.calidadSincronia).toBe(1);
    expect(Math.abs(r.snrSalidaDb - py.SNR_salida_dB)).toBeLessThan(0.05);
    expect(r.vozRecuperada).toHaveLength(4);
    for (let c = 0; c < muestras.length; c++) expect(Array.from(r.vozRecuperada[c])).toEqual(Array.from(r.vozPcm[c]));
    expect(r.constelacion.re).toHaveLength(3000);
  });

  it("detecta el desplazamiento de trama cuando el flujo llega desfasado", () => {
    const r = simularCadena({ muestras, mod: "QPSK", ebN0Db: 12, desfaseBits: 13, semilla: 5 });
    expect(r.desplazamientoTrama).toBe(13);
    expect(r.calidadSincronia).toBeGreaterThan(0.999);
    expect(r.snrSalidaDb).toBeGreaterThan(40);
  });

  it.each([
    ["QPSK", 8],
    ["BPSK", 6],
    ["16-QAM", 10],
  ] as const)("%s a %i dB: BER cercana a la teoría y SNR de salida como Python", (mod, e) => {
    const r = simularCadena({ muestras, mod, ebN0Db: e, semilla: 2026 });
    const py = filaCadena(mod, e);
    const teo = berTeorica(mod, e);
    expect(r.desplazamientoTrama).toBe(0);
    expect(r.canalesIdenticos).toBe(false);
    expect(Math.abs(r.ber - teo) / teo).toBeLessThan(0.3);
    expect(Math.abs(r.snrSalidaDb - py.SNR_salida_dB)).toBeLessThan(3);
  });

  it("cadenaCompleta acepta un buffer de voz a otra frecuencia de muestreo", () => {
    const r = cadenaCompleta(remuestrear(wav.muestras, 8000, 16000), 16000, "16-QAM", null);
    expect(r.muestras).toHaveLength(3);
    expect(r.canalesIdenticos).toBe(true);
    expect(r.snrSalidaDb).toBeGreaterThan(35);
  });
});

describe("Selección de canales y remuestreo", () => {
  it("elige ventanas de 2 s sin solape y normaliza a pico 0,95", () => {
    const c = seleccionarCanales(wav.muestras);
    expect(c).toHaveLength(3);
    for (const x of c) {
      expect(x).toHaveLength(DUR * FS);
      expect(Math.max(...Array.from(x, Math.abs))).toBeCloseTo(0.95, 12);
    }
  });

  it("voz más corta que una ventana: se divide en partes iguales", () => {
    const corta = new Float64Array(8000).map((_, i) => Math.sin(i / 7));
    const c = seleccionarCanales(corta);
    expect(c).toHaveLength(4);
    expect(c[0]).toHaveLength(2000);
    const r = simularCadena({ muestras: c, mod: "BPSK", ebN0Db: null });
    expect(r.canalesIdenticos).toBe(true);
  });

  it("remuestrear conserva un tono", () => {
    const x = new Float64Array(4800).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000));
    const y = remuestrear(x, 48000, 8000);
    expect(y).toHaveLength(800);
    for (let m = 100; m < 700; m += 50) expect(y[m]).toBeCloseTo(Math.sin((2 * Math.PI * 440 * m) / 8000), 1);
    expect(remuestrear(x, 8000, 8000)).toEqual(x);
  });
});
