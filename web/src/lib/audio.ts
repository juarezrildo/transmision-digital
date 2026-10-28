/**
 * URL data: de un WAV para <audio>. Es una función pura (a diferencia de createObjectURL),
 * así que no hay URL que revocar ni fugas al recalcular; un WAV de 2 s a 16 bits ocupa 32 kB.
 */
export function wavADataUrl(wav: ArrayBuffer): string {
  const bytes = new Uint8Array(wav);
  const trozo = 0x8000;
  let binario = "";
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + trozo));
  }
  return `data:audio/wav;base64,${btoa(binario)}`;
}
