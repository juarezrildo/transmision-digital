import { describe, expect, it } from "vitest";
import { tablaModulaciones } from "@/lib/dsp";
import { recomendarModulacion } from "../recomendacion";

describe("recomendarModulacion", () => {
  it("con la tabla del motor elige QPSK, deja 16-QAM como alternativa y descarta BPSK", () => {
    const r = recomendarModulacion(tablaModulaciones());
    expect(r.elegida?.mod).toBe("QPSK");
    expect(r.alternativas.map((f) => f.mod)).toEqual(["16-QAM"]);
    expect(r.descartadas.map((f) => f.mod)).toEqual(["BPSK"]);
  });

  it("sin ninguna modulación que quepa no recomienda nada", () => {
    const filas = tablaModulaciones().map((f) => ({ ...f, cumpleB: false }));
    expect(recomendarModulacion(filas).elegida).toBeNull();
  });
});
