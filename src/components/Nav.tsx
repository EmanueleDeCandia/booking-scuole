"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "./NotificationBell";

import { useAuth } from "./auth/AuthContext";

export function Nav() {
  const path = usePathname();
  const { user, role, signOut, loading } = useAuth();
  const is = (p: string) => (p === "/" ? path === "/" : path.startsWith(p));

  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <Link href="/" className="group flex items-center gap-3">
        <span className="sketch-sm grid h-11 w-11 place-items-center bg-crayon-red text-2xl text-white transition-transform group-hover:-rotate-6">
          ✎
        </span>
        <span className="leading-none">
          <span className="font-display block text-2xl">
            Na<span className="text-crayon-red">ï</span>ve Agenda
          </span>
          <span className="font-hand block text-base text-ink-soft">scuole · corsi · prenotazioni</span>
        </span>
      </Link>

      <nav className="flex items-center gap-2 sm:gap-3">
        <Link href="/" className={`btn ${is("/") ? "btn-ink" : ""}`}>
          Agenda 3D
        </Link>

        {user ? (
          <>
            {role === "manager" ? (
              <Link href="/dashboard" className={`btn ${is("/dashboard") ? "btn-ink" : ""}`}>
                👑 Dashboard
              </Link>
            ) : null}

            <Link
              href="/profilo"
              className={`btn flex items-center gap-2 ${is("/profilo") ? "btn-ink" : ""}`}
            >
              <span className="relative h-6 w-6 overflow-hidden rounded-full border border-ink/30 bg-crayon-yellow/30 text-xs font-bold grid place-items-center">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                ) : (
                  user.displayName.charAt(0).toUpperCase()
                )}
              </span>
              <span className="hidden sm:inline">Il Mio Profilo</span>
            </Link>

            <button
              type="button"
              onClick={signOut}
              className="btn !px-2.5 !py-1 text-xs text-ink-soft hover:text-crayon-red"
              title="Esci dall'account"
            >
              Esci
            </button>
          </>
        ) : !loading ? (
          <Link href="/auth/login" className={`btn btn-yellow ${is("/auth") ? "btn-ink" : ""}`}>
            🔑 Accedi
          </Link>
        ) : null}

        <NotificationBell />
      </nav>
    </header>
  );
}
