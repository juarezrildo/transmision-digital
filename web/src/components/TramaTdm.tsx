import { BITS_TRAMA, FS, N_BITS, N_CANALES, RB, SYNC } from "@/lib/dsp";
import { formatoEntero } from "@/lib/formato";

interface TramaTdmProps {
  /** Ranuras que llevan voz; las demás se dibujan como vacías (bits en cero). */
  ranurasConVoz?: number;
  /** Muestra la línea de cálculo de la tasa binaria. */
  conTasa?: boolean;
}

/**
 * La trama TDM del enlace: SYNC + 4 ranuras de 8 bits. Se repite en inicio y en la cadena
 * completa para que la estructura del enlace se lea igual en todo el sitio.
 */
export function TramaTdm({ ranurasConVoz = N_CANALES, conTasa = true }: TramaTdmProps) {
  const sync = Array.from(SYNC).join("");
  const ranuras = Array.from({ length: N_CANALES }, (_, i) => i < ranurasConVoz);
  return (
    <div className="min-w-0">
      <ol className="grid grid-cols-5 border border-tinta text-center text-sm" aria-label="Trama TDM">
        <li className="border-r border-tinta bg-tinta px-1 py-2 text-white">
          <span className="block font-semibold">SYNC</span>
          <span className="block font-mono text-xs tracking-wide">{sync}</span>
        </li>
        {ranuras.map((conVoz, i) => (
          <li
            key={i}
            className={`px-1 py-2 ${i < N_CANALES - 1 ? "border-r border-tinta" : ""} ${
              conVoz
                ? "bg-white text-tinta"
                : "bg-[repeating-linear-gradient(135deg,#ffffff_0_6px,#e3e5e8_6px_8px)] text-tenue"
            }`}
          >
            <span className="block font-semibold">CH{i + 1}</span>
            <span className="block text-xs">{conVoz ? `${N_BITS} bits de voz` : "vacía, ceros"}</span>
          </li>
        ))}
      </ol>
      {conTasa && (
        <p className="mt-2 text-sm text-tenue">
          {BITS_TRAMA} bits por trama × {formatoEntero(FS)} tramas/s = {formatoEntero(RB / 1e3)} kbps
        </p>
      )}
    </div>
  );
}
