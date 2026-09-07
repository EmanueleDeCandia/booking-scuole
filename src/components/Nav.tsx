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
    <header className="mx-auto flex w-full max-w-[96vw] 2xl:max-w-[1750px] items-center justify-between gap-4 px-4 py-5 sm:px-8">
      <Link href="/" className="group flex items-center gap-3">
        <span className="sketch-sm grid h-12 w-12 place-items-center bg-crayon-red text-2xl text-white transition-transform group-hover:-rotate-6">
          ✎
        </span>
        <span className="leading-none">
          <span className="font-display block text-2xl sm:text-3xl">
            Na<span className="text-crayon-red">ï</span>ve Agenda
          </span>
          <span className="font-hand block text-base sm:text-lg text-ink-soft">scuole · corsi · prenotazioni</span>
        </span>
      </Link>

      <nav className="flex items-center gap-2 sm:gap-3">
        <Link href="/" className={`btn !py-2 !px-3.5 text-sm sm:text-base font-semibold ${is("/") ? "btn-ink" : ""}`}>
          Agenda 3D
        </Link>

        {user ? (
          <>
            {role === "manager" ? (
              <Link href="/dashboard" className={`btn !py-2 !px-3.5 text-sm sm:text-base font-semibold ${is("/dashboard") ? "btn-ink" : ""}`}>
                👑 Dashboard
              </Link>
            ) : null}

            <Link
              href="/profilo"
              className={`btn flex items-center gap-2 !py-2 !px-3.5 text-sm sm:text-base font-semibold ${is("/profilo") ? "btn-ink" : ""}`}
            >
              <span className="relative h-7 w-7 overflow-hidden rounded-full border border-ink/30 bg-crayon-yellow/30 text-xs font-bold grid place-items-center">
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
              className="btn !px-3 !py-1.5 text-xs sm:text-sm text-ink-soft hover:text-crayon-red"
              title="Esci dall'account"
            >
              Esci
            </button>
          </>
        ) : !loading ? (
          <Link href="/auth/login" className={`btn btn-yellow !py-2 !px-4 text-sm sm:text-base font-semibold ${is("/auth") ? "btn-ink" : ""}`}>
            🔑 Accedi
          </Link>
        ) : null}

        <NotificationBell />
      </nav>
    </header>
  );
}
