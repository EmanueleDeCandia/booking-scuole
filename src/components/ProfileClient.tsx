"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "./auth/AuthContext";
import { useToast } from "./Toasts";
import { auth } from "@/lib/firebase";
import { updateProfile as fbUpdateProfile } from "firebase/auth";
import {
  formatDayLong,
  formatHour,
  serviceColor,
  makeGoogleCalendarUrl,
  downloadIcsFile,
  makeWhatsAppUrl,
  toISODate,
  type BookingDTO,
  type UserDTO,
} from "@/lib/agenda";
import { BookingModal, type SlotTarget } from "./BookingModal";
import { ManagerProfileClient } from "./ManagerProfileClient";
import { StudentGamificationCard } from "./StudentGamificationCard";

export function ProfileClient() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-12 text-center">
        <div className="font-hand text-xl text-ink">Caricamento profilo in corso… 🎨</div>
      </div>
    );
  }

  if (user?.role === "manager") {
    return <ManagerProfileClient />;
  }

  return <StudentProfileClient />;
}

function StudentProfileClient() {
  const { user, refreshProfile, updateCurrentUser, signOut, loading: authLoading } = useAuth();
  const toast = useToast();

  const [profileData, setProfileData] = useState<{
    user: UserDTO;
    stats: { total: number; present: number; absent: number; upcoming: number; cancelled: number };
    bookings: BookingDTO[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");

  // Modifica dati profilo
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modale Prenotazione / Spostamento
  const [targetSlot, setTargetSlot] = useState<SlotTarget | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/profile?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        setDisplayName(data.user.displayName || "");
        setPhone(data.user.phone || "");
        setNotes(data.user.notes || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading, loadData]);

  // Caricamento Foto Profilo
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore durante il caricamento");

      toast.show("Foto profilo aggiornata con successo! 📸", "info");
      await refreshProfile();
      await loadData();
    } catch (err: any) {
      toast.show(err.message || "Impossibile caricare la foto", "error");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Salvataggio dati profilo
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (auth?.currentUser && displayName.trim()) {
        try {
          await fbUpdateProfile(auth.currentUser, { displayName: displayName.trim() });
        } catch (fbErr) {
          console.warn("Could not update Firebase displayName:", fbErr);
        }
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          displayName: displayName.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        }),
      });
      if (!res.ok) throw new Error("Errore aggiornamento");
      const resData = await res.json();
      if (resData.user) {
        updateCurrentUser(resData.user);
      }
      toast.show("Dati del profilo salvati con successo! 💾", "info");
      setIsEditing(false);
      await refreshProfile();
      await loadData();
    } catch (err: any) {
      toast.show(err.message || "Errore durante il salvataggio", "error");
    }
  };

  // Cancellazione corso
  const handleCancelBooking = async (bookingId: number) => {
    if (!confirm("Sei sicuro di voler annullare questa prenotazione? Lo slot tornerà disponibile per gli altri allievi.")) {
      return;
    }
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          userId: user?.id ?? null,
          clientEmail: user?.email ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore cancellazione");
      }
      toast.show("Prenotazione annullata.", "info");
      await loadData();
    } catch (err: any) {
      toast.show(err.message || "Errore durante l'annullamento", "error");
    }
  };

  // Apri modale per nuovo corso
  const handleBookNew = () => {
    const today = toISODate(new Date());
    const curH = new Date().getHours();
    const nextH = Math.min(18, Math.max(8, curH >= 18 ? 9 : curH + 1));
    setTargetSlot({
      day: today,
      hour: nextH,
      booking: null,
    });
  };

  // Apri modale per spostare corso esistente
  const handleReschedule = (b: BookingDTO) => {
    setTargetSlot({
      day: b.day,
      hour: b.hour,
      booking: b,
    });
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="font-hand inline-block animate-pulse text-2xl text-ink-soft">
          Caricamento del tuo profilo allievo… ✎
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-md px-3 py-8 sm:px-4 sm:py-16 text-center">
        <div className="sketch bg-white/95 p-5 sm:p-8">
          <span className="sketch-sm inline-grid h-12 w-12 sm:h-14 sm:w-14 place-items-center bg-crayon-yellow text-2xl sm:text-3xl text-ink">
            👤
          </span>
          <h1 className="font-display mt-3 sm:mt-4 text-2xl sm:text-3xl text-ink">Accedi al Profilo</h1>
          <p className="font-hand mt-1.5 sm:mt-2 text-base sm:text-lg text-ink-soft">
            Per visualizzare le tue iscrizioni, presenze e gestire i corsi, effettua l&apos;accesso o crea un nuovo account.
          </p>
          <div className="mt-5 sm:mt-6 flex flex-col gap-2">
            <Link href="/auth/login" className="btn btn-ink justify-center py-2 sm:py-2.5 font-bold text-sm sm:text-base">
              Accedi al tuo Account
            </Link>
            <Link href="/auth/register" className="btn justify-center py-2 text-xs sm:text-sm font-semibold">
              Iscriviti come Allievo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const todayStr = toISODate(new Date());
  const curHour = new Date().getHours();
  const bookings = profileData?.bookings || [];

  const isUpcoming = (b: BookingDTO) => {
    if (b.status === "cancelled") return false;
    if (b.day > todayStr) return true;
    if (b.day === todayStr && b.hour >= curHour) return true;
    return false;
  };

  const upcomingBookings = bookings.filter(isUpcoming);
  const pastBookings = bookings.filter((b) => !isUpcoming(b));
  const stats = profileData?.stats || { total: 0, present: 0, absent: 0, upcoming: 0, cancelled: 0 };

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-8 sm:py-6">
      {/* Intestazione Profilo & Scheda Iscrizione */}
      <div className="sketch bg-white/95 p-4 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            {/* Foto Profilo con Upload */}
            <div className="relative group">
              <div className="sketch-sm relative h-24 w-24 overflow-hidden border-2 border-ink bg-crayon-yellow/20 shadow-xs sm:h-28 sm:w-28">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-4xl text-ink-soft">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 grid place-items-center bg-ink/60 text-xs font-bold text-white">
                    Carico…
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="sketch-sm absolute -bottom-2 -right-2 bg-crayon-blue px-2 py-1 text-[11px] font-bold text-white shadow-xs transition hover:scale-105"
                title="Carica una foto per il tuo profilo"
              >
                📷 Foto
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            {/* Dati Anagrafici */}
            <div className="text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="font-display text-2xl text-ink sm:text-3xl">{user.displayName}</h1>
                <span className="tag bg-crayon-green text-white text-[11px] font-bold shadow-xs">
                  {user.role === "manager" ? "👑 Gestore" : "🎓 Allievo Iscritto"}
                </span>
                <span className="tag bg-crayon-teal/20 text-ink text-[11px] font-medium">
                  ✓ Iscrizione Attiva
                </span>
              </div>
              <p className="font-hand text-lg text-ink-soft">{user.email}</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs text-ink-soft sm:justify-start">
                {user.phone && <span>📞 {user.phone}</span>}
                <span>📅 Iscritto il: {new Date(user.membershipDate).toLocaleDateString("it-IT")}</span>
              </div>
            </div>
          </div>

          {/* Azioni Profilo */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-yellow text-xs font-bold"
            >
              {isEditing ? "Annulla Modifica" : "✏️ Modifica Dati"}
            </button>
            <button
              type="button"
              onClick={handleBookNew}
              className="btn btn-red text-xs font-bold"
            >
              + Prenota Corso ✎
            </button>
            <Link href="/corsi" className="btn btn-teal text-xs font-bold">
              🎭 Corsi in Programma
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="btn !px-3 !py-1 text-xs text-ink-soft hover:text-crayon-red"
            >
              Esci
            </button>
          </div>
        </div>

        {/* Form Modifica Dati Profilo */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 border-t border-dashed border-ink/20 pt-4">
            <h3 className="font-display text-sm uppercase tracking-wider text-ink mb-3">
              Modifica i tuoi dati anagrafici
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-ink-soft">Nome e Cognome</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full rounded border border-ink/20 bg-paper px-3 py-1.5 text-sm outline-none focus:border-crayon-blue"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft">Telefono</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+39 340 ..."
                  className="mt-1 w-full rounded border border-ink/20 bg-paper px-3 py-1.5 text-sm outline-none focus:border-crayon-blue"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft">Note Personali</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Es. Livello intermedio, allergie..."
                  className="mt-1 w-full rounded border border-ink/20 bg-paper px-3 py-1.5 text-sm outline-none focus:border-crayon-blue"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn !px-3 !py-1 text-xs"
              >
                Annulla
              </button>
              <button type="submit" className="btn btn-ink !px-4 !py-1 text-xs font-bold">
                Salva Modifiche
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Schede Riepilogo: Presenze / Assenze / Corsi Frequentati */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="card-sketch bg-crayon-yellow/20 p-4 text-center">
          <span className="font-hand text-3xl font-bold text-ink sm:text-4xl">{stats.total}</span>
          <p className="font-display mt-1 text-[11px] uppercase tracking-wider text-ink-soft">
            Corsi Totali
          </p>
        </div>
        <div className="card-sketch bg-crayon-green/20 p-4 text-center">
          <span className="font-hand text-3xl font-bold text-crayon-green sm:text-4xl">
            {stats.present}
          </span>
          <p className="font-display mt-1 text-[11px] uppercase tracking-wider text-ink-soft">
            Presenze Convalidate
          </p>
        </div>
        <div className="card-sketch bg-crayon-red/10 p-4 text-center">
          <span className="font-hand text-3xl font-bold text-crayon-red sm:text-4xl">{stats.absent}</span>
          <p className="font-display mt-1 text-[11px] uppercase tracking-wider text-ink-soft">
            Assenze / Mancate
          </p>
        </div>
        <div className="card-sketch bg-crayon-teal/20 p-4 text-center">
          <span className="font-hand text-3xl font-bold text-ink sm:text-4xl">{stats.upcoming}</span>
          <p className="font-display mt-1 text-[11px] uppercase tracking-wider text-ink-soft">
            In Programma
          </p>
        </div>
      </div>

      {/* Banner Nuovi Corsi in Programma & Sondaggio Appeal */}
      <div className="mt-6 sketch-sm border-2 border-dashed border-crayon-teal bg-crayon-teal/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-display text-sm font-bold text-ink uppercase flex items-center gap-1.5">
              <span>🎭</span> Nuovi Corsi in Programma &amp; Sondaggio Appeal
            </span>
            <p className="font-hand text-base sm:text-lg text-ink-soft mt-0.5">
              Scopri le nuove discipline proposte dalla scuola e vota l&apos;indice di gradimento per aiutarci ad attivarle!
            </p>
          </div>
          <Link href="/corsi" className="btn btn-teal text-xs font-bold">
            Esplora e Vota i Corsi 🌟
          </Link>
        </div>
      </div>

      {/* Sezione Libretto Didattico & Gamification Allievo */}
      <div id="gamification" className="mt-8">
        <StudentGamificationCard
          student={profileData?.user || user}
          onRefresh={refreshProfile}
        />
      </div>

      {/* Gestione Corsi: Tab In programma vs Storico */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/20 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("upcoming")}
              className={`btn text-xs font-bold ${activeTab === "upcoming" ? "btn-ink" : ""}`}
            >
              📅 Lezioni Prenotate ({upcomingBookings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`btn text-xs font-bold ${activeTab === "history" ? "btn-ink" : ""}`}
            >
              📜 Storico & Presenze ({pastBookings.length})
            </button>
          </div>
          <button
            type="button"
            onClick={handleBookNew}
            className="btn btn-yellow text-xs font-bold"
          >
            + Prenota Altro Corso
          </button>
        </div>

        {/* Tab 1: Lezioni Prenotate */}
        {activeTab === "upcoming" && (
          <div className="mt-4 space-y-3">
            {upcomingBookings.length === 0 ? (
              <div className="card-sketch bg-white/80 p-8 text-center">
                <p className="font-hand text-xl text-ink-soft">
                  Non hai ancora lezioni prenotate nei prossimi giorni!
                </p>
                <button
                  type="button"
                  onClick={handleBookNew}
                  className="btn btn-red mt-3 inline-flex items-center gap-1 font-bold text-xs"
                >
                  Prenota la tua prossima lezione ✎
                </button>
              </div>
            ) : (
              upcomingBookings.map((b) => {
                const googleUrl = makeGoogleCalendarUrl({
                  day: b.day,
                  hour: b.hour,
                  clientName: b.clientName,
                  service: b.service,
                  notes: b.notes,
                  clientEmail: b.clientEmail,
                });

                return (
                  <div
                    key={b.id}
                    className="card-sketch flex flex-col justify-between gap-4 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="sketch-sm grid h-12 w-12 place-items-center text-xl text-white shadow-xs"
                        style={{ backgroundColor: serviceColor(b.service) }}
                      >
                        🩰
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg text-ink">{b.service}</span>
                          <span className={`tag text-white text-[10px] font-bold ${b.status === "confirmed" ? "bg-crayon-green" : "bg-crayon-yellow"}`}>
                            {b.status === "confirmed" ? "Confermato" : "In attesa"}
                          </span>
                        </div>
                        <div className="font-hand text-lg text-crayon-red">
                          {formatDayLong(b.day)} · ore {formatHour(b.hour)}
                        </div>
                        {b.notes && <p className="text-xs text-ink-soft">Note: {b.notes}</p>}
                      </div>
                    </div>

                    {/* Azioni: Sposta, Annulla, Calendario */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-ink/20 pt-2 sm:border-0 sm:pt-0">
                      <a
                        href={googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn !px-2.5 !py-1 text-xs"
                        title="Aggiungi a Google Calendar"
                      >
                        📅 Cal
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          downloadIcsFile({
                            day: b.day,
                            hour: b.hour,
                            clientName: b.clientName,
                            service: b.service,
                            notes: b.notes,
                            reminderMinutes: b.reminderMinutes,
                          })
                        }
                        className="btn !px-2.5 !py-1 text-xs"
                        title="Scarica file .ics"
                      >
                        📎 .ics
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReschedule(b)}
                        className="btn btn-yellow !px-3 !py-1 text-xs font-bold"
                        title="Sposta data o orario del corso"
                      >
                        🔄 Sposta Corso
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelBooking(b.id)}
                        className="btn !px-3 !py-1 text-xs font-bold text-white bg-crayon-red hover:bg-crayon-red/80 shadow-xs"
                        title="Annulla la prenotazione di questa lezione"
                      >
                        ✕ Annulla Corso
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Storico & Presenze */}
        {activeTab === "history" && (
          <div className="mt-4 space-y-3">
            {pastBookings.length === 0 ? (
              <div className="card-sketch bg-white/80 p-8 text-center">
                <p className="font-hand text-xl text-ink-soft">
                  Nessun corso nello storico passato.
                </p>
              </div>
            ) : (
              pastBookings.map((b) => {
                const isAbsent = b.attendanceStatus === "absent";
                const isPresent = !isAbsent && (b.attendanceStatus === "present" || b.status === "done");
                const isCancelled = b.status === "cancelled";

                return (
                  <div
                    key={b.id}
                    className="card-sketch flex flex-col justify-between gap-3 bg-white/90 p-4 shadow-xs sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base text-ink">{b.service}</span>
                        {isPresent && (
                          <span className="tag bg-crayon-green text-white text-[10px] font-bold">
                            ✓ Presente
                          </span>
                        )}
                        {isAbsent && (
                          <span className="tag bg-crayon-red text-white text-[10px] font-bold">
                            ✗ Assente
                          </span>
                        )}
                        {isCancelled && (
                          <span className="tag bg-gray-300 text-gray-700 text-[10px] font-medium">
                            Annullato
                          </span>
                        )}
                      </div>
                      <div className="font-hand text-base text-ink-soft">
                        {formatDayLong(b.day)} · ore {formatHour(b.hour)}
                      </div>
                    </div>
                    <div className="text-xs text-ink-soft">
                      Registrato il {new Date(b.createdAt).toLocaleDateString("it-IT")}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modale Prenotazione / Modifica */}
      {targetSlot && (
        <BookingModal
          target={targetSlot}
          onClose={() => setTargetSlot(null)}
          onCreated={() => {
            setTargetSlot(null);
            toast.show("Corso prenotato con successo!", "info");
            loadData();
          }}
          onUpdated={() => {
            setTargetSlot(null);
            toast.show("Prenotazione aggiornata con successo!", "info");
            loadData();
          }}
          onDeleted={() => {
            setTargetSlot(null);
            toast.show("Prenotazione rimossa.", "info");
            loadData();
          }}
        />
      )}
    </div>
  );
}
