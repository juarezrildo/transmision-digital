/*
  PROTOTIPO 1 - TRANSMISOR (Arduino Uno)
  Comunicaciones Digitales I (RED-0310) - UPDS - Actividad 6

  Cadena:  micrófono -> muestreo 8 kHz -> cuantificación 8 bits (PCM)
           -> trama TDM [SYNC | CH1 voz | CH2 PRBS] -> NRZ por la línea (pin D1)

  Trama TDM: 3 ranuras de 8 bits = 24 bits por trama, 8000 tramas/s
             -> 192 kbps de datos. La UART agrega start y stop (8N1),
             así que la línea va a 250 000 baudios (24 000 bytes/s de 25 000).

  Teclado (4x3):
    1 = voz del micrófono (TDM rápido)      0 = tono de 1 kHz en lugar de la voz
    2 = NRZ lento      3 = Manchester (IEEE 802.3)      4 = AMI
    5 = NRZI           6 = RZ unipolar
    # = cambia el patrón de bits de los modos lentos
  Modos lentos: 1 kbps, salidas para el osciloscopio:
    D9  = NRZ / Manchester / NRZI / RZ
    D10 + D11 = AMI (red de 2 resistencias + capacitor)
    D12 = disparo (trigger) al inicio del patrón
    D13 = LED: fijo en modos rápidos, parpadea en modos lentos
*/

#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/pgmspace.h>

// ---------------- Parámetros ----------------
const uint8_t SYNC = 0x9B;            // palabra de sincronismo (10011011)
const uint16_t TOP_8KHZ = 1999;       // 16 MHz / 8000 Hz - 1
const uint16_t TOP_2KHZ = 7999;       // medio bit a 1 kbps (2 kHz)

// Teclado 4x3 (ajustar si el orden de pines de tu teclado es distinto)
const uint8_t ROWS[4] = {2, 3, 4, 5};
const uint8_t COLS[3] = {6, 7, 8};
const char KEYS[4][3] = {{'1','2','3'},{'4','5','6'},{'7','8','9'},{'*','0','#'}};

const uint8_t PIN_SLOW = 9, PIN_AMI_P = 10, PIN_AMI_N = 11, PIN_TRIG = 12, PIN_LED = 13;

enum Modo { VOZ, TONO, NRZ, MANCH, AMI, NRZI, RZ };
volatile Modo modo = VOZ;

// Patrones de los modos lentos
const char PAT0[] = "101100001110101";   // actividad del docente (15 bits)
const char PAT1[] = "1011001";           // pregunta 25 del cuestionario
const char PAT2[] = "1111111100000000";  // rachas de unos y de ceros
const char* const PATS[3] = {PAT0, PAT1, PAT2};
volatile uint8_t patSel = 0;

// Tono de 1 kHz muestreado a 8 kHz (8 muestras por periodo)
const uint8_t SENO[8] PROGMEM = {128, 199, 228, 199, 128, 57, 28, 57};

// ---------------- UART propia (sin Serial) ----------------
volatile uint8_t txBuf[64];
volatile uint8_t txHead = 0, txTail = 0;

static inline void uartPut(uint8_t b) {
  uint8_t n = (txHead + 1) & 63;
  if (n == txTail) return;              // buffer lleno: se descarta (no debería ocurrir)
  txBuf[txHead] = b;
  txHead = n;
  UCSR0B |= _BV(UDRIE0);
}

ISR(USART_UDRE_vect) {
  if (txHead == txTail) { UCSR0B &= ~_BV(UDRIE0); return; }
  UDR0 = txBuf[txTail];
  txTail = (txTail + 1) & 63;
}

// PRBS-15 (x^15 + x^14 + 1): canal de prueba para medir BER
uint16_t prbs = 0x7FFF;
static inline uint8_t prbsByte() {
  uint8_t out = 0;
  for (uint8_t i = 0; i < 8; i++) {
    uint8_t nb = ((prbs >> 14) ^ (prbs >> 13)) & 1;
    prbs = (prbs << 1) | nb;
    out = (out << 1) | nb;
  }
  return out;
}

// ---------------- Estado de los modos lentos ----------------
volatile uint8_t idx = 0, mitad = 0, nivelNRZI = 0, polAMI = 0;

static inline void pin(uint8_t p, uint8_t v) { digitalWrite(p, v ? HIGH : LOW); }

static inline void amiNivel(int8_t n) {        // +1, 0, -1
  pin(PIN_AMI_P, n >= 0);                      // + : ambos en alto
  pin(PIN_AMI_N, n > 0);                       // 0 : P alto, N bajo ; - : ambos en bajo
}

void pasoLento() {
  const char* pat = PATS[patSel];
  uint8_t bit = pat[idx] - '0';

  if (mitad == 0) {
    // Disparo solo cuando el estado inicial es el de las tablas de la guía
    // (NRZI empieza en bajo, AMI con el primer 1 en +), para una imagen estable.
    bool trig = (idx == 0) &&
                !((modo == NRZI && nivelNRZI) || (modo == AMI && polAMI));
    pin(PIN_TRIG, trig);
  }

  switch (modo) {
    case NRZ:   pin(PIN_SLOW, bit); break;
    case MANCH: pin(PIN_SLOW, mitad == 0 ? !bit : bit); break;   // 1 = subida, 0 = bajada
    case RZ:    pin(PIN_SLOW, mitad == 0 ? bit : 0); break;
    case NRZI:
      if (mitad == 0 && bit) nivelNRZI ^= 1;                      // 1 = transición
      pin(PIN_SLOW, nivelNRZI); break;
    case AMI:
      if (mitad == 0) {
        if (bit) { polAMI ^= 1; amiNivel(polAMI ? 1 : -1); }       // los 1 alternan
        else amiNivel(0);
      }
      break;
    default: break;
  }

  if (mitad == 1) { idx++; if (pat[idx] == 0) idx = 0; }
  mitad ^= 1;
}

// ---------------- Temporizador principal ----------------
uint8_t fase = 0;

ISR(TIMER1_COMPA_vect) {
  if (modo == VOZ || modo == TONO) {
    uint8_t s;
    if (modo == VOZ) { s = ADCH; ADCSRA |= _BV(ADSC); }   // muestra de 8 bits y nueva conversión
    else { s = pgm_read_byte(&SENO[fase]); fase = (fase + 1) & 7; }
    uartPut(SYNC);          // ranura 0: sincronismo
    uartPut(s);             // ranura 1: canal 1 (voz o tono)
    uartPut(prbsByte());    // ranura 2: canal 2 (PRBS de prueba)
  } else {
    pasoLento();
  }
}

void setModo(Modo m) {
  cli();
  modo = m;
  idx = 0; mitad = 0; nivelNRZI = 0; polAMI = 0;
  OCR1A = (m == VOZ || m == TONO) ? TOP_8KHZ : TOP_2KHZ;
  TCNT1 = 0;
  pin(PIN_SLOW, 0); amiNivel(0); pin(PIN_TRIG, 0);
  sei();
}

// ---------------- Teclado ----------------
char leerTecla() {
  for (uint8_t r = 0; r < 4; r++) {
    pinMode(ROWS[r], OUTPUT); digitalWrite(ROWS[r], LOW);
    delayMicroseconds(5);
    for (uint8_t c = 0; c < 3; c++) {
      if (digitalRead(COLS[c]) == LOW) { pinMode(ROWS[r], INPUT); return KEYS[r][c]; }
    }
    pinMode(ROWS[r], INPUT);
  }
  return 0;
}

void setup() {
  for (uint8_t r = 0; r < 4; r++) pinMode(ROWS[r], INPUT);
  for (uint8_t c = 0; c < 3; c++) pinMode(COLS[c], INPUT_PULLUP);
  pinMode(PIN_SLOW, OUTPUT); pinMode(PIN_AMI_P, OUTPUT); pinMode(PIN_AMI_N, OUTPUT);
  pinMode(PIN_TRIG, OUTPUT); pinMode(PIN_LED, OUTPUT);

  // UART: 250 000 baudios, 8N1, solo transmisión (pin D1)
  UBRR0 = 3;                              // 16 MHz / (16 * 250 000) - 1
  UCSR0A = 0;
  UCSR0C = _BV(UCSZ01) | _BV(UCSZ00);
  UCSR0B = _BV(TXEN0);

  // ADC: A0, referencia AVcc (5 V), resultado de 8 bits (ADLAR), reloj de 500 kHz
  ADMUX  = _BV(REFS0) | _BV(ADLAR);
  ADCSRA = _BV(ADEN) | _BV(ADPS2) | _BV(ADPS0);
  ADCSRA |= _BV(ADSC);

  // Timer1 en modo CTC
  TCCR1A = 0;
  TCCR1B = _BV(WGM12) | _BV(CS10);        // sin preescalador
  OCR1A = TOP_8KHZ;
  TIMSK1 = _BV(OCIE1A);

  setModo(VOZ);
}

void loop() {
  static char ultima = 0;
  static unsigned long tParpadeo = 0;

  char k = leerTecla();
  if (k && k != ultima) {
    switch (k) {
      case '1': setModo(VOZ); break;
      case '0': setModo(TONO); break;
      case '2': setModo(NRZ); break;
      case '3': setModo(MANCH); break;
      case '4': setModo(AMI); break;
      case '5': setModo(NRZI); break;
      case '6': setModo(RZ); break;
      case '#': cli(); patSel = (patSel + 1) % 3; idx = 0; mitad = 0; sei(); break;
    }
  }
  ultima = k;
  delay(20);                              // antirrebote

  if (modo == VOZ || modo == TONO) digitalWrite(PIN_LED, HIGH);
  else if (millis() - tParpadeo > 250) { tParpadeo = millis(); digitalWrite(PIN_LED, !digitalRead(PIN_LED)); }
}
