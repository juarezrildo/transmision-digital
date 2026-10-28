import { describe, expect, it } from "vitest";
import { formatoBer, formatoCientifico, formatoDecimal, formatoEntero, formatoPotencia10 } from "../formato";

describe("formato numérico es-BO", () => {
  it("coma decimal y punto de miles", () => {
    expect(formatoDecimal(10.5298, 2)).toBe("10,53");
    expect(formatoEntero(640000)).toBe("640.000");
  });

  it("notación científica con superíndices", () => {
    expect(formatoCientifico(4.6e-6)).toBe("4,6·10⁻⁶");
    expect(formatoCientifico(1e-6)).toBe("10⁻⁶");
    expect(formatoPotencia10(-7)).toBe("10⁻⁷");
    expect(formatoPotencia10(0)).toBe("1");
  });

  it("BER: cero y valores intermedios", () => {
    expect(formatoBer(0)).toBe("0");
    expect(formatoBer(0.0785)).toBe("0,0785");
    expect(formatoBer(1.734375e-4)).toBe("1,7·10⁻⁴");
  });
});
