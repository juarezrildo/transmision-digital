# Entrega de la Actividad 6

## Enlaces

| Elemento | Valor |
|---|---|
| Repositorio (privado) | https://github.com/juarezrildo/actividad6-transmision-digital |
| Rama principal | `main` (recibe `dev` con merge `--no-ff`) |
| Sitio web | **Pendiente.** Se publica al importar el repositorio en Vercel (pasos abajo) |
| Commit de la entrega | ver nota |

Nota sobre el hash: este archivo se escribe dentro del propio commit de entrega en `dev`, así que no puede contener su hash. Se obtiene con `git log -1 --format=%H dev` y aparece en el informe de publicación; `main` lo incorpora con el merge `merge: entrega Actividad 6`.

## Cómo publicar el sitio en Vercel

La CLI de Vercel no está instalada en el equipo de trabajo, así que el despliegue se hace desde la web:

1. Entrar a https://vercel.com con la cuenta de GitHub `juarezrildo`.
2. **Add New → Project → Import Git Repository.** Como el repositorio es privado, Vercel pide instalar su app de GitHub: autorizarla para `actividad6-transmision-digital` (o para todos los repositorios).
3. Elegir el repositorio y configurar:
   - **Root Directory:** `web`
   - **Framework Preset:** Next.js
   - Comandos de build e instalación: los que Vercel propone por defecto.
   - Rama de producción: `main`.
4. **Deploy.** Al terminar, copiar la URL `https://….vercel.app` en la tabla de arriba y en el README.

No hace falta configurar variables de entorno: el sitio no usa servidor ni base de datos.

## Capturas (`docs/capturas/`)

| Archivo | Contenido |
|---|---|
| `inicio.png` | Página de inicio |
| `paso-banda-qpsk-8db.png` | Paso banda con QPSK, Eb/N0 = 8 dB |
| `paso-banda-16qam-8db.png` | Paso banda con 16-QAM, Eb/N0 = 8 dB |
| `ber.png` | Curvas BER de BPSK, QPSK y 16-QAM |
| `cadena-8db.png` | Cadena completa con QPSK, Eb/N0 = 8 dB |

Todas son de página completa a 1280 px de ancho. La validación contra Python está en `docs/VALIDACION.md` (resultado: APTO).

## Párrafo para el anexo del informe

> **Anexo. Simulador web de la transmisión paso banda.** Como complemento del prototipo y de la simulación en Python, el grupo desarrolló un simulador web con Next.js, React y TypeScript. Todo el cálculo se ejecuta en el navegador y reproduce los resultados de `sistema.py` dentro de las tolerancias fijadas. En la página de paso banda se elige la modulación (BPSK, QPSK o 16-QAM) y la relación Eb/N0, y se observan la constelación recibida, la forma de onda sobre la portadora de 1 MHz, el espectro con filtro de raíz de coseno alzado (α = 0,35) y la BER medida frente a la teórica. La página de curvas BER compara las tres modulaciones con los requisitos del caso, B ≤ 250 kHz y BER ≤ 10⁻⁶: BPSK ocupa 432 kHz y no cumple; QPSK ocupa 216 kHz y cumple con 10,53 dB; 16-QAM ocupa 108 kHz y cumple con 14,40 dB. Por eso se recomienda QPSK. La página de la cadena completa recorre PCM a 8 kHz y 8 bits, la trama TDM de 40 bits a 320 kbps, el código Manchester y la modulación, hasta recuperar la voz. Con la grabación del prototipo (`voz_prototipo.wav`, 9,9 s) hay audio para 3 canales, y la cuarta ranura viaja vacía. Para abrir el simulador basta con entrar a la dirección del sitio publicado en Vercel [URL del sitio]. También puede ejecutarse en local desde la carpeta `web` del repositorio con `npm install` y `npm run dev`, y abrirse en http://localhost:3000.
