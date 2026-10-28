"""Diagrama de bloques del sistema diseñado (Actividad 6)."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

T = {"T1": "#1f4e9c", "T4": "#7a3e9d", "T2": "#d9731f", "T3": "#2e8b57", "C": "#5f6b7a"}
fig, ax = plt.subplots(figsize=(10, 5.2))
ax.set_xlim(0, 100)
ax.set_ylim(0, 56)
ax.axis("off")


def caja(x, y, w, h, txt, tema, sub=""):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.4,rounding_size=1.2",
                                fc="white", ec=T[tema], lw=2))
    ax.text(x + w / 2, y + h / 2 + (1.2 if sub else 0), txt, ha="center", va="center", fontsize=8,
            fontweight="bold", color="#15233F")
    if sub:
        ax.text(x + w / 2, y + h / 2 - 2.2, sub, ha="center", va="center", fontsize=7, color="#4A5568")


def flecha(x1, y1, x2, y2, txt="", dy=1.6):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=12, lw=1.3, color="#15233F"))
    if txt:
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + dy, txt, ha="center", fontsize=6.8, color="#15233F")


# Fila superior: transmisor
y1, h = 38, 10
xs = [1, 15.5, 30, 44.5, 59, 73.5]
w = 11
caja(xs[0], y1, w, h, "4 fuentes\nde voz", "C", "")
caja(xs[1], y1, w, h, "Antialiasing", "T1", "FPB 3,4 kHz")
caja(xs[2], y1, w, h, "Muestreo\ny PCM", "T1", "8 kHz · 8 bits")
caja(xs[3], y1, w, h, "MUX TDM", "T4", "40 bits · 320 kbps")
caja(xs[4], y1, w, h, "Código\nde línea", "T2", "Manchester (UTP)")
caja(xs[5], y1, w + 2, h, "Modulador\nQPSK", "T3", "RRC α = 0,35")
for i in range(5):
    flecha(xs[i] + w + 0.4, y1 + h / 2, xs[i + 1] - 0.4, y1 + h / 2,
           "")
# Canal
caja(88.5, 24, 10.5, 10, "Canal\nAWGN", "C", "B ≤ 250 kHz")
flecha(xs[5] + w + 2.4, y1 + h / 2, 93.7, 34.4)
# Fila inferior: receptor (derecha a izquierda)
y2 = 8
xr = [73.5, 59, 44.5, 30, 15.5, 1]
caja(xr[0], y2, w + 2, h, "Demodulador\ncoherente", "T3", "filtro acoplado")
caja(xr[1], y2, w, h, "Decisión", "T2", "umbral / símbolo")
caja(xr[2], y2, w, h, "Sincronía\nde trama", "T4", "busca SYNC")
caja(xr[3], y2, w, h, "DEMUX TDM", "T4", "4 canales")
caja(xr[4], y2, w, h, "Decodif.\nPCM", "T1", "8 bits → muestra")
caja(xr[5], y2, w, h, "4 voces\nrecuperadas", "C", "")
flecha(93.7, 23.6, xr[0] + w + 2.4, y2 + h / 2)
for i in range(5):
    flecha(xr[i] - 0.4, y2 + h / 2, xr[i + 1] + w + 0.4, y2 + h / 2)
# Zona del prototipo
ax.add_patch(FancyBboxPatch((14.5, 36.4), 57.8, 15.2, boxstyle="round,pad=0.2", fc="none", ec="#9aa4b1",
                            lw=1.2, ls="--"))
ax.add_patch(FancyBboxPatch((14.5, 6.4), 57.8, 15.2, boxstyle="round,pad=0.2", fc="none", ec="#9aa4b1",
                            lw=1.2, ls="--"))
ax.text(43.4, 53.0, "Validado en hardware con el Prototipo 1 (a escala: 2 ranuras, NRZ por UART)",
        ha="center", fontsize=7.5, color="#5f6b7a", style="italic")
ax.text(43.4, 2.6, "Validado en hardware con el Prototipo 1 (decisión por umbral, sincronía SYNC y demux)",
        ha="center", fontsize=7.5, color="#5f6b7a", style="italic")
ax.text(80.5, 53.0, "TRANSMISOR", ha="center", fontsize=8, fontweight="bold", color="#15233F")
ax.text(80.5, 2.6, "RECEPTOR", ha="center", fontsize=8, fontweight="bold", color="#15233F")
# Leyenda de temas
ley = [("T1", "Tema 1: conversión A/D"), ("T4", "Tema 4: multiplexación"), ("T2", "Tema 2: banda base"),
       ("T3", "Tema 3: paso banda")]
for i, (k, t) in enumerate(ley):
    ax.add_patch(FancyBboxPatch((2 + i * 21, 26.5), 2.4, 2.4, boxstyle="square,pad=0", fc="white", ec=T[k], lw=2))
    ax.text(5.4 + i * 21, 27.7, t, va="center", fontsize=7.5, color="#15233F")
fig.savefig("figuras/f01_diagrama_bloques.png", dpi=220, bbox_inches="tight")
print("ok")
