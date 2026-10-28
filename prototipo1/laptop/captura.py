"""
PROTOTIPO 1 - CAPTURA EN LA LAPTOP
Comunicaciones Digitales I (RED-0310) - UPDS - Actividad 6

Lee por USB los bytes que el Arduino receptor reenvía, repite la misma
alineación de trama y demultiplexación, calcula el BER con el canal PRBS
y guarda la voz recuperada.

Uso:
    python captura.py --puerto COM5 --segundos 10 --nombre sin_ruido
    python captura.py --puerto /dev/ttyACM0 --segundos 10 --nombre pot_2k
    python captura.py --simular 1e-3       (prueba sin hardware)

Genera en la carpeta "resultados":
    <nombre>.wav         voz recuperada (8 kHz, 8 bits)
    <nombre>_ber.csv     BER por segundo
    <nombre>.png         forma de onda, espectro y BER por segundo
    resumen.csv          una fila por captura (para la curva de BER medido)

Requisitos: pip install pyserial numpy matplotlib
"""

import argparse
import csv
import os
import time
import wave

import numpy as np

SYNC = 0x9B
FS = 8000
BAUD = 250000
POP = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)


class PRBS15:
    """x^15 + x^14 + 1, igual que en los Arduino."""

    def __init__(self, estado=0x7FFF):
        self.h = estado & 0xFFFF

    def byte(self):
        out = 0
        for _ in range(8):
            nb = ((self.h >> 14) ^ (self.h >> 13)) & 1
            self.h = ((self.h << 1) | nb) & 0xFFFF
            out = (out << 1) | nb
        return out


class Receptor:
    """Réplica de la máquina de estados del RX_Uno.ino."""

    def __init__(self):
        self.hist = [0] * 7
        self.sinc = False
        self.fase = 0
        self.fallos = 0
        self.prbs_estado = 0
        self.prev = 0
        self.prbs = PRBS15()
        self.vent_err = 0
        self.vent_cnt = 0
        self.bits_ver = 0
        self.bits_err = 0
        self.perdidas = 0
        self.voz = []

    def procesar(self, datos):
        self.bytes_rx = getattr(self, "bytes_rx", 0) + len(datos)
        self.syncs_rx = getattr(self, "syncs_rx", 0) + bytes(datos).count(bytes([SYNC]))
        for b in datos:
            if not self.sinc:
                self.hist = [b] + self.hist[:6]
                if self.hist[0] == SYNC and self.hist[3] == SYNC and self.hist[6] == SYNC:
                    self.sinc, self.fase, self.fallos, self.prbs_estado = True, 0, 0, 0
                continue
            if self.fase == 0:
                self.voz.append(b)
                self.fase = 1
            elif self.fase == 1:
                if self.prbs_estado == 0:
                    self.prev, self.prbs_estado = b, 1
                elif self.prbs_estado == 1:
                    self.prbs = PRBS15((self.prev << 8) | b)
                    self.prbs_estado, self.vent_err, self.vent_cnt = 2, 0, 0
                else:
                    e = int(POP[b ^ self.prbs.byte()])
                    self.bits_err += e
                    self.bits_ver += 8
                    self.vent_err += e
                    self.vent_cnt += 1
                    if self.vent_cnt == 32:
                        if self.vent_err > 64:
                            self.prbs_estado = 0
                        self.vent_err = self.vent_cnt = 0
                self.fase = 2
            else:
                self.bits_err += int(POP[b ^ SYNC])
                self.bits_ver += 8
                if b != SYNC:
                    self.fallos += 1
                    if self.fallos >= 4:
                        self.sinc = False
                        self.perdidas += 1
                        self.hist = [0] * 7
                else:
                    self.fallos = 0
                self.fase = 0


class TransmisorSimulado:
    """Genera los mismos bytes que el TX_Uno.ino en modo tono (tecla 0)."""

    SENO = [128, 199, 228, 199, 128, 57, 28, 57]

    def __init__(self):
        self.prbs = PRBS15()
        self.k = 0

    def tramas(self, n):
        out = bytearray()
        for _ in range(n):
            out += bytes([SYNC, self.SENO[self.k % 8], self.prbs.byte()])
            self.k += 1
        return out


def canal_simulado(datos, p, rng):
    """Invierte cada bit con probabilidad p (canal binario simétrico)."""
    arr = np.frombuffer(bytes(datos), dtype=np.uint8).copy()
    bits = np.unpackbits(arr)
    bits ^= (rng.random(bits.size) < p).astype(np.uint8)
    return np.packbits(bits).tobytes()


def welch(x, fs, nperseg=512):
    """DEP por el método de Welch (ventana de Hann, 50 % de solape), solo con NumPy."""
    x = np.asarray(x, float)
    w = np.hanning(nperseg)
    paso = nperseg // 2
    segs = [x[i:i + nperseg] for i in range(0, len(x) - nperseg + 1, paso)]
    P = np.mean([np.abs(np.fft.rfft((sg - sg.mean()) * w)) ** 2 for sg in segs], axis=0)
    P /= fs * np.sum(w ** 2)
    P[1:-1] *= 2
    return np.fft.rfftfreq(nperseg, 1 / fs), P


def guardar(nombre, rx, ber_seg, carpeta="resultados"):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    os.makedirs(carpeta, exist_ok=True)
    base = os.path.join(carpeta, nombre)
    voz = np.array(rx.voz, dtype=np.uint8)

    with wave.open(base + ".wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(1)
        w.setframerate(FS)
        w.writeframes(voz.tobytes())

    with open(base + "_ber.csv", "w", newline="") as f:
        cw = csv.writer(f, delimiter=";")
        cw.writerow(["segundo", "bits_verificados", "bits_erroneos", "BER"])
        for i, (v, e) in enumerate(ber_seg, 1):
            cw.writerow([i, v, e, f"{e / v:.3e}".replace(".", ",") if v else ""])

    ber_tot = rx.bits_err / rx.bits_ver if rx.bits_ver else float("nan")
    nuevo = not os.path.exists(os.path.join(carpeta, "resumen.csv"))
    with open(os.path.join(carpeta, "resumen.csv"), "a", newline="") as f:
        cw = csv.writer(f, delimiter=";")
        if nuevo:
            cw.writerow(["captura", "bits_verificados", "bits_erroneos", "BER", "perdidas_trama"])
        cw.writerow([nombre, rx.bits_ver, rx.bits_err, f"{ber_tot:.3e}".replace(".", ","), rx.perdidas])

    # Gráficas
    plt.rcParams["axes.formatter.use_locale"] = False
    fig, ax = plt.subplots(3, 1, figsize=(8, 9))
    x = (voz.astype(float) - 128) / 128
    n = min(len(x), 160)
    t = np.arange(n) / FS * 1000
    ax[0].plot(t, x[:n], lw=0.8)
    ax[0].set(title="Canal 1 recuperado (20 ms)", xlabel="Tiempo (ms)", ylabel="Amplitud normalizada")
    if len(x) > 256:
        f, P = welch(x, fs=FS, nperseg=512)
        ax[1].semilogy(f / 1000, P)
    ax[1].set(title="Espectro del canal 1 recuperado", xlabel="Frecuencia (kHz)", ylabel="DEP (V²/Hz)")
    bers = [max(e / v, 1e-8) if v else np.nan for v, e in ber_seg]
    ax[2].semilogy(range(1, len(bers) + 1), bers, "o-")
    ax[2].set(title=f"BER medido por segundo (total = {ber_tot:.2e})", xlabel="Tiempo (s)", ylabel="BER")
    for a in ax:
        a.grid(True, which="both", alpha=0.3)
    fig.tight_layout()
    fig.savefig(base + ".png", dpi=150)
    print(f"Guardado: {base}.wav, {base}_ber.csv, {base}.png y resumen.csv")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--puerto", help="COM5, /dev/ttyACM0, ...")
    ap.add_argument("--segundos", type=float, default=10)
    ap.add_argument("--nombre", default=time.strftime("captura_%H%M%S"))
    ap.add_argument("--simular", type=float, metavar="P", help="probar sin hardware con BER = P")
    a = ap.parse_args()

    rx = Receptor()
    ber_seg = []

    if a.simular is not None:
        rng = np.random.default_rng(1)
        tx = TransmisorSimulado()
        for _ in range(int(a.segundos)):
            v0, e0 = rx.bits_ver, rx.bits_err
            rx.procesar(canal_simulado(tx.tramas(FS), a.simular, rng))
            ber_seg.append((rx.bits_ver - v0, rx.bits_err - e0))
        print(f"BER impuesto {a.simular:.1e} -> medido {rx.bits_err / max(rx.bits_ver, 1):.2e}"
              f" | pérdidas de trama: {rx.perdidas}")
        guardar(a.nombre, rx, ber_seg)
        return

    import serial

    if not a.puerto:
        ap.error("indique --puerto (o --simular)")
    with serial.Serial(a.puerto, BAUD, timeout=0.1) as s:
        time.sleep(2)               # el Uno se reinicia al abrir el puerto
        s.reset_input_buffer()
        # 1 s de calentamiento: el receptor se engancha a la trama y la PRBS
        t_cal = time.time() + 1
        while time.time() < t_cal:
            rx.procesar(s.read(4096))
        rx.bits_ver = rx.bits_err = rx.perdidas = 0
        rx.voz = []
        print("Capturando... (Ctrl+C para terminar antes)")
        t_fin = time.time() + a.segundos
        t_seg = time.time() + 1
        v0, e0 = 0, 0
        b0, s0 = getattr(rx, "bytes_rx", 0), getattr(rx, "syncs_rx", 0)
        try:
            while time.time() < t_fin:
                rx.procesar(s.read(4096))
                if time.time() >= t_seg:
                    t_seg += 1
                    dv, de = rx.bits_ver - v0, rx.bits_err - e0
                    v0, e0 = rx.bits_ver, rx.bits_err
                    ber_seg.append((dv, de))
                    estado = "SINC" if rx.sinc else "----"
                    ber = f"{de / dv:.2e}" if dv else "--"
                    print(f"{len(ber_seg):3d} s | {estado} | BER {ber} | pérdidas {rx.perdidas}"
                          f" | bytes {rx.bytes_rx - b0} (SYNC {100 * (rx.syncs_rx - s0) / max(rx.bytes_rx - b0, 1):.0f} %)")
                    b0, s0 = rx.bytes_rx, rx.syncs_rx
        except KeyboardInterrupt:
            pass
    guardar(a.nombre, rx, ber_seg)


if __name__ == "__main__":
    main()
