import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/Toasts";
import { AuthProvider } from "@/components/auth/AuthContext";
import { PwaRegister } from "@/components/PwaRegister";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#faf6ee",
};

export const metadata: Metadata = {
  title: "Naïve Agenda · Prenotazioni & Gestione Corsi",
  description: "Booking app per scuole e studi: agenda 3D sfogliabile, area allievo, profilo personale e promemoria.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Naïve Agenda",
  },
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="antialiased">
        <PwaRegister />
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
