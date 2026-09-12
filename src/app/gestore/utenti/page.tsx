"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { RegisteredUsersModal } from "@/components/RegisteredUsersModal";
import Link from "next/link";

export default function GestoreUtentiPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf6ee] p-12 text-center">
        <div className="font-hand text-xl text-ink">Verifica permessi gestore in corso... ⏳</div>
      </div>
    );
  }

  // Se non è gestore, avviso di accesso riservato
  if (role !== "manager" && user?.role !== "manager") {
    return (
      <div className="min-h-screen bg-[#faf6ee] p-6 flex items-center justify-center">
        <div className="sketch bg-white p-8 max-w-md text-center border-2 border-ink">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="font-display text-2xl font-bold uppercase text-ink mb-2">Accesso Riservato</h1>
          <p className="text-sm text-ink/70 mb-4">
            Questa finestra è riservata alla Direzione Didattica per la gestione degli utenti registrati nel database.
          </p>
          <Link href="/dashboard" className="btn btn-ink text-sm font-bold">
            Torna alla Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf6ee] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto mb-4 flex items-center justify-between">
        <Link href="/dashboard" className="btn !py-1.5 !px-3 text-xs font-bold border border-ink">
          ← Torna alla Dashboard
        </Link>
        <Link href="/profilo" className="btn !py-1.5 !px-3 text-xs font-bold border border-ink">
          Area Gestore Didattica →
        </Link>
      </div>

      {/* Rende la finestra utenti aperta */}
      <RegisteredUsersModal
        isOpen={true}
        onClose={() => router.push("/dashboard")}
        currentManagerEmail={user?.email}
      />
    </main>
  );
}
