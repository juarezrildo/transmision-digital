import { describe, expect, it } from "vitest";
import { recolectarTransferibles } from "../transferibles";

describe("recolectarTransferibles", () => {
  it("encuentra cada buffer una sola vez, también detrás de vistas y anidado", () => {
    const a = new Float64Array(4);
    const b = new ArrayBuffer(8);
    const vista = a.subarray(1, 3);
    const lista = recolectarTransferibles({ a, otro: { vista, b, lista: [a, 3, "texto", null] } });
    expect(lista).toHaveLength(2);
    expect(lista).toContain(a.buffer);
    expect(lista).toContain(b);
  });

  it("sin buffers devuelve una lista vacía", () => {
    expect(recolectarTransferibles({ x: 1, y: [true, "a"] })).toEqual([]);
  });
});
