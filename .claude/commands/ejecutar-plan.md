---
description: Ejecuta PLAN.md completo con los agentes del proyecto y publica el resultado en GitHub
---

Ejecuta el plan de `PLAN.md` de principio a fin, siguiendo `CLAUDE.md`.

1. Lee `CLAUDE.md` y `PLAN.md`. Crea una lista de tareas con las fases 0 a 4.
2. Fase 0: hazla tú (preparación del entorno, `web/` con create-next-app, rama `dev`).
3. Fase 1: delega en el agente `dsp-engine`. Revisa su resumen y que `npm test` pase.
4. Fase 2: delega en el agente `ui-visualizacion`. Revisa que `npm run build` pase.
5. Fase 3: delega en el agente `qa-validacion`. Solo sigue si el resultado es APTO;
   si no, devuelve los fallos al agente correspondiente (máximo dos rondas).
6. Fase 4: delega en el agente `release-github`.
7. Al terminar, responde con:
   - URL del repositorio y del sitio,
   - tabla breve de validación (de `docs/VALIDACION.md`),
   - ruta de las capturas en `docs/capturas/` para adjuntarlas al informe.

Haz un commit en `dev` al cerrar cada fase, con el mensaje que indica PLAN.md.
Si falta una credencial (`gh`, `vercel`) o una herramienta, detente y dime exactamente qué
comando debo ejecutar.

$ARGUMENTS
