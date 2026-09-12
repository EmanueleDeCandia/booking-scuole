"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationProvider, NotificationBell, NotificationPanel } from "./NotificationBell";
import { useAuth } from "./auth/AuthContext";

export function Nav() {
  return (
    <NotificationProvider>
      <NavInner />
    </NotificationProvider>
  );
}

function NavInner() {
  const path = usePathname();
  const { user, role, signOut, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const is = (p: string) => (p === "/" ? path === "/" : path.startsWith(p));

  return (
    <>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 lg:px-8 sm:py-4">
        <Link href="/" className="group flex items-center gap-2 sm:gap-2.5 shrink-0">
          <span className="sketch-sm grid h-9 w-9 sm:h-11 sm:w-11 place-items-center bg-crayon-red text-xl sm:text-2xl text-white transition-transform group-hover:-rotate-6">
            ✎
          </span>
          <span className="leading-none">
            <span className="font-display block text-xl sm:text-2xl lg:text-3xl">
              Na<span className="text-crayon-red">ï</span>ve Agenda
            </span>
            <span className="font-hand hidden md:block text-xs sm:text-sm text-ink-soft">
              scuole · corsi · prenotazioni
            </span>
          </span>
        </Link>

        {/* Desktop Navigation (>= 1024px) */}
        <nav className="hidden lg:flex items-center gap-2 xl:gap-2.5 shrink-0">
          <Link
            href="/"
            className={`btn !py-2 !px-3 text-sm xl:text-base font-semibold ${is("/") ? "btn-ink" : ""}`}
          >
            Agenda 3D
          </Link>

          <Link
            href="/corsi"
            className={`btn !py-2 !px-3 text-sm xl:text-base font-semibold ${is("/corsi") ? "btn-ink" : ""}`}
            title="Nuovi Corsi in Programma & Sondaggio Appeal"
          >
            🎭 Corsi
          </Link>

          {user ? (
            <>
              {role === "manager" ? (
                <Link
                  href="/dashboard"
                  className={`btn !py-2 !px-3 text-sm xl:text-base font-semibold ${is("/dashboard") ? "btn-ink" : ""}`}
                >
                  👑 Dashboard
                </Link>
              ) : (
                <Link
                  href="/profilo#gamification"
                  className="btn btn-yellow !py-2 !px-3 text-sm font-bold shadow-xs"
                  title="Il tuo Libretto Artistico, XP e Gradi d'Atelier"
                >
                  🏅 Libretto
                </Link>
              )}

              <Link
                href="/profilo"
                className={`btn flex items-center gap-1.5 !py-2 !px-3 text-sm xl:text-base font-semibold ${is("/profilo") ? "btn-ink" : ""}`}
                title="Visualizza e modifica il tuo profilo"
              >
                <span className="relative h-6 w-6 overflow-hidden rounded-full border border-ink/30 bg-crayon-yellow/30 text-xs font-bold grid place-items-center shrink-0">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    user.displayName.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="max-w-[110px] truncate">{user.displayName || "Profilo"}</span>
              </Link>

              <button
                type="button"
                onClick={signOut}
                className="btn !px-2.5 !py-1.5 text-xs text-ink-soft hover:text-crayon-red"
                title="Esci dall'account"
              >
                Esci
              </button>
            </>
          ) : !loading ? (
            <Link
              href="/auth/login"
              className={`btn btn-yellow !py-2 !px-4 text-sm xl:text-base font-semibold ${is("/auth") ? "btn-ink" : ""}`}
            >
              🔑 Accedi
            </Link>
          ) : null}

          {/* Campanellino Notifiche Desktop: sempre visibile, ancorato e con shrink-0 */}
          <div className="shrink-0 ml-1">
            <NotificationBell />
          </div>
        </nav>

        {/* Mobile & Tablet Navigation Header (< 1024px) */}
        <div className="flex lg:hidden items-center gap-2 shrink-0">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="btn !py-1.5 !px-2.5 text-xs font-bold flex items-center gap-1.5 border-2 border-ink shadow-xs"
            aria-label="Menu di navigazione"
          >
            <span className="text-sm">{mobileOpen ? "✕" : "☰"}</span>
            <span>Menu</span>
          </button>
        </div>
      </header>

      {/* Sezione Notifiche In-Flow a Tutta Larghezza (sposta in basso il contenuto simmetricamente) */}
      <NotificationPanel />

      {/* Mobile Drawer / Card Modal */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-start bg-ink/40 p-3 pt-16 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="sketch wobble-in bg-paper-aged border-2 border-ink p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-dashed border-ink/30 pb-3">
              {user ? (
                <div className="flex items-center gap-2.5">
                  <span className="relative h-9 w-9 overflow-hidden rounded-full border border-ink/30 bg-crayon-yellow/30 text-sm font-bold grid place-items-center">
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                    ) : (
                      user.displayName.charAt(0).toUpperCase()
                    )}
                  </span>
                  <div>
                    <div className="font-display text-base leading-tight">{user.displayName}</div>
                    <span
                      className="tag !text-[11px] !py-0.5 !px-2 font-bold mt-0.5 inline-block"
                      style={{ background: role === "manager" ? "#f59e0b" : "#0d9488", color: "#fff" }}
                    >
                      {role === "manager" ? "👑 Gestore Scuola" : "🩰 Allievo/a"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="font-display text-base font-bold">Menu Navigazione</div>
              )}
              <button
                onClick={() => setMobileOpen(false)}
                className="btn !px-2.5 !py-1 text-xs font-bold border-2 border-ink"
                aria-label="Chiudi menu"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="grid gap-2">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className={`btn w-full !py-2.5 text-sm font-bold justify-start ${is("/") ? "btn-ink" : ""}`}
              >
                📅 Agenda 3D
              </Link>
              <Link
                href="/corsi"
                onClick={() => setMobileOpen(false)}
                className={`btn w-full !py-2.5 text-sm font-bold justify-start ${is("/corsi") ? "btn-ink" : ""}`}
              >
                🎭 Corsi in Programma & Sondaggio
              </Link>
              {user && role === "manager" && (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className={`btn btn-yellow w-full !py-2.5 text-sm font-bold justify-start ${is("/dashboard") ? "btn-ink" : ""}`}
                  >
                    👑 Dashboard Gestionale
                  </Link>
                  <Link
                    href="/gestore/utenti"
                    onClick={() => setMobileOpen(false)}
                    className={`btn w-full !py-2.5 text-sm font-bold justify-start ${is("/gestore/utenti") ? "btn-ink" : "bg-white border-2 border-ink text-ink"}`}
                  >
                    👥 Utenti Registrati (DB)
                  </Link>
                  <Link
                    href="/profilo#gamification-manager"
                    onClick={() => setMobileOpen(false)}
                    className="btn btn-teal w-full !py-2.5 text-sm font-bold justify-start text-white"
                  >
                    🏅 Registro Gamification &amp; Timbri
                  </Link>
                </>
              )}
              {user && role !== "manager" && (
                <Link
                  href="/profilo#gamification"
                  onClick={() => setMobileOpen(false)}
                  className="btn btn-teal w-full !py-2.5 text-sm font-bold justify-start text-white"
                >
                  🏅 Libretto Artistico &amp; XP
                </Link>
              )}
              {user && (
                <Link
                  href="/profilo"
                  onClick={() => setMobileOpen(false)}
                  className={`btn w-full !py-2.5 text-sm font-bold justify-start ${is("/profilo") ? "btn-ink" : ""}`}
                >
                  👤 Il Mio Profilo & Corsi
                </Link>
              )}
            </div>

            <div className="border-t-2 border-dashed border-ink/30 pt-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setMobileOpen(false);
                  }}
                  className="btn w-full !py-2.5 text-sm text-crayon-red font-bold justify-center hover:bg-crayon-red/10 border-2 border-crayon-red/30"
                >
                  🚪 Esci dall'account
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="btn btn-yellow w-full !py-2.5 text-sm font-bold justify-center shadow-xs"
                >
                  🔑 Accedi / Registrati
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
