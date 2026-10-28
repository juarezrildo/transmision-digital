# Actividad 6 · Transmisión digital de 4 canales de voz

Comunicaciones Digitales I (RED-0310) · Universidad Privada Domingo Savio (UPDS)

Cadena completa de transmisión digital que envía 4 canales de voz por un solo enlace. Reúne los cuatro temas de la materia: conversión A/D (PCM), banda base (código Manchester), paso banda (BPSK, QPSK, 16-QAM) y multiplexación TDM.

**Integrantes:** Rildo Jimmy Juarez Romero, Moises Antonio Cruz Garzon, Denis Yhair Rodriguez Quispe
**Docente:** Ing. Esteban Soruco Sanchez · **Entrega:** 28 de octubre de 2026

## Parámetros de diseño

| Parámetro | Valor |
|---|---|
| Muestreo y cuantificación | 8 kHz, 8 bits, uniforme de media contrahuella en [−1, 1) |
| Trama TDM | SYNC `10011011` + 4 × 8 bits = 40 bits; 8000 tramas/s = 320 kbps |
| Código de línea (cable) | Manchester, IEEE 802.3 |
| Filtro | Raíz de coseno alzado en TX y RX, α = 0,35 |
| Requisitos | B ≤ 250 kHz y BER ≤ 10⁻⁶ |

| Modulación | Ancho de banda | Eb/N0 para BER = 10⁻⁶ | Cumple |
|---|---|---|---|
| BPSK | 432 kHz | 10,53 dB | No (supera 250 kHz) |
| QPSK | 216 kHz | 10,53 dB | Sí |
| 16-QAM | 108 kHz | 14,40 dB | Sí |

Recomendación: **QPSK**. Cumple el ancho de banda y necesita 3,87 dB menos de Eb/N0 que 16-QAM.

## Estructura

```
prototipo1/          Prototipo en hardware (Arduino Uno TX/RX, captura en la laptop)
  TX_Uno/  RX_Uno/   Programas de los Arduino
  laptop/captura.py  Captura por puerto serie de la voz y la BER
  esquemas/          Esquemas de conexión
  GUIA_MONTAJE.md    Guía de montaje
simulacion-python/   Referencia en Python (sistema.py) y voz grabada (datos/voz_prototipo.wav)
web/                 Simulador web: Next.js + React + TypeScript + Tailwind
docs/                Resultados de Python, validación, entrega y capturas
```

## Cómo ejecutar cada parte

**Prototipo (Arduino).** Abrir `prototipo1/TX_Uno/TX_Uno.ino` y `prototipo1/RX_Uno/RX_Uno.ino` en Arduino IDE, instalar la biblioteca LiquidCrystal I2C y cargar cada uno en su placa. El montaje y las precauciones al cargar están en `prototipo1/GUIA_MONTAJE.md`.

**Captura en la laptop.**
```
pip install pyserial numpy matplotlib
python prototipo1/laptop/captura.py --puerto COM5 --segundos 10 --nombre sin_ruido
```

**Simulación de referencia en Python.**
```
pip install -r requirements.txt
python simulacion-python/sistema.py            # corrida completa
python simulacion-python/sistema.py --rapido   # corrida corta
```

**Simulador web** (Node.js 20 o superior).
```
cd web
npm install
npm run dev      # http://localhost:3000
npm test         # pruebas del motor DSP
npm run build    # compilación de producción
```

El simulador no usa servidor ni base de datos: el cálculo corre en el navegador, en un Web Worker. Tiene cuatro páginas: paso banda (constelación, espectro y BER de una modulación), curvas BER, cadena completa y acerca de.

Con `voz_prototipo.wav` (9,9 s) solo hay audio para 3 canales de 2 s; la cuarta ranura TDM viaja vacía (código 0). La página de la cadena lo indica.

## Capturas

| Página | Captura |
|---|---|
| Inicio | [inicio.png](docs/capturas/inicio.png) |
| Paso banda, QPSK, Eb/N0 = 8 dB | [paso-banda-qpsk-8db.png](docs/capturas/paso-banda-qpsk-8db.png) |
| Paso banda, 16-QAM, Eb/N0 = 8 dB | [paso-banda-16qam-8db.png](docs/capturas/paso-banda-16qam-8db.png) |
| Curvas BER | [ber.png](docs/capturas/ber.png) |
| Cadena completa, Eb/N0 = 8 dB | [cadena-8db.png](docs/capturas/cadena-8db.png) |

## Enlaces

- Repositorio: https://github.com/juarezrildo/actividad6-transmision-digital (privado)
- Sitio: pendiente de despliegue en Vercel (ver `docs/ENTREGA.md`)
- Validación contra Python: [docs/VALIDACION.md](docs/VALIDACION.md)
- Entrega: [docs/ENTREGA.md](docs/ENTREGA.md)
