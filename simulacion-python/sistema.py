"""
SIMULACIÓN DE LA CADENA COMPLETA DE TRANSMISIÓN DIGITAL
Comunicaciones Digitales I (RED-0310) - UPDS - Actividad 6

Cadena simulada (4 canales de voz por un solo enlace):
  voz → antialiasing → muestreo 8 kHz → cuantificación uniforme N bits (PCM)
  → TDM [SYNC | CH1 | CH2 | CH3 | CH4] → código de línea (tramo de cable)
  → modulación BPSK / QPSK / 16-QAM con coseno alzado (tramo de radio)
  → canal AWGN → filtro acoplado → decisión → sincronía de trama
  → demultiplexación → decodificación PCM → voz recuperada

Las cuatro señales de voz son fragmentos de la voz REAL capturada por el
Prototipo 1 (datos/voz_prototipo.wav, 8 kHz, 8 bits).

Uso:
    python sistema.py            (simulación completa, unos minutos)
    python sistema.py --rapido   (menos bits en las curvas BER)

Requisitos: numpy y matplotlib (no usa SciPy).
Salidas: carpeta "figuras" (PNG), "audio" (WAV) y "resultados.json".
"""

import argparse
import json
import math
import os
import wave

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

# ============================================================
# PARÁMETROS DE DISEÑO
# ============================================================
FS = 8000            # frecuencia de muestreo (Hz)
N_BITS = 8           # bits por muestra (diseño)
N_CANALES = 4        # canales de voz
SYNC = [1, 0, 0, 1, 1, 0, 1, 1]   # palabra de alineación de trama (ranura 0)
BITS_TRAMA = len(SYNC) + N_CANALES * N_BITS          # 40 bits
RB = BITS_TRAMA * FS                                 # 320 kbps
ALFA = 0.35          # factor de roll-off del coseno alzado
B_MAX = 250e3        # ancho de banda disponible (Hz)
BER_MAX = 1e-6       # BER máxima aceptable
SPS = 8              # muestras por símbolo en banda base compleja
SPAN = 8             # duración del filtro RRC (símbolos)
DUR = 2.0            # segundos de voz por canal
SEMILLA = 2026

MODS = {"BPSK": 1, "QPSK": 2, "16-QAM": 4}
COLORES = {"BPSK": "#1f4e9c", "QPSK": "#d9731f", "16-QAM": "#2e8b57"}

AQUI = os.path.dirname(os.path.abspath(__file__))
DIR_FIG = os.path.join(AQUI, "figuras")
DIR_AUD = os.path.join(AQUI, "audio")


# ============================================================
# UTILIDADES (sin SciPy)
# ============================================================
def coma(v, _=None):
    """Formato con coma decimal para los ejes."""
    s = f"{v:g}"
    return s.replace(".", ",").replace("-", "−")


def ejes_coma(ax, x=True, y=True):
    if x and ax.get_xscale() == "linear":
        ax.xaxis.set_major_formatter(FuncFormatter(coma))
    if y and ax.get_yscale() == "linear":
        ax.yaxis.set_major_formatter(FuncFormatter(coma))


def num(v, d=1):
    """Número con coma decimal para textos de las figuras."""
    return f"{v:.{d}f}".replace(".", ",")


def guardar(fig, nombre):
    os.makedirs(DIR_FIG, exist_ok=True)
    fig.savefig(os.path.join(DIR_FIG, nombre), dpi=200, bbox_inches="tight")
    plt.close(fig)


_erfc = np.vectorize(math.erfc)


def Q(x):
    return 0.5 * _erfc(np.asarray(x) / math.sqrt(2))


def fir_pasabajos(fc, fs, n=255):
    """FIR pasa bajos por ventana de Hamming."""
    k = np.arange(n) - (n - 1) / 2
    h = 2 * fc / fs * np.sinc(2 * fc / fs * k) * np.hamming(n)
    return h / h.sum()


def filtrar(x, h):
    """Filtro de fase lineal compensando el retardo de grupo."""
    y = np.convolve(x, h)
    d = (len(h) - 1) // 2
    return y[d:d + len(x)]


def remuestrear_fft(x, factor):
    """Interpolación de banda limitada por relleno de ceros en frecuencia."""
    n = len(x)
    X = np.fft.rfft(x)
    Y = np.zeros(n * factor // 2 + 1, dtype=complex)
    Y[:len(X)] = X
    return np.fft.irfft(Y, n * factor) * factor


def welch(x, fs, nperseg=4096):
    """Densidad espectral de potencia (Welch, Hann, 50 % de solape)."""
    x = np.asarray(x)
    w = np.hanning(nperseg)
    paso = nperseg // 2
    segs = [x[i:i + nperseg] for i in range(0, len(x) - nperseg + 1, paso)]
    P = np.mean([np.abs(np.fft.fft(s * w)) ** 2 for s in segs], axis=0)
    P /= fs * np.sum(w ** 2)
    f = np.fft.fftfreq(nperseg, 1 / fs)
    if np.isrealobj(x):
        m = nperseg // 2 + 1
        P = P[:m].copy()
        P[1:-1] *= 2
        return np.fft.rfftfreq(nperseg, 1 / fs), P
    return np.fft.fftshift(f), np.fft.fftshift(P)


def rrc(alfa, sps, span):
    """Filtro de raíz de coseno alzado con energía unitaria."""
    t = (np.arange(span * sps + 1) - span * sps / 2) / sps
    h = np.zeros_like(t)
    for i, ti in enumerate(t):
        if abs(ti) < 1e-12:
            h[i] = 1 - alfa + 4 * alfa / math.pi
        elif abs(abs(4 * alfa * ti) - 1) < 1e-9:
            h[i] = alfa / math.sqrt(2) * ((1 + 2 / math.pi) * math.sin(math.pi / (4 * alfa))
                                          + (1 - 2 / math.pi) * math.cos(math.pi / (4 * alfa)))
        else:
            h[i] = (math.sin(math.pi * ti * (1 - alfa)) + 4 * alfa * ti * math.cos(math.pi * ti * (1 + alfa))) \
                   / (math.pi * ti * (1 - (4 * alfa * ti) ** 2))
    return h / math.sqrt(np.sum(h ** 2))


def ancho_banda_potencia(f, P, frac=0.99):
    """Ancho de banda que contiene la fracción 'frac' de la potencia (señal real)."""
    c = np.cumsum(P) / np.sum(P)
    return f[np.searchsorted(c, frac)]


# ============================================================
# 1. FUENTE: voz real del Prototipo 1
# ============================================================
def cargar_voz():
    with wave.open(os.path.join(AQUI, "datos", "voz_prototipo.wav")) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.uint8).astype(float)
    x -= x.mean()
    n = int(DUR * FS)
    # cuatro ventanas de 2 s sin solape con mayor energía (cuatro "llamadas")
    cand = range(0, len(x) - n, FS // 4)
    energia = sorted(((np.sum(x[i:i + n] ** 2), i) for i in cand), reverse=True)
    elegidas = []
    for _, i in energia:
        if all(abs(i - j) >= n for j in elegidas):
            elegidas.append(i)
        if len(elegidas) == N_CANALES:
            break
    canales = [x[i:i + n] for i in sorted(elegidas)]
    return [c / np.max(np.abs(c)) * 0.95 for c in canales]   # carga del cuantificador


# ============================================================
# 2. CONVERSIÓN A/D: antialiasing, muestreo y cuantificación PCM
# ============================================================
FA = 8 * FS     # 64 kHz: simulación de la señal "analógica"


def a_analogica(v):
    """Señal de banda limitada a 64 kHz (representa la señal continua)."""
    return remuestrear_fft(v, FA // FS)


def antialiasing(xa):
    return filtrar(xa, fir_pasabajos(3400, FA, 511))


def muestrear(xa):
    return xa[::FA // FS]


def cuantificar(x, n):
    """Cuantificador uniforme de media contrahuella en [−1, 1)."""
    L = 2 ** n
    d = 2 / L
    cod = np.clip(np.floor(x / d) + L // 2, 0, L - 1).astype(int)
    return cod, (cod - L // 2 + 0.5) * d


def decodificar(cod, n):
    L = 2 ** n
    return (cod - L // 2 + 0.5) * (2 / L)


def sqnr_db(x, xq):
    return 10 * np.log10(np.sum(x ** 2) / np.sum((x - xq) ** 2))


def a_bits(cod, n):
    return ((cod[:, None] >> np.arange(n - 1, -1, -1)) & 1).astype(np.uint8)


def de_bits(b, n):
    return (b.reshape(-1, n) * (1 << np.arange(n - 1, -1, -1))).sum(axis=1)


# ============================================================
# 3. MULTIPLEXACIÓN TDM
# ============================================================
def multiplexar(codigos):
    """Trama: [SYNC 8 bits | CH1 | CH2 | CH3 | CH4], 8000 tramas/s."""
    nt = len(codigos[0])
    trama = np.zeros((nt, BITS_TRAMA), dtype=np.uint8)
    trama[:, :8] = SYNC
    for k, c in enumerate(codigos):
        trama[:, 8 + k * N_BITS: 8 + (k + 1) * N_BITS] = a_bits(c, N_BITS)
    return trama.reshape(-1)


def sincronizar(bits):
    """Busca el desplazamiento cuyo bloque de 8 bits coincide más con SYNC."""
    nt = len(bits) // BITS_TRAMA - 1
    mejor, desp = -1, 0
    for d in range(BITS_TRAMA):
        b = bits[d:d + nt * BITS_TRAMA].reshape(nt, BITS_TRAMA)[:, :8]
        aciertos = np.sum(b == SYNC)
        if aciertos > mejor:
            mejor, desp = aciertos, d
    return desp, mejor / (nt * 8)


def demultiplexar(bits, desp):
    nt = (len(bits) - desp) // BITS_TRAMA
    t = bits[desp:desp + nt * BITS_TRAMA].reshape(nt, BITS_TRAMA)
    return [de_bits(t[:, 8 + k * N_BITS: 8 + (k + 1) * N_BITS].reshape(-1), N_BITS)
            for k in range(N_CANALES)]


# ============================================================
# 4. CÓDIGOS DE LÍNEA (tramo de cable, banda base)
# ============================================================
def codigo_linea(bits, tipo, spb=16):
    b = bits.astype(float)
    if tipo == "NRZ unipolar":
        return np.repeat(b, spb)
    if tipo == "NRZ polar":
        return np.repeat(2 * b - 1, spb)
    if tipo == "Manchester":            # IEEE 802.3: 1 = subida, 0 = bajada
        m = np.where(b[:, None] == 1, [-1, 1], [1, -1])
        return np.repeat(m.reshape(-1), spb // 2)
    if tipo == "AMI":
        s = np.zeros_like(b)
        unos = np.where(b == 1)[0]
        s[unos] = np.where(np.arange(len(unos)) % 2 == 0, 1, -1)
        return np.repeat(s, spb)
    raise ValueError(tipo)


def decodificar_linea(x, tipo, spb=16):
    """Decodificador con filtro acoplado (integración por bit)."""
    if tipo == "Manchester":
        h = x.reshape(-1, 2, spb // 2).mean(axis=2)
        return (h[:, 1] > h[:, 0]).astype(np.uint8)
    y = x.reshape(-1, spb).mean(axis=1)
    if tipo == "NRZ unipolar":
        return (y > 0.5).astype(np.uint8)
    if tipo == "NRZ polar":
        return (y > 0).astype(np.uint8)
    if tipo == "AMI":
        return (np.abs(y) > 0.5).astype(np.uint8)
    raise ValueError(tipo)


# ============================================================
# 5. MODULACIÓN DIGITAL (tramo de radio, paso banda)
# ============================================================
GRAY4 = {0: -3, 1: -1, 3: 1, 2: 3}       # 2 bits Gray por eje en 16-QAM


def mapear(bits, mod):
    if mod == "BPSK":
        return (2.0 * bits - 1).astype(complex)
    if mod == "QPSK":
        b = bits.reshape(-1, 2)
        return ((2.0 * b[:, 0] - 1) + 1j * (2.0 * b[:, 1] - 1)) / math.sqrt(2)
    b = bits.reshape(-1, 4)
    i = np.vectorize(GRAY4.get)(2 * b[:, 0] + b[:, 1])
    q = np.vectorize(GRAY4.get)(2 * b[:, 2] + b[:, 3])
    return (i + 1j * q) / math.sqrt(10)


def demapear(r, mod):
    if mod == "BPSK":
        return (r.real > 0).astype(np.uint8)
    if mod == "QPSK":
        return np.column_stack([r.real > 0, r.imag > 0]).astype(np.uint8).reshape(-1)
    bi, bq = _eje16_rapido(r.real), _eje16_rapido(r.imag)
    return np.column_stack([bi, bq]).reshape(-1)


def _eje16_rapido(v):
    idx = np.clip(np.round((v * math.sqrt(10) + 3) / 2), 0, 3).astype(int)
    tabla = np.array([[0, 0], [0, 1], [1, 1], [1, 0]], dtype=np.uint8)
    return tabla[idx]


def modular_bb(bits, mod, h):
    """Señal compleja en banda base con pulso RRC (energía de símbolo unitaria)."""
    s = mapear(bits, mod)
    up = np.zeros(len(s) * SPS, dtype=complex)
    up[::SPS] = s
    return np.convolve(up, h), s


def canal_awgn(x, ebn0_db, k, rng):
    """Ruido complejo con varianza N0 por muestra (Es = 1)."""
    if ebn0_db is None:
        return x.copy()
    n0 = 1 / (k * 10 ** (ebn0_db / 10))
    return x + math.sqrt(n0 / 2) * (rng.standard_normal(len(x)) + 1j * rng.standard_normal(len(x)))


def demodular_bb(r, mod, h, nsim):
    y = np.convolve(r, h)
    d = len(h) - 1                        # retardo total de los dos filtros
    muestras = y[d:d + nsim * SPS:SPS]
    return demapear(muestras, mod), muestras


def ber_teorica(mod, ebn0_db):
    g = 10 ** (np.asarray(ebn0_db) / 10)
    if mod in ("BPSK", "QPSK"):
        return Q(np.sqrt(2 * g))
    M, k = 16, 4
    return 4 / k * (1 - 1 / math.sqrt(M)) * Q(np.sqrt(3 * k * g / (M - 1)))


def ebn0_requerido(mod, objetivo=BER_MAX):
    lo, hi = 0.0, 30.0
    for _ in range(60):
        m = (lo + hi) / 2
        if ber_teorica(mod, m) > objetivo:
            lo = m
        else:
            hi = m
    return hi


# ============================================================
# PROGRAMA PRINCIPAL
# ============================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rapido", action="store_true")
    a = ap.parse_args()
    rng = np.random.default_rng(SEMILLA)
    plt.rcParams.update({"font.size": 10, "axes.grid": True, "grid.alpha": 0.3,
                         "axes.titleweight": "bold"})
    R = {}

    # ---------- 1. Fuente y conversión A/D ----------
    voces = cargar_voz()
    analog = [a_analogica(v) for v in voces]
    filtradas = [antialiasing(x) for x in analog]
    muestras = [muestrear(x) for x in filtradas]

    # Figura: espectro de la voz antes y después del antialiasing
    f, P0 = welch(analog[0], FA, 4096)
    _, P1 = welch(filtradas[0], FA, 4096)
    fig, ax = plt.subplots(figsize=(7, 3.4))
    ax.semilogy(f / 1e3, P0, color="#9aa4b1", label="Voz original (banda limitada)")
    ax.semilogy(f / 1e3, P1, color=COLORES["BPSK"], label="Después del filtro antialiasing (3,4 kHz)")
    ax.axvline(4, color="k", ls="--", lw=1)
    ax.text(4.1, P0.max() / 30, "fs/2 = 4 kHz", fontsize=9)
    ax.set(xlim=(0, 8), ylim=(1e-14, 1e-3), title="Espectro de la voz del canal 1 antes del muestreo",
           xlabel="Frecuencia (kHz)", ylabel="DEP (V²/Hz)")
    ax.legend(fontsize=8, loc="lower left")
    ejes_coma(ax)
    guardar(fig, "f03_espectro_voz_antialiasing.png")

    # SQNR con 6, 8 y 10 bits (seno a plena escala y voz)
    t = np.arange(int(DUR * FS)) / FS
    seno = 0.999 * np.sin(2 * np.pi * 1013 * t)
    tabla_sqnr = []
    for n in (6, 8, 10):
        _, sq = cuantificar(seno, n)
        voz_q = [cuantificar(m, n)[1] for m in muestras]
        sv = np.mean([sqnr_db(m, q) for m, q in zip(muestras, voz_q)])
        tabla_sqnr.append({"N": n, "teorico": 6.02 * n + 1.76, "seno": sqnr_db(seno, sq),
                           "voz": sv, "Rb_canal": n * FS, "Rb_total": (8 + N_CANALES * n) * FS})
    R["sqnr"] = tabla_sqnr

    ns = np.arange(4, 13)
    fig, ax = plt.subplots(figsize=(7, 3.6))
    ax.plot(ns, 6.02 * ns + 1.76, "k--", label="Teórico 6,02·N + 1,76 (seno)")
    ax.plot(ns, [sqnr_db(seno, cuantificar(seno, n)[1]) for n in ns], "o", color=COLORES["BPSK"],
            label="Simulado: seno a plena escala")
    ax.plot(ns, [np.mean([sqnr_db(m, cuantificar(m, n)[1]) for m in muestras]) for n in ns], "s-",
            color=COLORES["QPSK"], label="Simulado: voz del prototipo (4 canales)")
    for r in tabla_sqnr:
        ax.annotate(f"{num(r['voz'])} dB", (r["N"], r["voz"]), textcoords="offset points",
                    xytext=(6, -12), fontsize=8, color=COLORES["QPSK"])
    ax.set(title="SQNR en función del número de bits por muestra", xlabel="Bits por muestra N",
           ylabel="SQNR (dB)")
    ax.legend(fontsize=8)
    ejes_coma(ax)
    guardar(fig, "f04_sqnr_bits.png")

    # Muestreo y cuantificación: tramo de 10 ms con más amplitud y error por N
    m0 = muestras[0]
    rms = np.convolve(m0 ** 2, np.ones(80), "valid")
    i0 = int(np.argsort(rms)[int(0.9 * len(rms))])
    seg = slice(i0, i0 + 80)
    ta = np.arange(len(filtradas[0])) / FA * 1e3
    fig, axs = plt.subplots(2, 1, figsize=(7, 5.0), sharex=True, gridspec_kw={"height_ratios": [1.3, 1]})
    ka = slice(i0 * 8, (i0 + 80) * 8)
    _, q6 = cuantificar(m0, 6)
    axs[0].plot(ta[ka], filtradas[0][ka], color="#9aa4b1", lw=1.2, label="Señal analógica")
    axs[0].step(t[seg] * 1e3, q6[seg], where="post", color=COLORES["BPSK"], lw=1, label="PCM 6 bits")
    axs[0].plot(t[seg] * 1e3, m0[seg], ".", color=COLORES["QPSK"], ms=4, label="Muestras (Ts = 125 µs)")
    axs[0].set(ylabel="Amplitud normalizada", title="Muestreo a 8 kHz y cuantificación uniforme (canal 1)")
    axs[0].legend(fontsize=7, loc="upper right", ncol=3)
    for n, c in zip((6, 8, 10), [COLORES["BPSK"], COLORES["QPSK"], COLORES["16-QAM"]]):
        e = m0[seg] - cuantificar(m0, n)[1][seg]
        axs[1].step(t[seg] * 1e3, e * 1e3, where="post", color=c, lw=1,
                    label=f"N = {n}: Δ/2 = {num(1 / 2 ** n * 1e3, 2)}·10⁻³")
    axs[1].set(ylabel="Error (×10⁻³)", xlabel="Tiempo (ms)", title="Error de cuantificación e[n] = x[n] − xq[n]")
    axs[1].legend(fontsize=7, loc="upper right", ncol=3)
    for ax in axs:
        ejes_coma(ax)
    fig.tight_layout()
    guardar(fig, "f05_muestreo_cuantificacion.png")

    # ---------- 2. PCM de diseño (8 bits) y TDM ----------
    cods = [cuantificar(m, N_BITS)[0] for m in muestras]
    pcm = [decodificar(c, N_BITS) for c in cods]
    bits = multiplexar(cods)
    R["tdm"] = {"bits_trama": BITS_TRAMA, "Rb_kbps": RB / 1e3, "bits_totales": int(len(bits))}

    # Figura: estructura de la trama
    fig, ax = plt.subplots(figsize=(7.2, 2.2))
    partes = [("SYNC\n10011011", 8, "#15233F")] + [(f"CH{k + 1}\n8 bits PCM", 8, c) for k, c in
                                                     enumerate(["#1f4e9c", "#3b6fc2", "#d9731f", "#2e8b57"])]
    x0 = 0
    for txt, w, c in partes:
        ax.add_patch(plt.Rectangle((x0, 0), w, 1, color=c))
        ax.text(x0 + w / 2, 0.5, txt, ha="center", va="center", color="white", fontsize=9, fontweight="bold")
        x0 += w
    ax.annotate("", xy=(0, -0.25), xytext=(40, -0.25), arrowprops=dict(arrowstyle="<->"))
    ax.text(20, -0.55, "1 trama = 40 bits = 125 µs   →   40 × 8000 = 320 kbps", ha="center", fontsize=9)
    ax.set(xlim=(-1, 41), ylim=(-0.8, 1.15), title="Estructura de la trama TDM del sistema diseñado")
    ax.axis("off")
    guardar(fig, "f06_trama_tdm.png")

    # ---------- 3. Códigos de línea ----------
    spb = 16
    fsl = RB * spb
    tipos = ["NRZ unipolar", "NRZ polar", "Manchester", "AMI"]
    nb = 24
    fig, axs = plt.subplots(len(tipos), 1, figsize=(7, 5.4), sharex=True)
    tb = np.arange(nb * spb) / spb
    for ax, tp in zip(axs, tipos):
        ax.plot(tb, codigo_linea(bits[:nb], tp, spb), color=COLORES["BPSK"], lw=1.4, drawstyle="steps-post")
        ax.set_ylabel(tp, fontsize=8)
        ax.set_ylim(-1.4, 1.4)
        ax.set_yticks([-1, 0, 1])
        ejes_coma(ax)
    for k in range(nb):
        axs[0].text(k + 0.5, 1.15, str(bits[k]), ha="center", fontsize=7)
    axs[0].set_title("Primeros 24 bits de la trama en cada código de línea (amplitud normalizada)")
    axs[-1].set_xlabel("Tiempo (en duraciones de bit, Tb = 3,125 µs)")
    fig.tight_layout()
    guardar(fig, "f07_codigos_linea.png")

    fig, ax = plt.subplots(figsize=(7, 3.6))
    tabla_linea = []
    nl = 200000
    for tp, c in zip(tipos, ["#9aa4b1", COLORES["BPSK"], COLORES["QPSK"], COLORES["16-QAM"]]):
        x = codigo_linea(bits[:nl], tp, spb)
        f, P = welch(x - (x.mean() if tp == "NRZ unipolar" else 0), fsl, 1024)
        f2, P2 = welch(x, fsl, 1024)
        ax.semilogy(f / 1e3, P2 / np.mean(x ** 2) * 1e3, color=c, label=tp, lw=1.1)
        b99 = ancho_banda_potencia(f2, P2, 0.90)
        x_dc = float(np.mean(x))
        rec = decodificar_linea(x, tp, spb)
        tabla_linea.append({"codigo": tp, "B90_kHz": float(b99 / 1e3), "DC": x_dc,
                            "errores_sin_ruido": int(np.sum(rec != bits[:nl]))})
    ax.set(xlim=(0, 1300), ylim=(1e-5, 0.2), title="Espectro de la trama TDM con cada código de línea",
           xlabel="Frecuencia (kHz)", ylabel="DEP normalizada (1/MHz)")
    for fx in (320, 640, 960, 1280):
        ax.axvline(fx, color="k", lw=0.6, ls=":")
    ax.legend(fontsize=8, loc="upper right")
    ejes_coma(ax)
    guardar(fig, "f08_espectro_codigos_linea.png")
    R["codigos_linea"] = tabla_linea

    # BER en banda base: NRZ unipolar (prototipo) frente a polar/Manchester
    eb = np.arange(0, 15)
    fig, ax = plt.subplots(figsize=(7, 3.6))
    g = 10 ** (eb / 10)
    ax.semilogy(eb, Q(np.sqrt(g)), "--", color="#9aa4b1", label="NRZ unipolar, teórico Q(√(Eb/N0))")
    ax.semilogy(eb, Q(np.sqrt(2 * g)), "--", color=COLORES["BPSK"], label="NRZ polar / Manchester, teórico Q(√(2Eb/N0))")
    nbb = 400000 if a.rapido else 2000000
    bb = rng.integers(0, 2, nbb).astype(np.uint8)
    for tp, c, mk in [("NRZ unipolar", "#5f6b7a", "o"), ("NRZ polar", COLORES["BPSK"], "s"),
                      ("Manchester", COLORES["QPSK"], "^")]:
        sims = []
        for e in eb[eb <= 11]:
            s = codigo_linea(bb, tp, 8)
            es_b = np.mean(s ** 2) * 8        # energía por bit (muestras de un bit)
            n0 = es_b / 10 ** (e / 10)
            r = s + rng.standard_normal(len(s)) * math.sqrt(n0 / 2)
            pe = np.mean(decodificar_linea(r, tp, 8) != bb)
            sims.append(pe if pe > 0 else np.nan)
        ax.semilogy(eb[eb <= 11], sims, mk, color=c, label=f"{tp}, simulado")
    ax.axhline(BER_MAX, color="r", lw=0.8)
    ax.text(12.2, BER_MAX * 1.6, "BER = 10⁻⁶", color="r", fontsize=8)
    ax.set(ylim=(1e-7, 1), title="BER en banda base con ruido AWGN (tramo de cable)",
           xlabel="Eb/N0 (dB)", ylabel="BER")
    ax.legend(fontsize=7, loc="lower left")
    ejes_coma(ax, y=False)
    guardar(fig, "f09_ber_banda_base.png")

    # ---------- 4. Modulación: espectros paso banda ----------
    h = rrc(ALFA, SPS, SPAN)
    FSPB = 5.12e6
    FC = 1.0e6
    tabla_mod = []
    fig, ax = plt.subplots(figsize=(7, 3.6))
    for mod, k in MODS.items():
        rs = RB / k
        sps_v = int(round(FSPB / rs))
        hv = rrc(ALFA, sps_v, SPAN)
        nsym = 40000 // k
        s = mapear(bits[:nsym * k], mod)
        up = np.zeros(nsym * sps_v, dtype=complex)
        up[::sps_v] = s
        xb = np.convolve(up, hv)
        tt = np.arange(len(xb)) / FSPB
        xp = np.real(xb * np.exp(2j * np.pi * FC * tt)) * math.sqrt(2)
        f, P = welch(xp, FSPB, 4096)
        ax.plot(f / 1e3, 10 * np.log10(P / P.max() + 1e-12), color=COLORES[mod],
                label=f"{mod}: B = (1 + α)·Rs = {num((1 + ALFA) * rs / 1e3, 0)} kHz")
        req = ebn0_requerido(mod)
        bw = (1 + ALFA) * rs
        tabla_mod.append({"mod": mod, "k": k, "Rs_kbaud": rs / 1e3, "B_kHz": bw / 1e3,
                          "cumple_B": bool(bw <= B_MAX), "EbN0_req_dB": req,
                          "eficiencia": RB / bw,
                          "CN_req_dB": req + 10 * math.log10(RB / bw)})
    ax.axvspan((FC - B_MAX / 2) / 1e3, (FC + B_MAX / 2) / 1e3, color="#d9731f", alpha=0.12,
               label="Canal disponible: 250 kHz")
    ax.set(xlim=(600, 1400), ylim=(-60, 3), title="Espectro de la señal modulada (portadora de 1 MHz, α = 0,35)",
           xlabel="Frecuencia (kHz)", ylabel="DEP normalizada (dB)")
    ax.legend(fontsize=7, loc="upper center", bbox_to_anchor=(0.5, -0.18), ncol=2)
    ejes_coma(ax)
    guardar(fig, "f10_espectros_modulados.png")
    R["modulaciones"] = tabla_mod

    # ---------- 5. Curvas BER vs Eb/N0 (Monte Carlo) ----------
    eb_mod = np.arange(0, 17)
    curvas = {}
    max_bits = 4e6 if a.rapido else 2e7
    for mod, k in MODS.items():
        sim = []
        for e in eb_mod:
            err = tot = 0
            while err < 200 and tot < max_bits:
                nbits = 400000 * k
                b = rng.integers(0, 2, nbits).astype(np.uint8)
                s = mapear(b, mod)
                n0 = 1 / (k * 10 ** (e / 10))
                r = s + math.sqrt(n0 / 2) * (rng.standard_normal(len(s)) + 1j * rng.standard_normal(len(s)))
                err += int(np.sum(demapear(r, mod) != b))
                tot += nbits
            sim.append(err / tot if err else np.nan)
        curvas[mod] = sim
    R["ber_curvas"] = {"EbN0_dB": eb_mod.tolist(), **{m: [None if np.isnan(v) else v for v in c]
                                                      for m, c in curvas.items()}}

    fig, ax = plt.subplots(figsize=(7, 4.2))
    ef = np.linspace(0, 17, 200)
    for mod, mk in zip(MODS, ["o", "s", "^"]):
        ax.semilogy(ef, ber_teorica(mod, ef), "-", color=COLORES[mod], lw=1, alpha=0.8)
        ax.semilogy(eb_mod, curvas[mod], mk, color=COLORES[mod], ms=5,
                    label=f"{mod} (simulado) · {num(ebn0_requerido(mod))} dB para 10⁻⁶")
    ax.axhline(BER_MAX, color="r", lw=0.8)
    ax.text(14.6, BER_MAX * 1.6, "BER máx. = 10⁻⁶", color="r", fontsize=8)
    ax.set(ylim=(1e-7, 0.5), xlim=(0, 17), title="BER en función de Eb/N0 (líneas: teoría; marcas: simulación)",
           xlabel="Eb/N0 (dB)", ylabel="BER")
    ax.legend(fontsize=8, loc="lower left")
    ejes_coma(ax, y=False)
    guardar(fig, "f11_ber_ebn0.png")

    # ---------- 6. Cadena completa con forma de onda: voz por cada modulación ----------
    os.makedirs(DIR_AUD, exist_ok=True)
    niveles = [None, 14, 12, 10, 8, 6, 4]
    cadena = []
    recuperadas = {}
    consts = {}
    # Tramo de cable: la trama viaja en Manchester hasta el equipo de radio
    linea = codigo_linea(bits, "Manchester", 8)
    bits_cable = decodificar_linea(linea, "Manchester", 8)
    R["tramo_cable"] = {"codigo": "Manchester", "errores": int(np.sum(bits_cable != bits)),
                        "bits": int(len(bits))}
    for mod, k in MODS.items():
        nsim = len(bits_cable) // k
        tx, simb = modular_bb(bits_cable[:nsim * k], mod, h)
        for e in niveles:
            rx = canal_awgn(tx, e, k, rng)
            b_rx, m = demodular_bb(rx, mod, h, nsim)
            if e in (12, 8):
                consts[(mod, e)] = m[:3000]
            desp, calidad = sincronizar(b_rx)
            canales_rx = demultiplexar(b_rx, desp)
            voz_rx = [decodificar(c, N_BITS) for c in canales_rx]
            ber = float(np.mean(b_rx != bits[:nsim * k]))
            snr_out = float(np.mean([sqnr_db(mu[:len(v)], v) for mu, v in zip(muestras, voz_rx)]))
            cadena.append({"mod": mod, "EbN0_dB": "sin ruido" if e is None else e, "BER": ber,
                           "errores": int(np.sum(b_rx != bits[:nsim * k])), "bits": int(nsim * k),
                           "desplazamiento_trama": int(desp), "SNR_salida_dB": snr_out})
            etq = "sin_ruido" if e is None else f"{e}dB"
            if mod == "QPSK":
                recuperadas[e] = voz_rx
            if mod == "QPSK" and e in (None, 8, 4):
                for c, v in enumerate(voz_rx):
                    escribir_wav(os.path.join(DIR_AUD, f"QPSK_{etq}_canal{c + 1}.wav"), v)
    for c, m in enumerate(muestras):
        escribir_wav(os.path.join(DIR_AUD, f"original_canal{c + 1}.wav"), m)
    R["cadena"] = cadena

    # Constelaciones recibidas a Eb/N0 = 8 dB
    fig, axs = plt.subplots(2, 3, figsize=(7.2, 5.0))
    for fila, e in enumerate((12, 8)):
        for ax, mod in zip(axs[fila], MODS):
            m = consts[(mod, e)]
            ax.plot(m.real, m.imag, ".", ms=1.2, color=COLORES[mod], alpha=0.5)
            ax.set(title=f"{mod} · Eb/N0 = {e} dB", xlim=(-1.6, 1.6), ylim=(-1.6, 1.6))
            ax.set_aspect("equal")
            ax.title.set_fontsize(9)
            if fila == 1:
                ax.set_xlabel("Fase I")
            if mod == "BPSK":
                ax.set_ylabel("Cuadratura Q")
            ejes_coma(ax)
    fig.suptitle("Constelaciones recibidas a la salida del filtro acoplado", fontweight="bold", fontsize=10)
    fig.tight_layout()
    guardar(fig, "f12_constelaciones.png")

    # Espectro de la señal recibida (QPSK) sin ruido y con Eb/N0 = 4 dB, en banda base equivalente
    k = 2
    nsim = 20000
    tx, _ = modular_bb(bits[:nsim * k], "QPSK", h)
    fsb = RB / k * SPS
    fig, ax = plt.subplots(figsize=(7, 3.4))
    for e, c, lab in [(None, COLORES["QPSK"], "Transmitida"), (8, "#5f6b7a", "Recibida, Eb/N0 = 8 dB"),
                      (4, "#9aa4b1", "Recibida, Eb/N0 = 4 dB")]:
        f, P = welch(canal_awgn(tx, e, k, rng), fsb, 2048)
        ax.plot(f / 1e3, 10 * np.log10(P / 1e-9 + 1e-30) - 10 * np.log10(np.max(welch(tx, fsb, 2048)[1]) / 1e-9),
                color=c, label=lab, lw=1)
    ax.axvline(-(1 + ALFA) * RB / k / 2e3, color="k", ls=":", lw=0.8)
    ax.axvline((1 + ALFA) * RB / k / 2e3, color="k", ls=":", lw=0.8)
    ax.set(xlim=(-640, 640), ylim=(-50, 5), title="Espectro QPSK en el canal AWGN (banda base equivalente)",
           xlabel="Frecuencia respecto de la portadora (kHz)", ylabel="DEP normalizada (dB)")
    ax.legend(fontsize=8, loc="lower center")
    ejes_coma(ax)
    guardar(fig, "f13_espectro_canal_awgn.png")

    # Voz original frente a recuperada (QPSK)
    j0 = int(0.75 * FS)
    seg = slice(j0, j0 + 240)
    tt = np.arange(240) / FS * 1e3
    fig, axs = plt.subplots(3, 1, figsize=(7, 5.6), sharex=True)
    for ax, e in zip(axs, [None, 8, 4]):
        ax.plot(tt, muestras[0][seg], color="#9aa4b1", lw=2.2, label="Original (muestreada)")
        ax.plot(tt, recuperadas[e][0][seg], color=COLORES["QPSK"], lw=1, label="Recuperada")
        fila = next(c for c in cadena if c["mod"] == "QPSK" and c["EbN0_dB"] == ("sin ruido" if e is None else e))
        tit = "Sin ruido" if e is None else f"Eb/N0 = {e} dB"
        ax.set_title(f"{tit}: BER = {coma(float(f'{fila['BER']:.1e}')) if fila['BER'] else '0'} · "
                     f"SNR de salida = {num(fila['SNR_salida_dB'])} dB", fontsize=9)
        ax.set_ylabel("Amplitud")
        ax.legend(fontsize=7, loc="upper right")
        ejes_coma(ax)
    axs[-1].set_xlabel("Tiempo (ms)")
    fig.suptitle("Canal 1: voz original frente a voz recuperada con QPSK", fontweight="bold", fontsize=10)
    fig.tight_layout()
    guardar(fig, "f14_voz_original_recuperada.png")

    # Espectro de la voz original frente a la recuperada
    fig, ax = plt.subplots(figsize=(7, 3.4))
    for v, c, lab in [(muestras[0], "#9aa4b1", "Original"), (recuperadas[None][0], COLORES["QPSK"], "Recuperada sin ruido"),
                      (recuperadas[4][0], "#c0392b", "Recuperada, Eb/N0 = 4 dB")]:
        f, P = welch(v, FS, 1024)
        ax.semilogy(f / 1e3, P, color=c, label=lab, lw=1)
    ax.set(xlim=(0, 4), title="Espectro del canal 1 a la salida del receptor", xlabel="Frecuencia (kHz)",
           ylabel="DEP (V²/Hz)")
    ax.legend(fontsize=8)
    ejes_coma(ax)
    guardar(fig, "f15_espectro_voz_recuperada.png")

    # SNR de salida frente a Eb/N0 para las tres modulaciones
    fig, ax = plt.subplots(figsize=(7, 3.4))
    for mod, mk in zip(MODS, ["o", "s", "^"]):
        filas = [c for c in cadena if c["mod"] == mod and c["EbN0_dB"] != "sin ruido"]
        ax.plot([c["EbN0_dB"] for c in filas], [c["SNR_salida_dB"] for c in filas], mk + "-", color=COLORES[mod], label=mod)
    sq8 = next(r["voz"] for r in tabla_sqnr if r["N"] == 8)
    ax.axhline(sq8, color="k", ls="--", lw=0.8)
    ax.text(4.1, sq8 + 1.5, f"Límite sin ruido: SQNR de 8 bits = {num(sq8)} dB", fontsize=8)
    ax.set(title="Calidad de la voz recuperada en función de Eb/N0", xlabel="Eb/N0 (dB)",
           ylabel="SNR de la voz recuperada (dB)", ylim=(-5, sq8 + 8))
    ax.legend(fontsize=8)
    ejes_coma(ax)
    guardar(fig, "f16_snr_salida.png")

    with open(os.path.join(AQUI, "resultados.json"), "w", encoding="utf-8") as fjs:
        json.dump(R, fjs, indent=2, ensure_ascii=False)
    imprimir(R)


def escribir_wav(ruta, v):
    x = np.clip((v + 1) * 127.5, 0, 255).astype(np.uint8)
    with wave.open(ruta, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(1)
        w.setframerate(FS)
        w.writeframes(x.tobytes())


def imprimir(R):
    print("=== SQNR (dB) ===")
    for r in R["sqnr"]:
        print(f"N={r['N']:2d}  teórico {r['teorico']:5.1f}  seno {r['seno']:5.1f}  voz {r['voz']:5.1f}"
              f"  Rb canal {r['Rb_canal'] / 1e3:4.0f} kbps  Rb total {r['Rb_total'] / 1e3:4.0f} kbps")
    print("=== Códigos de línea ===")
    for r in R["codigos_linea"]:
        print(f"{r['codigo']:13s} B90 {r['B90_kHz']:6.1f} kHz  DC {r['DC']:+.3f}  errores sin ruido {r['errores_sin_ruido']}")
    print("=== Modulaciones ===")
    for r in R["modulaciones"]:
        print(f"{r['mod']:7s} Rs {r['Rs_kbaud']:5.0f} kbaud  B {r['B_kHz']:5.0f} kHz  cumple {r['cumple_B']}"
              f"  Eb/N0 req {r['EbN0_req_dB']:5.2f} dB  C/N req {r['CN_req_dB']:5.2f} dB  η {r['eficiencia']:.2f} bps/Hz")
    print("=== Cadena completa ===")
    for c in R["cadena"]:
        print(f"{c['mod']:7s} Eb/N0 {str(c['EbN0_dB']):9s} BER {c['BER']:.2e} ({c['errores']}/{c['bits']})"
              f"  trama desp {c['desplazamiento_trama']}  SNR salida {c['SNR_salida_dB']:5.1f} dB")


if __name__ == "__main__":
    main()
