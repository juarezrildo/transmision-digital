# Cómo arrancar los agentes (una sola vez)

## Requisitos en tu PC
1. **Node.js 20 o superior** y **Git**.
2. **Claude Code** instalado (`npm install -g @anthropic-ai/claude-code`) y con sesión iniciada.
3. **GitHub CLI** con sesión: `gh auth login` (elige HTTPS y tu cuenta).
4. Opcional, para publicar el sitio: **Vercel CLI** (`npm i -g vercel`) y `vercel login`.
5. Python con `pip install numpy matplotlib` (solo para la simulación de referencia).

## Opción A: automática al abrir la carpeta en VS Code
1. Descomprime esta carpeta y ábrela en VS Code (**Archivo → Abrir carpeta**).
2. La primera vez, VS Code pregunta si permite **tareas automáticas**:
   elige **Permitir** (o `Ctrl+Shift+P` → "Tasks: Manage Automatic Tasks" → **Allow**).
3. Al abrirse, la tarea ejecuta `claude "/ejecutar-plan"` en una terminal y los agentes
   trabajan fase por fase. Aprueba los permisos que pida la primera vez.

## Opción B: manual
En la terminal de VS Code, dentro de la carpeta:
```
claude "/ejecutar-plan"
```
o abre `claude` y escribe `/ejecutar-plan`.

## Qué hace el plan (detalle en PLAN.md)
| Fase | Agente | Resultado |
|---|---|---|
| 0 | sesión principal | `web/` con Next.js + Tailwind, rama `dev` |
| 1 | `dsp-engine` | motor DSP en TypeScript con pruebas contra Python |
| 2 | `ui-visualizacion` | páginas: inicio, paso banda, curvas BER, cadena completa, acerca |
| 3 | `qa-validacion` | pruebas, build, capturas en `docs/capturas/`, `docs/VALIDACION.md` |
| 4 | `release-github` | repositorio en GitHub, merge a `main`, Vercel, `docs/ENTREGA.md` |

## Lo que me devuelves para el informe
- La URL del repositorio y del sitio (están en `docs/ENTREGA.md`).
- Las capturas de `docs/capturas/`.
