/**
 * Utilidades matemáticas: erfc, Q(x), FFT (radix-2 y Bluestein), Welch, FIR y remuestreo.
 * Sin dependencias externas; todas las señales en Float64Array.
 */

/** Par de vectores (parte real e imaginaria) de una señal compleja. */
export interface Complejo {
  re: Float64Array;
  im: Float64Array;
}

/**
 * Función de error complementaria erfc(x) = (2/√π)·∫ₓ^∞ e^(−t²) dt.
 * Aproximación de Chebyshev (Numerical Recipes, erfcc): error relativo < 1,2·10⁻⁷ en todo x,
 * mejor que Abramowitz-Stegun 7.1.26 en las colas (BER ≈ 10⁻⁶).
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Función Q gaussiana: Q(x) = ½·erfc(x/√2). */
export function funcionQ(x: number): number {
  return 0.5 * erfc(x / Math.SQRT2);
}

/** Indica si n es potencia de 2. */
export function esPotenciaDe2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** Menor potencia de 2 mayor o igual que n. */
export function siguientePotenciaDe2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

interface TablaFft {
  cos: Float64Array;
  sin: Float64Array;
  rev: Uint32Array;
}
const tablas = new Map<number, TablaFft>();

function tablaFft(n: number): TablaFft {
  let t = tablas.get(n);
  if (t) return t;
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  let bitsN = 0;
  while (1 << bitsN < n) bitsN++;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bitsN; b++) r |= ((i >>> b) & 1) << (bitsN - 1 - b);
    rev[i] = r;
  }
  t = { cos, sin, rev };
  if (tablas.size > 16) tablas.clear();
  tablas.set(n, t);
  return t;
}

/**
 * FFT radix-2 en el lugar: X[k] = Σ x[n]·e^(−j2πkn/N) (directa) o
 * x[n] = (1/N)·Σ X[k]·e^(+j2πkn/N) (inversa). N debe ser potencia de 2.
 */
export function fft(re: Float64Array, im: Float64Array, inversa = false): void {
  const n = re.length;
  if (n !== im.length) throw new Error("fft: re e im deben tener el mismo largo");
  if (!esPotenciaDe2(n)) throw new Error("fft: el largo debe ser potencia de 2");
  if (n === 1) return;
  const { cos, sin, rev } = tablaFft(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let tmp = re[i];
      re[i] = re[j];
      re[j] = tmp;
      tmp = im[i];
      im[i] = im[j];
      im[j] = tmp;
    }
  }
  const signo = inversa ? 1 : -1;
  for (let tam = 2; tam <= n; tam <<= 1) {
    const mitad = tam >>> 1;
    const paso = n / tam;
    for (let i = 0; i < n; i += tam) {
      for (let k = 0; k < mitad; k++) {
        const wr = cos[k * paso];
        const wi = signo * sin[k * paso];
        const a = i + k;
        const b = a + mitad;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  if (inversa) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/**
 * DFT de largo arbitrario (radix-2 si N es potencia de 2; si no, algoritmo de Bluestein:
 * X[k] = w[k]·Σ (x[n]·w[n])·w*[k−n], con w[n] = e^(−jπn²/N)). Devuelve un vector nuevo.
 */
export function dft(re: Float64Array, im: Float64Array, inversa = false): Complejo {
  const n = re.length;
  if (esPotenciaDe2(n)) {
    const r = Float64Array.from(re);
    const i = Float64Array.from(im);
    fft(r, i, inversa);
    return { re: r, im: i };
  }
  const m = siguientePotenciaDe2(2 * n - 1);
  const s = inversa ? 1 : -1;
  const wr = new Float64Array(n);
  const wi = new Float64Array(n);
  const dosN = 2 * n;
  for (let k = 0; k < n; k++) {
    const k2 = (k * k) % dosN; // k² mod 2N mantiene la precisión del ángulo
    const ang = (s * Math.PI * k2) / n;
    wr[k] = Math.cos(ang);
    wi[k] = Math.sin(ang);
  }
  const ar = new Float64Array(m);
  const ai = new Float64Array(m);
  for (let k = 0; k < n; k++) {
    ar[k] = re[k] * wr[k] - im[k] * wi[k];
    ai[k] = re[k] * wi[k] + im[k] * wr[k];
  }
  const br = new Float64Array(m);
  const bi = new Float64Array(m);
  br[0] = wr[0];
  bi[0] = -wi[0];
  for (let k = 1; k < n; k++) {
    br[k] = br[m - k] = wr[k];
    bi[k] = bi[m - k] = -wi[k];
  }
  fft(ar, ai);
  fft(br, bi);
  for (let k = 0; k < m; k++) {
    const r = ar[k] * br[k] - ai[k] * bi[k];
    ai[k] = ar[k] * bi[k] + ai[k] * br[k];
    ar[k] = r;
  }
  fft(ar, ai, true);
  const xr = new Float64Array(n);
  const xi = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const r = ar[k] * wr[k] - ai[k] * wi[k];
    const i = ar[k] * wi[k] + ai[k] * wr[k];
    xr[k] = inversa ? r / n : r;
    xi[k] = inversa ? i / n : i;
  }
  return { re: xr, im: xi };
}

/** Ventana de Hann simétrica (como numpy.hanning): w[n] = 0,5 − 0,5·cos(2πn/(N−1)). */
export function hann(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1;
    return w;
  }
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/** Ventana de Hamming simétrica (como numpy.hamming): w[n] = 0,54 − 0,46·cos(2πn/(N−1)). */
export function hamming(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1;
    return w;
  }
  for (let i = 0; i < n; i++) w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/** Resultado de una estimación espectral: frecuencias (Hz) y DEP (unidades²/Hz). */
export interface Espectro {
  f: Float64Array;
  psd: Float64Array;
}

/**
 * Densidad espectral de potencia por Welch (Hann, 50 % de solape):
 * psd(f) = ⟨|FFT(x·w)|²⟩ / (fs·Σw²). Señal real → unilateral (×2 salvo DC y Nyquist);
 * señal compleja (im ≠ undefined) → bilateral centrada en 0 (fftshift).
 */
export function welch(x: Float64Array, fs: number, nperseg = 4096, im?: Float64Array): Espectro {
  let nseg = nperseg;
  if (x.length < nseg) nseg = Math.max(2, 1 << Math.floor(Math.log2(Math.max(2, x.length))));
  const w = hann(nseg);
  let sw2 = 0;
  for (let i = 0; i < nseg; i++) sw2 += w[i] * w[i];
  const paso = Math.floor(nseg / 2);
  const acc = new Float64Array(nseg);
  const re = new Float64Array(nseg);
  const ii = new Float64Array(nseg);
  let cuenta = 0;
  const pot2 = esPotenciaDe2(nseg);
  for (let ini = 0; ini + nseg <= x.length; ini += paso) {
    for (let k = 0; k < nseg; k++) {
      re[k] = x[ini + k] * w[k];
      ii[k] = im ? im[ini + k] * w[k] : 0;
    }
    let specRe: Float64Array = re;
    let specIm: Float64Array = ii;
    if (pot2) fft(re, ii);
    else ({ re: specRe, im: specIm } = dft(re, ii));
    for (let k = 0; k < nseg; k++) acc[k] += specRe[k] * specRe[k] + specIm[k] * specIm[k];
    cuenta++;
  }
  const esc = 1 / (Math.max(cuenta, 1) * fs * sw2);
  if (!im) {
    const m = Math.floor(nseg / 2) + 1;
    const f = new Float64Array(m);
    const psd = new Float64Array(m);
    for (let k = 0; k < m; k++) {
      f[k] = (k * fs) / nseg;
      psd[k] = acc[k] * esc * (k === 0 || (nseg % 2 === 0 && k === m - 1) ? 1 : 2);
    }
    return { f, psd };
  }
  const f = new Float64Array(nseg);
  const psd = new Float64Array(nseg);
  const h = Math.floor(nseg / 2);
  for (let i = 0; i < nseg; i++) {
    const k = (i + nseg - h) % nseg;
    f[i] = ((k < nseg - h ? k : k - nseg) * fs) / nseg;
    psd[i] = acc[k] * esc;
  }
  return { f, psd };
}

/**
 * Ancho de banda que contiene la fracción `frac` de la potencia:
 * menor f tal que Σ psd(≤ f) / Σ psd ≥ frac (como searchsorted de la suma acumulada).
 */
export function anchoBandaPotencia(f: Float64Array, psd: Float64Array, frac = 0.99): number {
  let total = 0;
  for (let i = 0; i < psd.length; i++) total += psd[i];
  let acc = 0;
  for (let i = 0; i < psd.length; i++) {
    acc += psd[i];
    if (acc / total >= frac) return f[i];
  }
  return f[f.length - 1];
}

/**
 * FIR pasa bajos por ventana de Hamming: h[k] = (2fc/fs)·sinc(2fc/fs·(k − (n−1)/2))·w[k], normalizado a Σh = 1.
 */
export function firPasabajos(fc: number, fs: number, n = 255): Float64Array {
  const w = hamming(n);
  const h = new Float64Array(n);
  const r = (2 * fc) / fs;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const k = i - (n - 1) / 2;
    const a = Math.PI * r * k;
    h[i] = r * (k === 0 ? 1 : Math.sin(a) / a) * w[i];
    s += h[i];
  }
  for (let i = 0; i < n; i++) h[i] /= s;
  return h;
}

/** Convolución lineal completa y[n] = Σ h[k]·x[n − k], largo len(x) + len(h) − 1. */
export function convolucion(x: Float64Array, h: Float64Array): Float64Array {
  const y = new Float64Array(x.length + h.length - 1);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    if (xi === 0) continue;
    for (let k = 0; k < h.length; k++) y[i + k] += xi * h[k];
  }
  return y;
}

/**
 * Filtro FIR de fase lineal compensando el retardo de grupo d = (L−1)/2, opcionalmente
 * diezmado: y[i] = Σ h[k]·x[i·M + d − k] (M = 1 sin diezmado).
 */
export function filtrar(x: Float64Array, h: Float64Array, diezmado = 1): Float64Array {
  const d = Math.floor((h.length - 1) / 2);
  const nOut = Math.ceil(x.length / diezmado);
  const y = new Float64Array(nOut);
  for (let i = 0; i < nOut; i++) {
    const n = i * diezmado + d;
    const kMin = Math.max(0, n - x.length + 1);
    const kMax = Math.min(h.length - 1, n);
    let s = 0;
    for (let k = kMin; k <= kMax; k++) s += h[k] * x[n - k];
    y[i] = s;
  }
  return y;
}

/**
 * Interpolación de banda limitada por relleno de ceros en frecuencia (como irfft(rfft(x), n·L)·L):
 * x_L[m] = (L/(nL))·Σ X[k]·e^(j2πkm/(nL)), con X = DFT de x (bins 0..n/2).
 */
export function remuestrearFft(x: Float64Array, factor: number): Float64Array {
  const n = x.length;
  const spec = dft(x, new Float64Array(n));
  const nOut = n * factor;
  const nBins = Math.floor(n / 2) + 1; // bins de rfft
  const half = Math.floor(nOut / 2);
  const yr = new Float64Array(nOut);
  const yi = new Float64Array(nOut);
  for (let k = 0; k < nBins && k <= half; k++) {
    yr[k] = spec.re[k];
    yi[k] = spec.im[k];
  }
  // irfft: se ignora la parte imaginaria de DC (y de Nyquist) y se completa la simetría hermítica
  yi[0] = 0;
  if (nOut % 2 === 0) yi[half] = 0;
  for (let k = 1; k < nOut - half; k++) {
    yr[nOut - k] = yr[k];
    yi[nOut - k] = -yi[k];
  }
  const y = dft(yr, yi, true);
  const out = new Float64Array(nOut);
  for (let i = 0; i < nOut; i++) out[i] = y.re[i] * factor;
  return out;
}
