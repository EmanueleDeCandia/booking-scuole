"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { useToast } from "@/components/Toasts";

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "manager">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Compila tutti i campi obbligatori.");
      return;
    }
    if (password.length < 3) {
      setError("La password deve contenere almeno 3 caratteri.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp(email, password, name, phone, role);
      toast.show("Profilo registrato con successo!", "info");
      if (role === "manager") {
        router.push("/dashboard");
      } else {
        router.push("/profilo");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Errore durante la registrazione.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-3 py-6 sm:px-4 sm:py-12">
      <div className="sketch bg-white/95 p-5 sm:p-8">
        <div className="mb-5 sm:mb-6 text-center">
          <span className="sketch-sm inline-grid h-11 w-11 sm:h-12 sm:w-12 place-items-center bg-crayon-green text-xl sm:text-2xl text-white">
            ✍️
          </span>
          <h1 className="font-display mt-3 text-2xl sm:text-3xl text-ink">Crea il Tuo Profilo</h1>
          <p className="font-hand mt-1 text-base sm:text-lg text-ink-soft">
            Iscriviti per prenotare corsi, visualizzare le tue presenze e personalizzare il profilo
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
              Tipo di Account
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`sketch-sm py-2 text-xs font-bold transition ${
                  role === "user"
                    ? "bg-crayon-green text-white shadow-sm"
                    : "bg-paper text-ink-soft hover:bg-paper-aged"
                }`}
              >
                👤 Allievo / Studente
              </button>
              <button
                type="button"
                onClick={() => setRole("manager")}
                className={`sketch-sm py-2 text-xs font-bold transition ${
                  role === "manager"
                    ? "bg-crayon-red text-white shadow-sm"
                    : "bg-paper text-ink-soft hover:bg-paper-aged"
                }`}
              >
                👑 Gestore Scuola
              </button>
            </div>
          </div>

          <div>
            <label className="font-display block text-xs tracking-wider text-ink-soft uppercase">
              Nome e Cognome *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maria Rossi"
              className="mt-1 w-full rounded border border-ink/20 bg-paper px-3 py-2 text-ink outline-none transition focus:border-crayon-green"
            />
          </div>

          <div>
            <label className="font-display block text-xs tracking-wider text-ink-soft uppercase">
              Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria.rossi@email.it"
              className="mt-1 w-full rounded border border-ink/20 bg-paper px-3 py-2 text-ink outline-none transition focus:border-crayon-green"
            />
          </div>

          <div>
            <label className="font-display block text-xs tracking-wider text-ink-soft uppercase">
              Telefono (opzionale per promemoria WhatsApp)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+39 340 1234567"
              className="mt-1 w-full rounded border border-ink/20 bg-paper px-3 py-2 text-ink outline-none transition focus:border-crayon-green"
            />
          </div>

          <div>
            <label className="font-display block text-xs tracking-wider text-ink-soft uppercase">
              Password (min. 6 caratteri) *
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded border border-ink/20 bg-paper px-3 py-2 text-ink outline-none transition focus:border-crayon-green"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-ink w-full justify-center py-2.5 text-base font-bold shadow-sketch"
          >
            {loading ? "Creazione profilo in corso..." : "Registrati e Accedi"}
          </button>
        </form>

        <div className="mt-6 border-t border-dashed border-ink/20 pt-4 text-center">
          <p className="text-sm text-ink-soft">
            Hai già un account?{" "}
            <Link href="/auth/login" className="font-bold text-crayon-blue hover:underline">
              Accedi qui
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
