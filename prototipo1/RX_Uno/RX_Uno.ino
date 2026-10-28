/*
  PROTOTIPO 1 - RECEPTOR (Arduino Uno)
  Comunicaciones Digitales I (RED-0310) - UPDS - Actividad 6

  Cadena:  línea con ruido -> decisión por umbral (2 transistores 2N2222)
           -> UART 250 000 baudios (pin D0) -> alineación de trama (SYNC)
           -> demultiplexación TDM -> CH1: voz al parlante (PWM en D3 + TIP31C)
                                    -> CH2: comparación con la PRBS -> BER
  También reenvía cada byte recibido a la laptop por USB (pin D1) para que
  captura.py grabe la voz y calcule el BER.

  Display I2C 16x2 (SDA = A4, SCL = A5):
    fila 1: BER del último segundo y estado de sincronía (SINC / ----)
    fila 2: BER acumulado y número de pérdidas de trama (P)
  Para reiniciar el acumulado: desconectar la línea unos 3 segundos.
  Sin display: USAR_DISPLAY = 0; el LED 13 encendido indica trama sincronizada.

  Biblioteca necesaria: "LiquidCrystal I2C" (Frank de Brabander), desde el
  Gestor de bibliotecas. Si el display no muestra nada, probar la dirección 0x3F.
*/

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <avr/io.h>
#include <avr/interrupt.h>
#include <stdlib.h>

// Poner en 0 para trabajar sin display (el LED 13 indica la sincronía)
#define USAR_DISPLAY 0

LiquidCrystal_I2C lcd(0x27, 16, 2);

const uint8_t SYNC = 0x9B;
const uint8_t PIN_AUDIO = 3;              // OC2B: PWM de audio a 62,5 kHz

// Conteo de unos en un nibble (para contar bits erróneos rápido)
const uint8_t POP4[16] = {0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4};
static inline uint8_t popc(uint8_t x) { return POP4[x & 15] + POP4[x >> 4]; }

// ---------------- Reenvío a la laptop ----------------
volatile uint8_t txBuf[128];
volatile uint8_t txHead = 0, txTail = 0;

static inline void uartPut(uint8_t b) {
  uint8_t n = (txHead + 1) & 127;
  if (n == txTail) return;
  txBuf[txHead] = b;
  txHead = n;
  UCSR0B |= _BV(UDRIE0);
}

ISR(USART_UDRE_vect) {
  if (txHead == txTail) { UCSR0B &= ~_BV(UDRIE0); return; }
  UDR0 = txBuf[txTail];
  txTail = (txTail + 1) & 127;
}

// ---------------- Estado del receptor ----------------
volatile uint32_t bitsVer = 0, bitsErr = 0;   // bits verificados y erróneos (SYNC + CH2)
volatile uint32_t perdidas = 0;               // pérdidas de alineación de trama
volatile uint32_t erroresUART = 0;            // bits de parada erróneos
volatile bool sincronizado = false;

uint8_t hist[7];                              // últimos 7 bytes (búsqueda de trama)
uint8_t fase = 0;                             // 0 = CH1, 1 = CH2, 2 = SYNC
uint8_t fallosSync = 0;

uint8_t prbsEstado = 0;                       // 0/1 = sembrando, 2 = enganchada
uint8_t prbsPrev = 0;
uint16_t prbs = 0;
uint8_t ventErr = 0, ventCnt = 0;

static inline uint8_t prbsByte() {
  uint8_t out = 0;
  for (uint8_t i = 0; i < 8; i++) {
    uint8_t nb = ((prbs >> 14) ^ (prbs >> 13)) & 1;
    prbs = (prbs << 1) | nb;
    out = (out << 1) | nb;
  }
  return out;
}

ISR(USART_RX_vect) {
  uint8_t st = UCSR0A;
  uint8_t b = UDR0;
  if (st & _BV(FE0)) erroresUART++;
  uartPut(b);                                 // copia fiel a la laptop

  if (!sincronizado) {
    for (uint8_t i = 6; i > 0; i--) hist[i] = hist[i - 1];
    hist[0] = b;
    // Alineación: SYNC repetido cada 3 bytes en tres tramas seguidas
    if (hist[0] == SYNC && hist[3] == SYNC && hist[6] == SYNC) {
      sincronizado = true; fase = 0; fallosSync = 0; prbsEstado = 0;
    }
    return;
  }

  switch (fase) {
    case 0:                                   // CH1: voz
      OCR2B = b;
      fase = 1;
      break;

    case 1:                                   // CH2: PRBS de prueba
      if (prbsEstado == 0) { prbsPrev = b; prbsEstado = 1; }
      else if (prbsEstado == 1) {             // sembrar con 16 bits recibidos
        prbs = ((uint16_t)prbsPrev << 8) | b;
        prbsEstado = 2; ventErr = 0; ventCnt = 0;
      } else {
        uint8_t e = popc(b ^ prbsByte());
        bitsErr += e; bitsVer += 8;
        ventErr += e;
        if (++ventCnt == 32) {                // 256 bits: si más del 25 % falla, re-sembrar
          if (ventErr > 64) prbsEstado = 0;
          ventErr = 0; ventCnt = 0;
        }
      }
      fase = 2;
      break;

    case 2: {                                 // ranura de sincronismo
      uint8_t e = popc(b ^ SYNC);
      bitsErr += e; bitsVer += 8;
      if (b != SYNC) {
        if (++fallosSync >= 4) {              // 4 tramas seguidas sin SYNC: se pierde la trama
          sincronizado = false; perdidas++;
          for (uint8_t i = 0; i < 7; i++) hist[i] = 0;
          OCR2B = 128;                        // silencio
        }
      } else fallosSync = 0;
      fase = 0;
      break;
    }
  }
}

// ---------------- Display ----------------
void sci(char* out, float v) {                // 1.2e-04
  if (v <= 0) { strcpy(out, "0.0e+00"); return; }
  dtostre(v, out, 1, 0);
}

void setup() {
  // UART 250 000 baudios, 8N1: recepción (D0, línea) y transmisión (D1, laptop)
  UBRR0 = 3;
  UCSR0A = 0;
  UCSR0C = _BV(UCSZ01) | _BV(UCSZ00);
  UCSR0B = _BV(RXEN0) | _BV(TXEN0) | _BV(RXCIE0);

  // PWM de audio: Timer2 fast PWM, 62,5 kHz, salida OC2B (D3)
  pinMode(PIN_AUDIO, OUTPUT);
  TCCR2A = _BV(COM2B1) | _BV(WGM21) | _BV(WGM20);
  TCCR2B = _BV(CS20);
  OCR2B = 128;

  pinMode(LED_BUILTIN, OUTPUT);            // LED 13: encendido = trama sincronizada
#if USAR_DISPLAY
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("RX UPDS RED-0310");
  lcd.setCursor(0, 1); lcd.print("Esperando trama");
  delay(1500);
#endif
}

void loop() {
  static uint32_t vAnt = 0, eAnt = 0;          // para el BER del último segundo
  static uint32_t vBase = 0, eBase = 0;        // base del acumulado
  static uint8_t segSinSinc = 0;
  static unsigned long t0 = 0;

  digitalWrite(LED_BUILTIN, sincronizado ? HIGH : LOW);
  if (millis() - t0 < 1000) return;
  t0 = millis();

  cli();
  uint32_t v = bitsVer, e = bitsErr, p = perdidas;
  bool s = sincronizado;
  sei();

  if (!s) { if (segSinSinc < 255) segSinSinc++; } else segSinSinc = 0;
  if (segSinSinc >= 3) { vBase = v; eBase = e; cli(); perdidas = 0; sei(); p = 0; }

  char l1[17], l2[17], n[12];
  uint32_t dv = v - vAnt, de = e - eAnt;
  vAnt = v; eAnt = e;

  if (dv) { sci(n, (float)de / dv); snprintf(l1, 17, "BER %s %s", n, s ? "SINC" : "----"); }
  else snprintf(l1, 17, "BER --      %s", s ? "SINC" : "----");

  uint32_t tv = v - vBase, te = e - eBase;
  if (tv) { sci(n, (float)te / tv); snprintf(l2, 17, "TOT %s P%lu", n, (unsigned long)(p > 999 ? 999 : p)); }
  else snprintf(l2, 17, "TOT --  sin datos");

#if USAR_DISPLAY
  lcd.setCursor(0, 0); lcd.print(l1); for (uint8_t i = strlen(l1); i < 16; i++) lcd.print(' ');
  lcd.setCursor(0, 1); lcd.print(l2); for (uint8_t i = strlen(l2); i < 16; i++) lcd.print(' ');
#endif
}
