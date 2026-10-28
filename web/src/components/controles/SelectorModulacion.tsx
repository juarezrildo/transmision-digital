"use client";

import { MODULACIONES, type Modulacion } from "@/lib/dsp";
import { ESTILO_MODULACION } from "@/lib/modulacionesUi";

interface SelectorModulacionProps {
  valor: Modulacion;
  alCambiar: (mod: Modulacion) => void;
  nombre?: string;
}

/** Grupo de radio nativo (flechas del teclado incluidas) con el color de cada modulación. */
export function SelectorModulacion({ valor, alCambiar, nombre = "modulacion" }: SelectorModulacionProps) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-tinta">Modulación</legend>
      <div className="grid grid-cols-3 gap-2">
        {MODULACIONES.map((mod) => {
          const elegida = mod === valor;
          const estilo = ESTILO_MODULACION[mod];
          return (
            <label
              key={mod}
              className={`relative flex min-h-11 cursor-pointer flex-col justify-center rounded border px-2 py-1.5 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tinta ${
                elegida ? "border-2 bg-white font-semibold" : "border-borde-fuerte bg-white/60 hover:bg-white"
              }`}
              style={elegida ? { borderColor: estilo.trazo, color: estilo.texto } : undefined}
            >
              <input
                type="radio"
                name={nombre}
                value={mod}
                checked={elegida}
                onChange={() => alCambiar(mod)}
                className="sr-only"
              />
              <span className="text-[0.95rem]">{mod}</span>
              <span aria-hidden className="mx-auto mt-1 h-1 w-8 rounded-full" style={{ background: estilo.trazo }} />
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-tenue">{ESTILO_MODULACION[valor].descripcion}.</p>
    </fieldset>
  );
}
