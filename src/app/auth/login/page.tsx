"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { useToast } from "@/components/Toasts";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { signIn, isFirebaseReady, loginAsDemo, role } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modale protezione Password Gestore / Direzione
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerPasswordInput, setManagerPasswordInput] = useState("");
  const [managerModalError, setManagerModalError] = useState<string | null>(null);
  const [managerLoading, setManagerLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Inserisci email e password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      toast.show("Accesso effettuato con successo!", "info");
      // Se l'email contiene gestore/admin o il ruolo è manager, va a dashboard, altrimenti a profilo
      if (email.includes("gestore") || email.includes("admin")) {
        router.push("/dashboard");
      } else {
        router.push("/profilo");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Credenziali non valide o errore di connessione.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoStudentLogin = async () => {
    setLoading(true);
    try {
      await loginAsDemo("user");
      toast.show("Accesso effettuato come Allievo Iscritto!", "info");
      router.push("/profilo");
    } catch (err: any) {
      setError(err.message || "Errore accesso allievo demo.");
    } finally {
      setLoading(false);
    }
  };

  const handleManagerPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerPasswordInput.trim()) {
      setManagerModalError("Inserisci la password di direzione.");
      return;
    }
    setManagerModalError(null);
    setManagerLoading(true);
    try {
      await loginAsDemo("manager", managerPasswordInput.trim());
      toast.show("Accesso autorizzato come Gestore Didattico! 👑", "info");
      setShowManagerModal(false);
      setManagerPasswordInput("");
      router.push("/dashboard");
    } catch (err: any) {
      setManagerModalError(err.message || "Password di direzione non valida. Accesso negato.");
    } finally {
      setManagerLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-3 py-6 sm:px-4 sm:py-12">
      <div className="sketch bg-white/95 p-5 sm:p-8">
        <div className="mb-5 sm:mb-6 text-center">
          <span className="sketch-sm inline-grid h-11 w-11 sm:h-12 sm:w-12 place-items-center bg-crayon-blue text-xl sm:text-2xl text-white">
            🔑
          </span>
          <h1 className="font-display mt-3 text-2xl sm:text-3xl text-ink">Accedi al Tuo Account</h1>
          <p className="font-hand mt-1 text-base sm:text-lg text-ink-soft">
            Gestisci i tuoi corsi, controlla presenze o gestisci la scuola
          </p>
        </div>

        {error && (
          <div className="sketch-sm mb-4 border border-crayon-red/30 bg-crayon-red/10 p-3 text-sm text-crayon-red">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-display block text-xs tracking-wider text-ink-soft uppercase">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="allievo@scuola.it"
              className="mt-1 w-full rounded border border-ink/20 bg-paper px-3 py-2 text-ink outline-none transition focus:border-crayon-blue"
            />
          </div>

          <div>
            <label className="font-display block text-xs tracking-wider text-ink-soft uppercase">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded border border-ink/20 bg-paper px-3 py-2 text-ink outline-none transition focus:border-crayon-blue"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-ink w-full justify-center py-2.5 text-base font-bold shadow-sketch"
          >
            {loading ? "Accesso in corso..." : "Entra"}
          </button>
        </form>

        <div className="mt-6 border-t border-dashed border-ink/20 pt-4 text-center">
          <p className="text-sm text-ink-soft">
            Non hai ancora un profilo allievo?{" "}
            <Link href="/auth/register" className="font-bold text-crayon-blue hover:underline">
              Iscriviti ora
            </Link>
          </p>
        </div>

        {/* Accesso Rapido: Allievo Diretto e Gestore Protetto da Password */}
        <div className="mt-6 rounded-lg bg-paper-aged/50 p-3.5 text-center border border-ink/20">
          <p className="font-hand text-sm font-bold text-ink-soft flex items-center justify-center gap-1.5">
            <span>⚡</span> Accesso Rapido:
          </p>
          <div className="mt-2.5 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleDemoStudentLogin}
              disabled={loading || managerLoading}
              className="sketch-sm flex-1 bg-crayon-yellow/20 px-3 py-2 text-xs font-bold text-ink transition hover:bg-crayon-yellow/40 flex items-center justify-center gap-1.5 shadow-xs"
              title="Entra subito come allievo per provare l'agenda, corsi e gamification"
            >
              <span>👤</span> Entra come Allievo Demo
            </button>
            <button
              type="button"
              onClick={() => {
                setManagerModalError(null);
                setManagerPasswordInput("");
                setShowManagerModal(true);
              }}
              disabled={loading || managerLoading}
              className="sketch-sm flex-1 bg-crayon-red/15 px-3 py-2 text-xs font-bold text-crayon-red transition hover:bg-crayon-red/25 flex items-center justify-center gap-1.5 shadow-xs"
              title="Accesso riservato alla Direzione didattica della scuola"
            >
              <span>👑</span> Entra come Gestore (PIN)
            </button>
          </div>
          <p className="font-hand text-[11px] text-ink-soft/80 mt-1.5">
            🔒 L&apos;accesso alla console del Gestore è protetto da Password di Direzione.
          </p>
        </div>
      </div>

      {/* MODALE DI PROTEZIONE PASSWORD GESTORE */}
      {showManagerModal && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-ink/50 p-3 sm:p-4 backdrop-blur-[2px]"
          onClick={() => setShowManagerModal(false)}
        >
          <form
            onSubmit={handleManagerPasswordSubmit}
            onClick={(e) => e.stopPropagation()}
            className="sketch wobble-in relative w-full max-w-sm bg-[#fffdfa] p-5 sm:p-6"
            style={{ transform: "rotate(-0.5deg)" }}
          >
            <div
              className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-[-2deg] bg-crayon-red/80"
              style={{ clipPath: "polygon(2% 0, 100% 4%, 98% 100%, 0 96%)" }}
            />

            <div className="flex items-start justify-between border-b-2 border-dashed border-ink/20 pb-3">
              <div>
                <h3 className="font-display text-base uppercase font-bold text-ink flex items-center gap-1.5">
                  <span>👑</span> Accesso Direzione Scuola
                </h3>
                <p className="font-hand text-xs text-ink-soft mt-0.5">
                  Pannello riservato alla Direzione Didattica
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                className="font-bold text-ink hover:text-crayon-red text-sm"
              >
                ✕
              </button>
            </div>

            {managerModalError && (
              <div className="sketch-sm mt-3 border border-crayon-red/30 bg-crayon-red/10 p-2.5 text-xs text-crayon-red font-semibold">
                ✗ {managerModalError}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="font-display block text-[11px] tracking-wider text-ink-soft uppercase font-bold mb-1">
                  Password o PIN di Direzione *
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={managerPasswordInput}
                  onChange={(e) => setManagerPasswordInput(e.target.value)}
                  placeholder="Inserisci la password..."
                  className="w-full rounded border-2 border-ink bg-paper px-3 py-2 text-sm outline-none focus:border-crayon-blue"
                />
              </div>

              <div className="rounded bg-crayon-yellow/20 p-2.5 border border-ink/20 font-hand text-xs text-ink-soft">
                💡 <strong>Sicurezza Scuola:</strong> Solo gli insegnanti e i gestori autorizzati in possesso della chiave possono accedere alla console di gestione corsi e presenze.
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t-2 border-dashed border-ink/20 pt-3">
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                className="btn !py-1.5 !px-3 text-xs"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={managerLoading}
                className="btn btn-red !py-1.5 !px-4 text-xs font-bold shadow-sm"
              >
                {managerLoading ? "Verifica…" : "✓ Entra come Gestore"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
