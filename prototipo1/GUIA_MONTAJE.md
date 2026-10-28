# Prototipo 1 — Enlace TDM de voz en banda base con ruido

Comunicaciones Digitales I (RED-0310) · UPDS · Actividad 6

## Qué demuestra

```
Micrófono → PCM 8 kHz / 8 bits → TDM [SYNC | voz | PRBS] → NRZ por cable UTP
        → + ruido regulable → decisión por umbral → alineación de trama
        → demultiplexación → voz al parlante + BER en el display
```

| Parámetro | Valor |
|---|---|
| Muestreo / cuantificación | 8 kHz, 8 bits (64 kbps por canal) |
| Trama TDM | 3 ranuras × 8 bits = 24 bits: SYNC (10011011), CH1 voz, CH2 PRBS-15 |
| Tasa de tramas | 8000 tramas/s → 192 kbps de datos |
| Línea | NRZ unipolar, UART 8N1 a 250 000 baudios (24 000 de 25 000 bytes/s) |
| Umbral de decisión | ≈ 2,0 V en el nodo de la línea |
| Medición de BER | CH2 (PRBS) + palabra SYNC = 128 000 bits verificados por segundo |

## Reparto de placas

| Placa | Función | Alimentación |
|---|---|---|
| Arduino Uno #1 | Transmisor: micrófono, teclado, trama, línea | USB (laptop o cargador) |
| Arduino Uno #2 | Receptor: decisión, display, parlante, envío a la laptop | USB de la laptop |
| Arduino Nano | Generador de ruido | Pin 5V y GND del Uno #1 |

No hace falta fuente externa: todo sale de los pines **5V** de los Arduino. Lo único obligatorio es la **masa común**: unir los GND de las tres placas (un hilo del par UTP lleva la masa entre TX y RX).

## Conexiones por pin

**Uno TX**

| Pin | Conexión |
|---|---|
| D1 (TX) | Línea: resistencia en serie → cable UTP (esquema B): **1 kΩ** sin ruido, **4,7 kΩ** en la etapa de ruido |
| A0 | Salida del preamplificador del micrófono (esquema A) |
| D2–D5 | Filas del teclado |
| D6–D8 | Columnas del teclado |
| D9 | Salida lenta NRZ / Manchester / NRZI / RZ (osciloscopio) |
| D10, D11 | Red AMI (esquema D) |
| D12 | Disparo (trigger) del osciloscopio |
| 5V, GND | Preamplificador y Nano |

**Uno RX**

| Pin | Conexión |
|---|---|
| D0 (RX) | Colector de Q2 (esquema B) |
| D3 | Base del TIP31C con 1 kΩ (esquema C) |
| A4 (SDA), A5 (SCL) | Display I2C |
| 5V, GND | Display, Q1, Q2, parlante |

**Nano:** D2 → filtro de ruido (esquema B). 5V y GND desde el Uno TX.

**Teclado:** el orden de pines varía según el modelo. Si una tecla no responde o responde otra, cambia los arreglos `ROWS` y `COLS` al inicio de `TX_Uno.ino`.

## Esquemas

- `esquemas/A_microfono_TX.png` — electret, preamplificador 2N2222 (ganancia ≈ 96, punto de reposo 2,5 V) y filtro antialiasing con 1 nF (102) en paralelo: 4 → fc ≈ 4 kHz, 5 → 3,2 kHz, 3 → 5,3 kHz.
- `esquemas/B_linea_ruido_RX.png` — línea, nodo de suma del ruido y receptor de decisión con dos 2N2222.
- `esquemas/C_audio_RX.png` — parlante con TIP31C.
- `esquemas/D_AMI_TX.png` — red de tres niveles para AMI.

Notas del esquema B:
- El **potenciómetro** se usa como resistencia variable: un extremo y el cursor (pata central).
- **Dos 102 de aceleración**, cada uno en paralelo con la resistencia de base de 10 kΩ de Q1 y de Q2. Sacan rápido la carga de la base en cada flanco; sin ellos, a 250 kbaud los transistores se apagan tarde y aparecen bytes falsos.
- **Q1 + Q2** forman el umbral de decisión: el divisor de 10 kΩ / 4,7 kΩ hace que Q1 conduzca cuando el nodo supera ≈ 2,0 V. Q2 vuelve a invertir para que la lógica no quede negada. Además aíslan la línea del chip USB del Uno, que también está conectado al pin D0.
- Filtro de ruido: **1 kΩ + dos 1 nF (102) en paralelo** (fc ≈ 80 kHz). **No uses el 104 (100 nF):** filtra demasiado y el ruido casi desaparece.
- Los **104** sirven para desacoplar: pon uno entre 5V y GND cerca de cada transistor.
- **Patas del 2N2222:** según el fabricante pueden ser E–B–C o C–B–E (cara plana al frente, patas abajo). Compruébalo con el multímetro en modo diodo: la base es la pata que marca ≈ 0,6 V hacia las otras dos. TIP31C de frente: **B – C – E**.

## Software

1. Arduino IDE → Gestor de bibliotecas → instalar **LiquidCrystal I2C** (Frank de Brabander).
2. Cargar `TX_Uno/TX_Uno.ino` en el Uno #1, `RX_Uno/RX_Uno.ino` en el Uno #2 y `Ruido_Nano/Ruido_Nano.ino` en el Nano (placa "Arduino Nano"; si falla la carga, procesador "ATmega328P (Old Bootloader)").
3. **Al cargar el RX, desconecta el cable de D0** (si no, la línea interfiere con la carga). Al cargar el TX, desconecta D1.
4. En la laptop: `pip install pyserial numpy scipy matplotlib`.

Si el display queda en blanco o con cuadros: ajusta el contraste con el tornillo del módulo I2C, y si sigue sin texto cambia `0x27` por `0x3F` en `RX_Uno.ino`.

## Montaje por etapas (probar cada una antes de seguir)

**Etapa 1 — Enlace sin ruido, con tono.**
Arma solo la línea y el receptor del esquema B (sin el Nano). Pulsa **0** en el teclado (tono de 1 kHz).
- Display: `BER 0.0e+00 SINC`.
- Parlante: tono de 1 kHz limpio.
- Laptop: `python captura.py --puerto COM5 --segundos 10 --nombre etapa1` → BER = 0.

Si no sincroniza: revisa la masa común, que Q2 llegue a D0 y la orientación de los transistores. En TP3 (D0) deben verse bits limpios de 0 a 5 V.

**Etapa 2 — Voz.**
Arma el esquema A y pulsa **1**. Habla cerca del micrófono. En A0, sin hablar, deben medirse unos **2,5 V** de continua; si se mide cerca de 0 V o 5 V, el transistor está mal conectado o polarizado.

**Etapa 3 — Ruido.**
1. Cambia la resistencia de línea de 1 kΩ a **4,7 kΩ** (con los dos 102 de aceleración puestos). Pulsa **0** y captura sin ruido: debe seguir dando BER 0.
2. Carga `Ruido_Nano.ino` en el Nano.
3. Nano **5V** y **GND** al riel de la protoboard del receptor.
4. Nano **D2 → 1 kΩ → nodo del filtro**. Del nodo del filtro, **dos 102 en paralelo a GND**.
5. Del nodo del filtro, el **potenciómetro** (un extremo y el cursor) hasta el **NODO** de la línea.
6. Empieza con el potenciómetro en **10 kΩ** (poco ruido) y bájalo por pasos. En cada paso, mide antes su resistencia con el circuito desconectado y captura 10 s: el BER sube y la voz empieza a tener chasquidos (bits erróneos en las muestras PCM).

**Etapa 4 — Osciloscopio (Actividad 7).**
Teclas 2 a 6 para NRZ, Manchester, AMI, NRZI y RZ a 1 kbps; **#** cambia el patrón (101100001110101, 1011001 o rachas de unos y ceros). Sonda en D9 (o en la salida AMI) y disparo externo en D12. En TP2 se ve la señal con ruido y el umbral; con persistencia, el **diagrama de ojo**.

## Mediciones para el informe

1. Con el tono (tecla 0), para 5 o 6 posiciones del potenciómetro:
   - Mide con el multímetro la resistencia entre extremo y cursor (desconectado).
   - Mide en TP2 con el osciloscopio la amplitud de la señal y del ruido (desviación o valor RMS; muchos osciloscopios lo dan en "Measure").
   - Captura 10 s: `python captura.py --puerto COM5 --segundos 10 --nombre pot_4k7`.
2. `resultados/resumen.csv` acumula una fila por captura: con eso se arma la curva **BER medido vs. relación señal/ruido**, que se compara con la curva teórica Q(A/σ) de la simulación.
3. Repite una captura con voz (tecla 1) sin ruido y otra con ruido: los WAV permiten comparar la voz original y la recuperada.

BER esperado según el modelo del circuito (orientativo; las tolerancias lo mueven):

Con línea de 4,7 kΩ, los dos 102 de aceleración y el filtro de 1 kΩ + 2 nF:

| Potenciómetro | 0 | 1 kΩ | 2 kΩ | 3 kΩ | 4 kΩ | ≥ 5 kΩ |
|---|---|---|---|---|---|---|
| BER aprox. | 3e-1 | 2e-1 | 1e-1 | 3e-2 | 1e-3 | < 1e-6 |

La zona útil está entre 0 y 5 kΩ: conviene tomar puntos cada 0,5 kΩ entre 2 y 5 kΩ.

Si el BER cambia demasiado de golpe, agrega o quita un 102 en paralelo en el filtro de ruido (más capacitancia = menos ruido).

## Prueba sin hardware

`python captura.py --simular 1e-3 --segundos 8` genera la misma trama que el TX, le aplica errores y la decodifica. Sirve para practicar y para comprobar la instalación de Python.

## Alcance y simplificaciones

- 2 canales (voz + canal de prueba) en lugar de los 4 del diseño; la cadena de 4 canales completa está en la simulación.
- La línea usa NRZ unipolar con la UART del Arduino (start y stop bits incluidos). Manchester, AMI, NRZI y RZ se muestran a 1 kbps.
- El ruido es una secuencia pseudoaleatoria filtrada: aproximadamente gaussiano, no AWGN ideal.
- La sincronización de bit la hace la UART (sobremuestreo ×16); la de trama, la palabra SYNC.

## Lo que se aprendió en el montaje (útil para el informe)

| Prueba | Resultado | Conclusión |
|---|---|---|
| Línea 10 kΩ, sin capacitores de aceleración | BER ≈ 0,45, unas 740 pérdidas de trama por segundo | Flancos lentos (constante RC del cable) y transistores saturados que se apagan tarde: aparecen bytes falsos |
| TX conectado directo al RX | BER = 0 | El software, la trama TDM y la sincronía funcionan |
| Línea 1 kΩ con el receptor de transistores | BER = 0 (1,27 millones de bits), voz recuperada | Flancos rápidos: la decisión se toma bien a mitad de bit |
| Simulación SPICE (2N2222) | 4,7 kΩ + dos 102: distorsión de flancos ≈ 0,1 µs sobre 4 µs | Los capacitores de aceleración permiten subir la resistencia de línea para la etapa de ruido |

Es un ejemplo práctico de interferencia entre símbolos: un ancho de banda insuficiente en el canal (RC) deforma los pulsos y el receptor decide mal, aunque no haya ruido.
