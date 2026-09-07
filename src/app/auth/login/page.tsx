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

  const handleDemoLogin = async (targetRole: "user" | "manager") => {
    setLoading(true);
    try {
      await loginAsDemo(targetRole);
      toast.show(`Accesso effettuato come ${targetRole === "manager" ? "Gestore" : "Allievo"}!`, "info");
      router.push("/profilo");
    } catch (err: any) {
      setError(err.message || "Errore accesso demo.");
    } finally {
      setLoading(false);
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

        {/* Demo Fast Buttons per testare immediatamente ruoli */}
        <div className="mt-6 rounded-lg bg-paper-aged/50 p-3 text-center">
          <p className="font-hand text-sm font-bold text-ink-soft">
            ⚡ Accesso Rapido di Prova:
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => handleDemoLogin("user")}
              disabled={loading}
              className="sketch-sm flex-1 bg-crayon-yellow/20 px-2 py-1.5 text-xs font-semibold text-ink transition hover:bg-crayon-yellow/40"
            >
              👤 Profilo Allievo
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin("manager")}
              disabled={loading}
              className="sketch-sm flex-1 bg-crayon-red/20 px-2 py-1.5 text-xs font-semibold text-crayon-red transition hover:bg-crayon-red/30"
            >
              👑 Dashboard Gestore
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
