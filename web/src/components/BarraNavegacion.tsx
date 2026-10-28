"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const RUTAS = [
  { href: "/", etiqueta: "Inicio" },
  { href: "/paso-banda", etiqueta: "Paso banda" },
  { href: "/ber", etiqueta: "Curvas BER" },
  { href: "/cadena", etiqueta: "Cadena completa" },
  { href: "/acerca", etiqueta: "Acerca" },
] as const;

function Enlaces({ actual, alElegir }: { actual: string; alElegir?: () => void }) {
  return RUTAS.map((r) => {
    const activa = r.href === "/" ? actual === "/" : actual.startsWith(r.href);
    return (
      <li key={r.href}>
        <Link
          href={r.href}
          onClick={alElegir}
          aria-current={activa ? "page" : undefined}
          className={`flex min-h-11 items-center border-b-2 px-3 text-[0.95rem] ${
            activa ? "border-tinta font-semibold text-tinta" : "border-transparent text-tenue hover:text-tinta"
          }`}
        >
          {r.etiqueta}
        </Link>
      </li>
    );
  });
}

export function BarraNavegacion() {
  const actual = usePathname();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  return (
    <header className="border-b border-borde bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-14 flex-col justify-center py-2 leading-tight">
          <span className="text-xs text-tenue">RED-0310 · Actividad 6</span>
          <span className="font-semibold text-tinta">Transmisión digital de 4 canales de voz</span>
        </Link>
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-stretch">
            <Enlaces actual={actual} />
          </ul>
        </nav>
        <button
          type="button"
          className="flex min-h-11 items-center rounded border border-borde-fuerte px-3 text-sm font-medium text-tinta md:hidden"
          aria-expanded={abierto}
          aria-controls="menu-movil"
          onClick={() => setAbierto((a) => !a)}
        >
          {abierto ? "Cerrar menú" : "Menú"}
        </button>
      </div>
      {abierto && (
        <nav id="menu-movil" aria-label="Principal" className="border-t border-borde md:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col px-1 py-2">
            <Enlaces actual={actual} alElegir={() => setAbierto(false)} />
          </ul>
        </nav>
      )}
    </header>
  );
}
