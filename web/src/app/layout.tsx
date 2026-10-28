import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { BarraNavegacion } from "@/components/BarraNavegacion";
import "./globals.css";

// IBM Plex: diseñada para documentación técnica; cifras tabulares y 1/l/I bien distintos.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Monoespaciada solo para secuencias de bits, donde las columnas deben alinearse.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · Actividad 6 · RED-0310",
    default: "Simulador de transmisión digital · Actividad 6 · RED-0310",
  },
  description:
    "Simulador de la cadena de transmisión digital de 4 canales de voz: PCM, TDM, Manchester, BPSK, QPSK y 16-QAM con canal AWGN. Comunicaciones Digitales I, UPDS.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenido"
          className="sr-only z-50 bg-tinta px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Saltar al contenido
        </a>
        <BarraNavegacion />
        <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-10">
          {children}
        </main>
        <footer className="border-t border-borde">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-6 text-sm text-tenue sm:flex-row sm:justify-between sm:px-6 lg:px-8">
            <p>Comunicaciones Digitales I (RED-0310) · UPDS · Actividad 6</p>
            <p>El cálculo corre en tu navegador; los números salen del motor validado contra la simulación en Python.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
