"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { UserWithStatsDTO, DeletedUserDTO } from "@/lib/agenda";
import { useToast } from "./Toasts";

export function RegisteredUsersModal({
  isOpen,
  onClose,
  currentManagerEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentManagerEmail?: string;
}) {
  const toast = useToast();
  const [users, setUsers] = useState<UserWithStatsDTO[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<DeletedUserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active");

  // Ricerca e filtri
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "manager">("all");

  // Stato Modale di Conferma Eliminazione
  const [userToDelete, setUserToDelete] = useState<UserWithStatsDTO | null>(null);
  const [purgeBookings, setPurgeBookings] = useState(true);
  const [deleteReason, setDeleteReason] = useState("Account Fake / Test");
  const [isDeleting, setIsDeleting] = useState(false);

  // Stato Ripristino
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setDeletedUsers(data.deletedUsers || []);
      } else {
        toast.show("Impossibile caricare l'elenco utenti", "error");
      }
    } catch (e) {
      console.error(e);
      toast.show("Errore di rete durante il caricamento utenti", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Filtro utenti attivi
  const filteredActiveUsers = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          (u.notes && u.notes.toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, roleFilter, searchQuery]);

  // Filtro utenti eliminati
  const filteredDeletedUsers = useMemo(() => {
    let list = deletedUsers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          (u.reason && u.reason.toLowerCase().includes(q))
      );
    }
    return list;
  }, [deletedUsers, searchQuery]);

  // Conferma eliminazione
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          userId: userToDelete.id,
          purgeBookings,
          reason: deleteReason.trim() || "Account Fake o Test rimosso dal database",
          deletedBy: currentManagerEmail || "Gestore",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante l'eliminazione");
      }

      toast.show(
        `Utente "${userToDelete.displayName}" archiviato in "Utenti Eliminati" (${data.purgedBookingsCount || 0} prenotazioni cancellate).`,
        "info"
      );
      setUserToDelete(null);
      await loadData();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("bookings:changed"));
        window.dispatchEvent(new Event("users:changed"));
      }
    } catch (err: any) {
      toast.show(err.message || "Impossibile eliminare l'utente", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Ripristino utente eliminato
  const handleRestoreUser = async (deletedDocId: string, name: string) => {
    setIsRestoringId(deletedDocId);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          deletedDocId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante il ripristino");
      }

      toast.show(`Account "${name}" ripristinato con successo tra gli utenti attivi! 🔄`, "info");
      await loadData();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("bookings:changed"));
        window.dispatchEvent(new Event("users:changed"));
      }
    } catch (err: any) {
      toast.show(err.message || "Impossibile ripristinare l'utente", "error");
    } finally {
      setIsRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-[#fffdfa] border-2 border-ink shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Finestra */}
        <div className="p-4 sm:p-5 bg-crayon-yellow/20 border-b-2 border-ink flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl sm:text-3xl">👥</span>
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-black uppercase text-ink tracking-tight">
                Utenti Registrati nel Database
              </h2>
              <p className="text-xs sm:text-sm text-ink/70">
                Consulta gli account registrati, individua e rimuovi i profili fake spostandoli nella sezione Utenti Eliminati.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              title="Ricarica dati dal database"
              className="btn !p-2 text-xs font-bold border-2 border-ink hover:bg-crayon-yellow/30 transition-colors"
            >
              🔄
            </button>
            <button
              onClick={onClose}
              title="Chiudi finestra"
              className="btn !p-2 text-sm font-bold border-2 border-ink hover:bg-crayon-red/20 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Switcher & Barra Ricerca */}
        <div className="p-4 border-b-2 border-dashed border-ink/20 bg-[#faf6ee] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("active")}
              className={`btn !py-2 !px-4 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "active" ? "btn-ink shadow-xs" : "bg-white text-ink border-2 border-ink hover:bg-ink/5"
              }`}
            >
              🟢 Utenti Attivi ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("deleted")}
              className={`btn !py-2 !px-4 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "deleted" ? "btn-red shadow-xs" : "bg-white text-ink border-2 border-ink hover:bg-ink/5"
              }`}
            >
              🗑️ Utenti Eliminati ({deletedUsers.length})
            </button>
          </div>

          {/* Cerca & Filtro Ruolo */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="🔍 Cerca nome, email, tel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input text-xs sm:text-sm w-full !py-1.5 !pl-3 !pr-7 bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink/50 hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>

            {activeTab === "active" && (
              <select
                value={roleFilter}
                onChange={(e: any) => setRoleFilter(e.target.value)}
                className="input text-xs sm:text-sm !py-1.5 bg-white font-medium"
              >
                <option value="all">Tutti i ruoli</option>
                <option value="user">Solo Allievi</option>
                <option value="manager">Solo Gestori</option>
              </select>
            )}
          </div>
        </div>

        {/* Contenuto Scrollabile */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="p-12 text-center">
              <div className="font-hand text-lg text-ink">Caricamento utenti dal database in corso... ⏳</div>
            </div>
          ) : activeTab === "active" ? (
            /* TAB 1: UTENTI ATTIVI */
            filteredActiveUsers.length === 0 ? (
              <div className="p-12 text-center text-ink/60 font-hand text-lg border-2 border-dashed border-ink/20 rounded-xl">
                Nessun utente trovato con i criteri impostati.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredActiveUsers.map((u) => {
                  const isMainManager = u.email.toLowerCase().trim() === "gestore@scuola.it";
                  return (
                    <div
                      key={u.id}
                      className="sketch bg-white p-4 border-2 border-ink flex flex-col justify-between hover:shadow-md transition-shadow relative"
                    >
                      <div>
                        {/* Top Riga Card */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-full border-2 border-ink bg-crayon-yellow/20 flex items-center justify-center text-ink font-bold text-sm shrink-0 overflow-hidden">
                              {u.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.avatarUrl} alt={u.displayName} className="h-full w-full object-cover" />
                              ) : (
                                <span>{u.displayName.slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-base text-ink flex items-center gap-2">
                                <span>{u.displayName}</span>
                                {u.role === "manager" ? (
                                  <span className="tag bg-crayon-yellow text-ink text-[10px] font-bold">Gestore</span>
                                ) : (
                                  <span className="tag bg-crayon-teal text-white text-[10px] font-bold">Allievo</span>
                                )}
                              </div>
                              <div className="text-xs text-ink/70 font-mono select-all">{u.email}</div>
                            </div>
                          </div>

                          {/* ID Documento */}
                          <span className="text-[10px] font-mono bg-ink/5 px-2 py-0.5 rounded text-ink/50" title={`ID Firestore: ${u.id}`}>
                            #{u.id.length > 14 ? u.id.slice(0, 14) + "…" : u.id}
                          </span>
                        </div>

                        {/* Dettagli Utente */}
                        <div className="space-y-1 text-xs text-ink/80 my-3 pt-2 border-t border-dashed border-ink/10">
                          <div className="flex items-center justify-between">
                            <span className="text-ink/60">Telefono:</span>
                            <span className="font-medium">{u.phone || "— Non specificato"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-ink/60">Data Registrazione:</span>
                            <span className="font-mono text-[11px]">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-ink/60">Prenotazioni Collegate:</span>
                            <span className="font-bold">
                              {u.bookingsCount > 0 ? (
                                <span className="text-crayon-blue">{u.bookingsCount} totali ({u.upcomingBookingsCount} prossime)</span>
                              ) : (
                                <span className="text-ink/40">0 prenotazioni</span>
                              )}
                            </span>
                          </div>
                          {u.notes && (
                            <div className="text-[11px] text-ink/60 italic bg-[#faf6ee] p-1.5 rounded border border-ink/10 mt-1">
                              &ldquo;{u.notes}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Azioni Card */}
                      <div className="pt-2 border-t border-ink/10 flex items-center justify-between gap-2 mt-auto">
                        <span className="text-[11px] text-ink/50">
                          {isMainManager ? "Account protetto" : "Verifica account"}
                        </span>

                        {isMainManager ? (
                          <span className="tag bg-crayon-yellow text-ink text-[11px] font-bold">
                            👑 Direzione Didattica
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setUserToDelete(u);
                              setPurgeBookings(true);
                              setDeleteReason("Account Fake / Test");
                            }}
                            className="btn !py-1.5 !px-3 text-xs font-bold bg-crayon-red/10 text-crayon-red hover:bg-crayon-red hover:text-white border border-crayon-red transition-all flex items-center gap-1.5"
                          >
                            <span>🗑️</span>
                            <span>Elimina Fake</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* TAB 2: UTENTI ELIMINATI (SEZIONE DATABASE DELETED_USERS) */
            filteredDeletedUsers.length === 0 ? (
              <div className="p-12 text-center text-ink/60 font-hand text-lg border-2 border-dashed border-ink/20 rounded-xl">
                Nessun account eliminato nella sezione archivio del database.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-ink/70 mb-2">
                  ℹ️ Gli account in questa sezione sono stati rimossi dal database attivo e conservati nella collezione <code>deleted_users</code> per fini di storico e verifica.
                </div>
                {filteredDeletedUsers.map((du) => (
                  <div
                    key={du.id}
                    className="sketch bg-crayon-red/5 p-4 border-2 border-crayon-red/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full border border-crayon-red bg-crayon-red/10 flex items-center justify-center text-crayon-red font-bold text-sm shrink-0">
                        🗑️
                      </div>
                      <div>
                        <div className="font-bold text-base text-ink flex items-center gap-2">
                          <span>{du.displayName}</span>
                          <span className="tag bg-crayon-red text-white text-[10px] font-bold">Eliminato</span>
                        </div>
                        <div className="text-xs text-ink/70 font-mono select-all">
                          {du.email} {du.phone ? `• Tel: ${du.phone}` : ""}
                        </div>
                        <div className="text-[11px] text-ink/60 mt-0.5">
                          Eliminato il:{" "}
                          <span className="font-medium text-ink">
                            {new Date(du.deletedAt).toLocaleDateString("it-IT", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>{" "}
                          • Da: <span className="font-medium text-ink">{du.deletedBy}</span> • Motivo: &ldquo;{du.reason}&rdquo;
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => handleRestoreUser(du.id, du.displayName)}
                        disabled={isRestoringId === du.id}
                        className="btn !py-1.5 !px-3 text-xs font-bold bg-white text-ink hover:bg-crayon-teal hover:text-white border border-ink transition-all flex items-center gap-1.5"
                      >
                        {isRestoringId === du.id ? "Ripristino..." : "🔄 Ripristina Account"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer Finestra */}
        <div className="p-3 sm:p-4 bg-[#faf6ee] border-t-2 border-ink flex items-center justify-between text-xs text-ink/70">
          <div>
            Totale account nel database: <strong>{users.length} attivi</strong> • <strong>{deletedUsers.length} eliminati</strong>
          </div>
          <button onClick={onClose} className="btn !py-1.5 !px-4 text-xs font-bold border border-ink">
            Chiudi
          </button>
        </div>
      </div>

      {/* MODALE CONFERMA ELIMINAZIONE */}
      {userToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border-2 border-ink rounded-2xl shadow-2xl p-5 sm:p-6 animate-scale-in">
            <div className="flex items-center gap-3 text-crayon-red mb-3">
              <span className="text-3xl">⚠️</span>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink">
                Elimina Utente Fake
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-ink/80 mb-3">
              Stai per eliminare l&apos;account di: <br />
              <strong className="text-base text-ink">{userToDelete.displayName}</strong>{" "}
              <span className="text-xs font-mono text-ink/70">({userToDelete.email})</span>
            </p>

            <div className="bg-crayon-yellow/15 border border-crayon-yellow p-3 rounded-lg text-xs text-ink/90 mb-4">
              📌 <strong>Cosa succede:</strong> L&apos;account verrà rimosso dagli utenti attivi e archiviato nella sezione <strong>&ldquo;Utenti Eliminati&rdquo;</strong> del database Firestore.
            </div>

            {/* Checkbox pulizia prenotazioni */}
            <label className="flex items-start gap-2.5 text-xs text-ink font-medium mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={purgeBookings}
                onChange={(e) => setPurgeBookings(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink text-crayon-red focus:ring-0"
              />
              <span>
                Elimina anche le sue {userToDelete.bookingsCount} prenotazioni e notifiche collegate nel database
              </span>
            </label>

            {/* Campo Motivo */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold uppercase text-ink/70 mb-1">
                Motivo Eliminazione (opzionale):
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="input text-xs w-full !py-1.5"
                placeholder="Es. Account Fake, Test, Richiesta utente..."
              />
            </div>

            {/* Azioni Modale */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-ink/10">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="btn !py-2 !px-4 text-xs font-bold border border-ink"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="btn btn-red !py-2 !px-4 text-xs font-bold shadow-sketch"
              >
                {isDeleting ? "Eliminazione..." : "🗑️ Conferma e Sposta in Eliminati"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
