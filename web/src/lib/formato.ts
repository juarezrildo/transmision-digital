/**
 * Formato numérico de la interfaz: coma decimal y separador de miles de es-BO,
 * notación científica con superíndices (4,6·10⁻⁶) y potencias de diez.
 */

const LOCALE = "es-BO";
const formateadores = new Map<string, Intl.NumberFormat>();

function formateador(minimo: number, maximo: number, agrupar: boolean): Intl.NumberFormat {
  const clave = `${minimo}-${maximo}-${agrupar}`;
  let f = formateadores.get(clave);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: minimo,
      maximumFractionDigits: maximo,
      useGrouping: agrupar,
    });
    formateadores.set(clave, f);
  }
  return f;
}

/** Número con exactamente `decimales` cifras decimales: 10,53. */
export function formatoDecimal(x: number, decimales = 2): string {
  if (!Number.isFinite(x)) return "–";
  return formateador(decimales, decimales, true).format(x);
}

/** Número con hasta `maximo` decimales, sin ceros sobrantes: 0,5 · 12. */
export function formatoCompacto(x: number, maximo = 2): string {
  if (!Number.isFinite(x)) return "–";
  return formateador(0, maximo, true).format(x);
}

/** Entero con separador de miles: 640.000. */
export function formatoEntero(n: number): string {
  return formateador(0, 0, true).format(n);
}

const SUPERINDICES: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** Entero escrito en superíndice: −6 → ⁻⁶. */
export function superindice(n: number): string {
  return String(Math.round(n))
    .split("")
    .map((c) => SUPERINDICES[c] ?? c)
    .join("");
}

/** Potencia de diez: −6 → 10⁻⁶ (10⁰ se escribe 1). */
export function formatoPotencia10(exponente: number): string {
  return exponente === 0 ? "1" : `10${superindice(exponente)}`;
}

/**
 * Notación científica con coma decimal: 4,6·10⁻⁶. Entre 10⁻² y 10⁴ usa notación fija.
 * Si la mantisa es 1 se omite: 10⁻⁶.
 */
export function formatoCientifico(x: number, cifras = 2): string {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e-2 && a < 1e4) return formatoCompacto(x, Math.max(cifras, 2 - Math.floor(Math.log10(a))));
  const [mantisaTexto, exponenteTexto] = x.toExponential(cifras - 1).split("e");
  const mantisa = Number(mantisaTexto);
  const exponente = Number(exponenteTexto);
  if (Math.abs(mantisa) === 1) return `${mantisa < 0 ? "−" : ""}${formatoPotencia10(exponente)}`;
  return `${formatoDecimal(mantisa, cifras - 1)}·${formatoPotencia10(exponente)}`;
}

/** BER: 0 se muestra como 0, el resto en notación científica. */
export function formatoBer(ber: number): string {
  return ber === 0 ? "0" : formatoCientifico(ber, 2);
}
