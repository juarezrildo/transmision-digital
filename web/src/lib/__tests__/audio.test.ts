import { describe, expect, it } from "vitest";
import { escribirWav, leerWav } from "@/lib/dsp";
import { wavADataUrl } from "../audio";

describe("wavADataUrl", () => {
  it("codifica el WAV completo en base64 y se puede volver a leer", () => {
    const x = Float64Array.from({ length: 70000 }, (_, i) => Math.sin(i / 10) * 0.5);
    const wav = escribirWav(x, 8000, 16);
    const url = wavADataUrl(wav);
    expect(url.startsWith("data:audio/wav;base64,")).toBe(true);
    const bytes = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    const leido = leerWav(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(leido.fs).toBe(8000);
    expect(leido.muestras.length).toBe(x.length);
  });
});
