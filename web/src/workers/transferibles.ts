/**
 * Reúne los ArrayBuffer de un mensaje (sueltos o detrás de typed arrays) para pasarlos
 * como Transferable. Cada buffer aparece una sola vez: repetirlo hace fallar postMessage.
 * Ojo: transferir separa el buffer del emisor, así que solo se transfiere lo que no se reutiliza.
 */
export function recolectarTransferibles(valor: unknown, acumulado: Set<ArrayBuffer> = new Set()): ArrayBuffer[] {
  if (valor instanceof ArrayBuffer) {
    acumulado.add(valor);
  } else if (ArrayBuffer.isView(valor)) {
    if (valor.buffer instanceof ArrayBuffer) acumulado.add(valor.buffer);
  } else if (Array.isArray(valor)) {
    for (const v of valor) recolectarTransferibles(v, acumulado);
  } else if (valor !== null && typeof valor === "object") {
    for (const v of Object.values(valor)) recolectarTransferibles(v, acumulado);
  }
  return [...acumulado];
}
