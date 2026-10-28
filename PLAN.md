# PLAN DE EJECUCIÓN — Simulador web del Tema 3 y de la cadena completa

Orquestador: la sesión principal de Claude Code (comando `/ejecutar-plan`).
Agentes: `dsp-engine`, `ui-visualizacion`, `qa-validacion`, `release-github`
(definidos en `.claude/agents/`).

---

## Fase 0 — Preparación (orquestador)
1. Verificar herramientas: `node -v` (≥ 20), `npm -v`, `git --version`, `gh auth status`.
   - Si `gh` no está autenticado: **detenerse** y pedir `gh auth login` al usuario.
2. `git init` si hace falta, crear rama `dev` y hacer un primer commit con el contenido actual
   (`chore: estado inicial del proyecto`).
3. Crear `web/` con Next.js + TypeScript + Tailwind + App Router + ESLint:
   `npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack`
4. Agregar `vitest` y `@vitest/coverage-v8` como dependencias de desarrollo y los scripts
   `test`, `typecheck` (`tsc --noEmit`) en `web/package.json`.
5. Copiar `simulacion-python/datos/voz_prototipo.wav` a `web/public/voz_prototipo.wav`.

**Criterio de salida:** `npm run build` compila la plantilla vacía.

---

## Fase 1 — Motor DSP en TypeScript (`dsp-engine`)
Carpeta `web/src/lib/dsp/`, funciones puras, sin dependencias externas:

| Archivo | Contenido |
|---|---|
| `random.ts` | PRNG con semilla (mulberry32) y gaussiana (Box-Muller) |
| `math.ts` | `erfc` (aproximación de Abramowitz-Stegun 7.1.26 o mejor), `Q(x)`, FFT radix-2, Welch (Hann, 50 %) |
| `pcm.ts` | cuantificador uniforme N bits, codificación/decodificación, SQNR |
| `tdm.ts` | multiplexar 4 canales + SYNC, sincronizar (buscar SYNC), demultiplexar |
| `lineCodes.ts` | NRZ unipolar, NRZ polar, Manchester, AMI (codificar y decodificar) |
| `modulation.ts` | mapeo/demapeo Gray BPSK, QPSK, 16-QAM; filtro RRC; modulación y demodulación en banda base compleja; conversión a paso banda con fc |
| `channel.ts` | AWGN complejo a partir de Eb/N0 |
| `ber.ts` | BER teórica, Eb/N0 requerido por bisección, Monte Carlo |
| `wav.ts` | leer y escribir WAV PCM 8 y 16 bits |
| `chain.ts` | cadena completa: voz → PCM → TDM → Manchester → modulación → AWGN → demodulación → sincronía → demux → voz |

Pruebas (`web/src/lib/dsp/__tests__/`), tolerancias contra `docs/resultados_python.json`:
- SQNR de un seno a plena escala: |simulado − (6,02·N + 1,76)| < 0,5 dB para N = 6, 8, 10.
- Sin ruido: la cadena completa recupera los 4 canales **bit a bit idénticos** (BER = 0).
- Eb/N0 requerido para 10⁻⁶: BPSK y QPSK 10,53 ± 0,05 dB; 16-QAM 14,40 ± 0,05 dB.
- Ancho de banda (1 + α)·Rs: 432, 216 y 108 kHz exactos.
- BER Monte Carlo (≥ 10⁶ bits) en 4, 6 y 8 dB dentro de ±20 % de la teoría.
- Manchester y AMI sin componente DC (|media| < 10⁻³).

**Criterio de salida:** `npm test` en verde y cobertura ≥ 80 % en `lib/dsp`.
Commit: `feat(dsp): motor de la cadena de transmisión digital`.

---

## Fase 2 — Interfaz (`ui-visualizacion`)
Cálculo pesado en un **Web Worker** (`src/workers/sim.worker.ts`) para no congelar la página.
Gráficas en `<canvas>` propio o con Recharts; ejes con unidades y coma decimal.

Páginas (App Router):
1. **`/`  Inicio** — escenario empresarial (4 canales de voz, B ≤ 250 kHz, BER ≤ 10⁻⁶),
   diagrama de bloques y enlaces a las demás páginas.
2. **`/paso-banda`  Tema 3** — selector BPSK / QPSK / 16-QAM y deslizador Eb/N0 (0–20 dB):
   - forma de onda paso banda (portadora visible, cambios de fase),
   - constelación recibida (puntos ideales + nube con ruido),
   - espectro con la **máscara de 250 kHz** sombreada y el ancho de banda calculado,
   - BER medida en vivo frente a la teórica,
   - tarjeta "¿Cumple los requisitos?" (ancho de banda y BER) para la modulación elegida.
3. **`/ber`  Curvas** — BER vs Eb/N0 de las tres modulaciones (teoría + Monte Carlo),
   línea de 10⁻⁶ y tabla de Eb/N0 requerido, C/N requerido y eficiencia espectral.
4. **`/cadena`  Cadena completa** — usa `voz_prototipo.wav` (o un WAV que suba el usuario):
   - reproduce la voz original y la recuperada para el Eb/N0 elegido,
   - superpone las formas de onda y los espectros,
   - muestra BER, errores, desplazamiento de trama detectado y SNR de salida.
5. **`/acerca`** — integrantes, materia, docente, relación con el Prototipo 1 y con la
   simulación en Python.

Diseño: Tailwind, sobrio y técnico, modo claro, legible a 1280 px y en celular.
Accesibilidad: contraste ≥ 4,5:1, etiquetas en los controles.

**Criterio de salida:** las cinco páginas funcionan en `npm run dev` sin errores de consola.
Commit: `feat(ui): simulador web de paso banda y cadena completa`.

---

## Fase 3 — Validación (`qa-validacion`)
1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`: todo en verde.
2. Prueba manual guiada con Playwright (`npx playwright install chromium` si hace falta):
   abrir cada página, fijar QPSK y Eb/N0 = 8 dB, y guardar capturas en
   `docs/capturas/` (`inicio.png`, `paso-banda-qpsk-8db.png`, `ber.png`, `cadena-8db.png`,
   `paso-banda-16qam-8db.png`). Estas capturas van al informe.
3. Comparar los valores mostrados con `docs/resultados_python.json` y escribir
   `docs/VALIDACION.md` con una tabla: magnitud · Python · Web · diferencia · ¿dentro de tolerancia?

**Criterio de salida:** `docs/VALIDACION.md` sin filas fuera de tolerancia.
Commit: `test: validación del simulador web contra la referencia en Python`.

---

## Fase 4 — Publicación (`release-github`)
1. Crear el repositorio (si no existe):
   `gh repo create actividad6-transmision-digital --public --source . --remote origin --description "Actividad 6 · Comunicaciones Digitales I (RED-0310) · UPDS"`
   (usar `--private` si el usuario lo pide).
2. `git push -u origin dev`, luego merge `dev → main` sin fast-forward y `git push origin main`.
3. Despliegue: si `vercel whoami` responde, `cd web && vercel --prod --yes`; si no, dejar
   instrucciones en `docs/ENTREGA.md` para conectar el repositorio en vercel.com
   (directorio raíz: `web`).
4. Escribir `README.md` (raíz) con: descripción, estructura, cómo ejecutar cada parte
   (Arduino, `captura.py`, `sistema.py`, `web/`), enlaces al sitio y a las capturas.
5. Escribir `docs/ENTREGA.md` con: URL del repositorio, URL del sitio, hash del commit final,
   lista de capturas y el párrafo listo para pegar en el informe (sección de anexos).

**Criterio de salida:** `main` publicado, `docs/ENTREGA.md` con las URL reales.
Commit: `docs: entrega de la Actividad 6`.

---

## Reglas del orquestador
- Ejecutar las fases **en orden**. Dentro de la Fase 2, la interfaz puede avanzar en paralelo
  con pruebas adicionales del motor, pero no antes de cerrar la Fase 1.
- Después de cada fase: revisar el criterio de salida y hacer el commit indicado en `dev`.
- Si un criterio falla dos veces seguidas: detenerse, explicar el problema y pedir indicación.
- Al terminar: mostrar al usuario la URL del repositorio, la URL del sitio y la ruta de
  `docs/capturas/` para adjuntar al informe.
