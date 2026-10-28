"use client";

import { useSyncExternalStore } from "react";

function suscribir(avisar: () => void): () => void {
  // La consulta solo deja de cumplirse cuando cambia la densidad (zoom o mover la ventana de monitor).
  let consulta = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const alCambiar = () => {
    consulta.removeEventListener("change", alCambiar);
    consulta = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    consulta.addEventListener("change", alCambiar);
    avisar();
  };
  consulta.addEventListener("change", alCambiar);
  return () => consulta.removeEventListener("change", alCambiar);
}

/** devicePixelRatio actual; 1 en el servidor. */
export function useDevicePixelRatio(): number {
  return useSyncExternalStore(
    suscribir,
    () => window.devicePixelRatio || 1,
    () => 1,
  );
}
