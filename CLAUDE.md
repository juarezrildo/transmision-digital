# CLAUDE.md — Actividad 6 · Comunicaciones Digitales I (RED-0310) · UPDS

## Qué es este repositorio
Proyecto grupal de la Actividad 6: una cadena completa de transmisión digital que envía
**4 canales de voz** por un solo enlace. Integra los cuatro temas de la materia:

| Tema | Dónde está |
|---|---|
| 1. Conversión A/D (PCM, SQNR) | `prototipo1/` (hardware) y `simulacion-python/` |
| 2. Banda base (códigos de línea) | `prototipo1/` (hardware) y `simulacion-python/` |
| 3. Paso banda (BPSK, QPSK, 16-QAM) | `simulacion-python/` y **`web/` (a construir)** |
| 4. Multiplexación TDM | `prototipo1/` (hardware) y `simulacion-python/` |

Integrantes: Rildo Jimmy Juarez Romero, Moises Antonio Cruz Garzon, Denis Yhair Rodriguez Quispe.
Docente: Ing. Esteban Soruco Sanchez. Entrega: 28 de octubre de 2026.

## Lo que hay que construir: `web/`
Un **simulador web del Tema 3 (paso banda) y de la cadena completa**, con el stack de SERTEC:
**Next.js (App Router) + React + TypeScript + Tailwind**, desplegado en **Vercel**.
No usa base de datos ni autenticación: todo el cálculo corre en el navegador (Web Worker).

La especificación completa, las fases y los criterios de aceptación están en **`PLAN.md`**.
El plan se ejecuta con el comando **`/ejecutar-plan`**.

## Fuente de verdad de los números
`simulacion-python/sistema.py` ya está validado. El motor TypeScript debe reproducir sus
resultados (`docs/resultados_python.json`) dentro de las tolerancias de `PLAN.md`.
Parámetros de diseño (no cambiarlos sin avisar):

- fs = 8 kHz, N = 8 bits, cuantificador uniforme de media contrahuella en [−1, 1)
- Trama TDM: SYNC `10011011` + 4 × 8 bits = 40 bits × 8000 tramas/s = **320 kbps**
- Código de línea del tramo de cable: **Manchester** (IEEE 802.3: 1 = subida, 0 = bajada)
- Coseno alzado (RRC en TX y RX), **α = 0,35**, 8 muestras por símbolo, 8 símbolos de duración
- Mapeo Gray: BPSK ±1; QPSK (±1 ± j)/√2; 16-QAM niveles {−3, −1, 1, 3}/√10 con Gray 00, 01, 11, 10
- Requisitos del caso: **B ≤ 250 kHz** y **BER ≤ 10⁻⁶**
- Resultado esperado: BPSK 432 kHz (no cumple), QPSK 216 kHz (cumple, 10,53 dB),
  16-QAM 108 kHz (cumple, 14,40 dB) → recomendación **QPSK**

## Reglas de trabajo
- Todo el texto visible en **español**, con **coma decimal** (`Intl.NumberFormat('es-BO')`).
- Gráficas con **título, ejes y unidades**, y una línea de interpretación debajo de cada una.
- Código y nombres de variables en español o inglés técnico, pero consistentes.
- Rama de trabajo **`dev`**; `main` solo recibe merges con todo en verde.
- Commits convencionales en español: `feat(dsp): ...`, `fix(ui): ...`, `test: ...`, `docs: ...`.
- Nunca `git push --force`, nunca borrar `prototipo1/` ni `simulacion-python/`.
- No inventar resultados: toda cifra que aparezca en la interfaz o en `docs/` sale del código.
- Antes de cerrar una fase: `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` en verde.

## Comandos útiles
```
cd web && npm run dev          # servidor local
cd web && npm test             # pruebas del motor DSP (vitest)
cd web && npm run build        # compilación de producción
python simulacion-python/sistema.py   # referencia en Python (numpy + matplotlib)
```
