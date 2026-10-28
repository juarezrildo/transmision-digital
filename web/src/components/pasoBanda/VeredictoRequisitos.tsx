import { B_MAX, BER_MAX, type FilaModulacion } from "@/lib/dsp";
import { formatoBer, formatoCientifico, formatoCompacto, formatoDecimal } from "@/lib/formato";

interface VeredictoRequisitosProps {
  fila: FilaModulacion;
  ebN0Db: number;
  berTeorica: number;
}

function Estado({ cumple }: { cumple: boolean }) {
  return cumple ? (
    <span className="font-semibold text-tinta">✓ Cumple</span>
  ) : (
    <span className="font-semibold text-falla">✗ No cumple</span>
  );
}

/** Tarjeta "¿Cumple los requisitos?": ancho de banda por (1 + α)·Rs y BER por la teoría. */
export function VeredictoRequisitos({ fila, ebN0Db, berTeorica }: VeredictoRequisitosProps) {
  const bMaxKHz = B_MAX / 1e3;
  const cumpleBer = berTeorica <= BER_MAX;
  const faltaDb = fila.ebN0ReqDb - ebN0Db;
  const cumpleTodo = fila.cumpleB && cumpleBer;
  let conclusion: string;
  if (cumpleTodo) conclusion = `${fila.mod} cumple los dos requisitos con ${formatoDecimal(ebN0Db, 1)} dB.`;
  else if (!fila.cumpleB)
    conclusion = `${fila.mod} no sirve en este canal con ningún Eb/N0: ocupa ${formatoCompacto(fila.bKHz - bMaxKHz, 1)} kHz más de los disponibles.`;
  else conclusion = `Faltan ${formatoDecimal(faltaDb, 2)} dB de Eb/N0 para llegar a BER = ${formatoCientifico(BER_MAX)}.`;

  return (
    <section
      aria-labelledby="titulo-veredicto"
      className={`rounded-md border-2 bg-white p-4 ${cumpleTodo ? "border-tinta" : "border-falla"}`}
    >
      <h2 id="titulo-veredicto" className="text-base font-semibold text-tinta">
        ¿Cumple los requisitos?
      </h2>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-tenue">Ancho de banda ≤ {formatoCompacto(bMaxKHz, 0)} kHz</span>
            <Estado cumple={fila.cumpleB} />
          </dt>
          <dd className="mt-0.5 text-tinta">
            B = (1 + α)·R<sub>s</sub> = {formatoCompacto(fila.bKHz, 1)} kHz
          </dd>
        </div>
        <div>
          <dt className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-tenue">BER ≤ {formatoCientifico(BER_MAX)}</span>
            <Estado cumple={cumpleBer} />
          </dt>
          <dd className="mt-0.5 text-tinta">
            BER teórica a {formatoDecimal(ebN0Db, 1)} dB: {formatoBer(berTeorica)}
          </dd>
          <dd className="text-tenue">
            Requiere E<sub>b</sub>/N<sub>0</sub> ≥ {formatoDecimal(fila.ebN0ReqDb, 2)} dB (C/N ≥ {formatoDecimal(fila.cnReqDb, 2)} dB)
          </dd>
        </div>
      </dl>
      <p className={`mt-3 border-t border-borde pt-3 text-sm font-medium ${cumpleTodo ? "text-tinta" : "text-falla"}`}>
        {conclusion}
      </p>
    </section>
  );
}
