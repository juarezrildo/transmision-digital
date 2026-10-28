import { B_MAX, BER_MAX, type FilaModulacion } from "@/lib/dsp";
import { formatoCientifico, formatoCompacto, formatoDecimal } from "@/lib/formato";
import { ESTILO_MODULACION } from "@/lib/modulacionesUi";

interface TablaModulacionesProps {
  filas: readonly FilaModulacion[];
  /** Columnas de diseño completas (Rs, C/N, η) o solo las de la decisión. */
  completa?: boolean;
  /** Modulación recomendada, resaltada en la tabla. */
  recomendada?: string | null;
}

function Cumple({ cumple }: { cumple: boolean }) {
  return cumple ? (
    <span className="text-tinta">Sí</span>
  ) : (
    <span className="font-semibold text-falla">No</span>
  );
}

/** Tabla de diseño calculada por `tablaModulaciones()` del motor. */
export function TablaModulaciones({ filas, completa = false, recomendada = null }: TablaModulacionesProps) {
  const bMaxKHz = formatoCompacto(B_MAX / 1e3, 0);
  return (
    <div className="overflow-x-auto rounded-md border border-borde bg-white">
      <table className={`w-full border-collapse text-left text-sm ${completa ? "min-w-[34rem]" : ""}`}>
        <thead className="bg-papel text-tinta">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">Modulación</th>
            {completa && <th scope="col" className="px-3 py-2.5 text-right font-semibold">k (bit/símbolo)</th>}
            {completa && <th scope="col" className="px-3 py-2.5 text-right font-semibold">R<sub>s</sub> (kbaud)</th>}
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">B = (1 + α)·R<sub>s</sub> (kHz)</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">¿B ≤ {bMaxKHz} kHz?</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">E<sub>b</sub>/N<sub>0</sub> para BER = {formatoCientifico(BER_MAX)} (dB)</th>
            {completa && <th scope="col" className="px-3 py-2.5 text-right font-semibold">C/N requerido (dB)</th>}
            {completa && <th scope="col" className="px-3 py-2.5 text-right font-semibold">η (bit/s/Hz)</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.mod} className={`border-t border-borde ${f.mod === recomendada ? "bg-papel/70" : ""}`}>
              <th scope="row" className="px-3 py-2.5 font-semibold" style={{ color: ESTILO_MODULACION[f.mod].texto }}>
                {f.mod}
                {f.mod === recomendada && <span className="ml-2 font-normal text-tenue">(recomendada)</span>}
              </th>
              {completa && <td className="px-3 py-2.5 text-right">{f.k}</td>}
              {completa && <td className="px-3 py-2.5 text-right">{formatoCompacto(f.rsKbaud, 1)}</td>}
              <td className="px-3 py-2.5 text-right">{formatoCompacto(f.bKHz, 1)}</td>
              <td className="px-3 py-2.5">
                <Cumple cumple={f.cumpleB} />
              </td>
              <td className="px-3 py-2.5 text-right">{formatoDecimal(f.ebN0ReqDb, 2)}</td>
              {completa && <td className="px-3 py-2.5 text-right">{formatoDecimal(f.cnReqDb, 2)}</td>}
              {completa && <td className="px-3 py-2.5 text-right">{formatoDecimal(f.eficiencia, 2)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
