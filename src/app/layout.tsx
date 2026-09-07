import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/Toasts";
import { AuthProvider } from "@/components/auth/AuthContext";

export const metadata: Metadata = {
  title: "Naïve Agenda · Prenotazioni & Gestione Corsi",
  description: "Booking app per scuole e studi: agenda 3D sfogliabile, area allievo, profilo personale e promemoria.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Caveat:wght@500;700&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {/* filtro SVG per il tratto "a pastello" */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id="crayon-rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="4" />
          </filter>
        </svg>
        <AuthProvider>
          <ToastProvider>
            <Nav />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
