"use client";

import { useState, useEffect } from "react";
import {
  HOURS,
  SERVICES,
  downloadIcsFile,
  formatDayLong,
  formatHour,
  makeGoogleCalendarUrl,
  makeWhatsAppUrl,
  toISODate,
  type BookingDTO,
} from "@/lib/agenda";

import { useAuth } from "./auth/AuthContext";

export type SlotTarget = { day: string; hour: number; booking: BookingDTO | null };

type Props = {
  target: SlotTarget;
  onClose: () => void;
  onCreated: (b: BookingDTO) => void;
  onUpdated: (b: BookingDTO) => void;
  onDeleted: (id: number) => void;
  allowManagerReschedule?: boolean; // Permette al gestore di modificare gli orari solo dalla Dashboard
};

const REMINDERS = [
  { v: 15, l: "15 min prima" },
  { v: 30, l: "30 min prima" },
  { v: 60, l: "1 ora prima" },
  { v: 120, l: "2 ore prima" },
  { v: 1440, l: "1 giorno prima" },
];

export function BookingModal({
  target,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  allowManagerReschedule = false,
}: Props) {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const existing = target.booking;
  const isOwner = Boolean(
    user &&
    existing &&
    ((existing.userId && existing.userId === user.id) ||
     (existing.clientEmail && user.email && existing.clientEmail.toLowerCase() === user.email.toLowerCase()))
  );

  const todayStr = toISODate(new Date());
  const [day, setDay] = useState(target.day < todayStr && !existing ? todayStr : target.day);
  const [hour, setHour] = useState(target.hour);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const isMoved = day !== target.day || hour !== target.hour;

  // Elenco corsi attivi caricati da Firestore
  const [activeCourses, setActiveCourses] = useState<{ id: number; title: string; color: string }[]>([]);

  useEffect(() => {
    fetch("/api/courses?status=active")
      .then((r) => r.json())
      .then((data) => {
        if (data.courses && Array.isArray(data.courses)) {
          setActiveCourses(data.courses.map((c: any) => ({ id: c.id, title: c.title, color: c.color })));
        }
      })
      .catch(() => {});
  }, []);

  // Se è il gestore e non c'è una prenotazione esistente, non precompila con i suoi dati personali
  const [name, setName] = useState(existing?.clientName ?? (isManager ? "" : user?.displayName ?? ""));
  const [service, setService] = useState(existing?.service ?? "Danza Classica Avanzata");
  const [email, setEmail] = useState(existing?.clientEmail ?? (isManager ? "" : user?.email ?? ""));
  const [phone, setPhone] = useState(existing?.clientPhone ?? (isManager ? "" : user?.phone ?? ""));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [reminder, setReminder] = useState(existing?.reminderMinutes ?? 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleCalUrl = makeGoogleCalendarUrl({
    day,
    hour,
    clientName: name.trim() || "Cliente",
    service,
    notes,
    clientEmail: email.trim() || null,
  });

  const whatsAppUrl = makeWhatsAppUrl({
    phone,
    clientName: name.trim() || (isManager ? "Allievo" : "Cliente"),
    day: existing ? existing.day : day,
    hour: existing ? existing.hour : hour,
    service,
    mode: isManager ? "reminder" : "confirm",
  });

  const submit = async (e: React.FormEvent, andOpenCalendar = false) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Inserisci il nome dell'allievo / cliente");
      return;
    }
    // Verifica data passata
    if (!existing && day < todayStr) {
      setError("Non puoi prenotare una lezione per un giorno passato.");
      return;
    }

    setBusy(true);
    setError(null);

    let calWin: Window | null = null;
    if (andOpenCalendar && !isManager) {
      calWin = window.open("about:blank", "_blank");
    }

    try {
      if (existing) {
        // Il gestore può cambiare orario solo se proviene dalla Dashboard (allowManagerReschedule === true)
        const targetDay = isManager && !allowManagerReschedule ? existing.day : day;
        const targetHour = isManager && !allowManagerReschedule ? existing.hour : hour;

        const res = await fetch(`/api/bookings/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: name,
            service,
            clientEmail: email || null,
            clientPhone: phone || null,
            notes: notes || null,
            reminderMinutes: reminder,
            day: targetDay,
            hour: targetHour,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Errore salvataggio");
        if (calWin) {
          calWin.location.href = googleCalUrl;
        }
        onUpdated(data.booking);
      } else {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.id ?? null,
            day,
            hour,
            clientName: name,
            service,
            clientEmail: email,
            clientPhone: phone,
            notes,
            reminderMinutes: reminder,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Errore creazione");
        if (calWin) {
          calWin.location.href = googleCalUrl;
        }
        onCreated(data.booking);
      }
    } catch (err) {
      if (calWin) calWin.close();
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!existing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${existing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore aggiornamento stato");
      onUpdated(data.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm("Eliminare definitivamente questa prenotazione dal registro?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${existing.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione");
      onDeleted(existing.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  // Se uno studente o visitatore clicca su uno slot occupato da un altro studente: SCHERMATA PRIVACY / SLOT RISERVATO
  if (existing && !isManager && !isOwner) {
    return (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 p-3 sm:p-4 backdrop-blur-[2px]" onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="sketch wobble-in relative w-full max-w-md bg-[#fff7d6] p-5 sm:p-6"
          style={{ transform: "rotate(-0.6deg)" }}
        >
          <div
            className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-[-2deg] bg-crayon-red/70"
            style={{ clipPath: "polygon(2% 0, 100% 4%, 98% 100%, 0 96%)" }}
          />
          <div className="flex items-start justify-between border-b-2 border-dashed border-ink/20 pb-2">
            <div>
              <div className="font-display text-base uppercase text-ink font-bold flex items-center gap-2">
                <span>🔒 Slot Riservato</span>
                <span className="tag bg-crayon-red text-white text-[10px] font-bold">Occupato</span>
              </div>
              <div className="font-hand mt-1 text-xl text-crayon-red">
                {formatDayLong(day)} · ore {formatHour(hour)}
              </div>
            </div>
            <button type="button" onClick={onClose} className="btn !px-2.5 !py-0.5 text-sm" aria-label="Chiudi">
              ✕
            </button>
          </div>

          <div className="my-4 rounded-lg border-2 border-dashed border-ink/20 bg-white/85 p-4 text-sm text-ink-soft space-y-3">
            <div className="flex items-center gap-3">
              <span className="sketch-sm grid h-10 w-10 shrink-0 place-items-center bg-crayon-teal text-white text-lg font-bold">
                🩰
              </span>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-ink-soft block">Corso della scuola</span>
                <span className="font-display text-base text-ink font-bold">{existing.service}</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-ink-soft border-t border-dashed border-ink/15 pt-2">
              Questo orario è già stato prenotato da un allievo della scuola.
              Per rispetto della privacy e delle scelte individuali, i dati e i contatti degli altri iscritti non sono accessibili né modificabili.
            </p>
            <p className="text-xs font-semibold text-crayon-teal">
              💡 Clicca su un qualsiasi slot orario libero nell&apos;Agenda per prenotare la tua lezione!
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ink !px-4 !py-1.5 text-xs font-semibold">
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 p-3 sm:p-4 backdrop-blur-[2px]" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="sketch wobble-in relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#fff7d6] p-4 pb-6 sm:p-5 sm:pb-6"
        style={{ transform: "rotate(-0.6deg)" }}
      >
        {/* Nastro adesivo */}
        <div
          className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-[-2deg] bg-crayon-teal/70"
          style={{ clipPath: "polygon(2% 0, 100% 4%, 98% 100%, 0 96%)" }}
        />

        {/* Intestazione */}
        <div className="flex items-start justify-between gap-2 border-b-2 border-dashed border-ink/20 pb-2">
          <div>
            <div className="font-display text-base uppercase leading-none text-ink font-bold">
              {existing
                ? isManager
                  ? `Scheda Iscritto · ${existing.clientName}`
                  : "Dettagli Prenotazione"
                : "Nuova prenotazione"}
            </div>
            <div className="font-hand mt-0.5 text-xl text-crayon-red leading-tight flex flex-wrap items-center gap-2">
              <span>{formatDayLong(day)} · ore {formatHour(hour)}</span>
              {isMoved && (
                <span className="tag bg-crayon-yellow text-ink !py-0 !px-1.5 text-[11px] font-bold shadow-xs">
                  📍 Spostato (era {formatDayLong(target.day)} {formatHour(target.hour)})
                </span>
              )}
              {existing && (
                <span className="tag bg-crayon-teal text-white !py-0 !px-1.5 text-[10px] font-bold">
                  {existing.service}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn !px-2.5 !py-0.5 text-sm" aria-label="Chiudi">
            ✕
          </button>
        </div>

        {/* 1. Selezione Giorno e Ora per Nuova Prenotazione */}
        {!existing && (
          <div className="mt-2.5 rounded-lg border-2 border-dashed border-crayon-teal/40 bg-crayon-teal/10 p-2.5">
            <span className="font-display text-[10px] uppercase tracking-wider text-crayon-teal font-bold block mb-1">
              📅 Scegli Giorno e Orario Lezione
            </span>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] uppercase text-ink-soft font-semibold">Data:</span>
                <input
                  type="date"
                  min={todayStr}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="naive mt-0.5 !py-1 text-xs"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase text-ink-soft font-semibold">Orario:</span>
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="naive mt-0.5 !py-1 text-xs"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {/* 2. Modifica Orario da parte del Gestore (Dashboard vs Agenda) */}
        {isManager && existing && (
          allowManagerReschedule ? (
            <div className="mt-2.5 rounded-lg border-2 border-dashed border-crayon-blue/40 bg-crayon-blue/10 p-2.5">
              <div className="flex items-center justify-between">
                <span className="font-display text-[10px] uppercase tracking-wider text-crayon-blue font-bold">
                  ✎ Modifica Giorno o Orario (Gestore)
                </span>
                {isMoved && (
                  <span className="tag bg-crayon-yellow text-ink text-[10px] font-bold">
                    Nuovo: {formatDayLong(day)} {formatHour(hour)}
                  </span>
                )}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] uppercase text-ink-soft font-semibold">Giorno:</span>
                  <input
                    type="date"
                    min={todayStr}
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="naive mt-0.5 !py-1 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase text-ink-soft font-semibold">Ora:</span>
                  <select
                    value={hour}
                    onChange={(e) => setHour(Number(e.target.value))}
                    className="naive mt-0.5 !py-1 text-xs"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {formatHour(h)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between rounded-lg border border-crayon-teal/40 bg-crayon-teal/10 px-3 py-1.5 text-xs text-crayon-teal font-medium">
              <span>🔒 Orario e data bloccati per sicurezza in Agenda (modificabili da Dashboard)</span>
              <span className="text-[10px] uppercase font-bold tracking-wider">Fisso</span>
            </div>
          )
        )}

        {/* 3. Spostamento Orario per l'Allievo */}
        {!isManager && existing && (
          <div className="mt-2 text-xs">
            {!isRescheduling ? (
              <button
                type="button"
                onClick={() => setIsRescheduling(true)}
                className="font-display text-[10px] uppercase tracking-wider text-crayon-blue underline hover:opacity-80"
              >
                ⇄ Sposta giorno o orario appuntamento
              </button>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-crayon-blue/40 bg-crayon-blue/5 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[10px] uppercase tracking-wider text-crayon-blue font-bold">
                    Nuovo orario appuntamento
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRescheduling(false)}
                    className="text-[11px] text-ink-soft hover:underline"
                  >
                    Chiudi selettore
                  </button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] uppercase text-ink-soft">Giorno:</span>
                    <input
                      type="date"
                      min={todayStr}
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                      className="naive mt-0.5 !py-1 text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase text-ink-soft">Ora:</span>
                    <select
                      value={hour}
                      onChange={(e) => setHour(Number(e.target.value))}
                      className="naive mt-0.5 !py-1 text-xs"
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={h}>
                          {formatHour(h)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {isMoved && (
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setDay(target.day);
                        setHour(target.hour);
                      }}
                      className="text-crayon-red underline text-[11px] hover:opacity-80"
                    >
                      Ripristina originario
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Campi form */}
        <div className="mt-3 grid gap-2.5">
          <label className="block">
            <span className="font-display text-[10px] uppercase tracking-wider">
              {isManager ? "Nome Allievo / Studente *" : "Nome Cliente / Allievo *"}
            </span>
            <input
              className="naive mt-0.5 !py-1 text-sm font-medium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome e cognome"
              required
              minLength={2}
              autoFocus
            />
          </label>

          {/* Selettore Corso o Attività: include i Corsi Attivi da Firestore */}
          <div>
            <label className="block">
              <span className="font-display text-[10px] uppercase tracking-wider block mb-1">
                {isManager ? "Corso / Materia Iscrizione *" : "Corso o Servizio *"}
              </span>
              <select
                className="naive mt-0.5 !py-1.5 text-sm font-medium w-full"
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                <optgroup label="🩰 Corsi Attivi della Scuola">
                  {activeCourses.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.title}
                    </option>
                  ))}
                  {activeCourses.length === 0 && (
                    <>
                      <option value="Danza Classica Avanzata">Danza Classica Avanzata</option>
                      <option value="Modern & Contemporary Jazz">Modern & Contemporary Jazz</option>
                      <option value="Pilates & Posturale per Ballerini">Pilates & Posturale per Ballerini</option>
                    </>
                  )}
                </optgroup>
                <optgroup label="📋 Altre Attività e Lezioni">
                  {SERVICES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="font-display text-[10px] uppercase tracking-wider">Email</span>
              <input
                className="naive mt-0.5 !py-1 text-sm"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="allievo@email.it"
              />
            </label>
            <label className="block">
              <span className="font-display text-[10px] uppercase tracking-wider">Telefono (WhatsApp)</span>
              <input
                className="naive mt-0.5 !py-1 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+39 340 …"
              />
            </label>
          </div>

          <label className="block">
            <span className="font-display text-[10px] uppercase tracking-wider">Note o richieste</span>
            <input
              className="naive mt-0.5 !py-1 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. Livello intermedio, scarpe mezza punta..."
            />
          </label>

          <label className="block">
            <span className="font-display text-[10px] uppercase tracking-wider">Promemoria automatico</span>
            <select
              className="naive mt-0.5 !py-1 text-xs"
              value={reminder}
              onChange={(e) => setReminder(Number(e.target.value))}
            >
              {REMINDERS.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.l}
                </option>
              ))}
            </select>
          </label>

          {/* Notifiche rapide: WhatsApp e Calendario */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {phone.trim().length >= 6 ? (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tag bg-crayon-green text-white hover:-rotate-1 !py-1.5 !px-3 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5"
                title="Apre WhatsApp con notifica precompilata"
              >
                💬 Invia Notifica WhatsApp
              </a>
            ) : (
              <span
                className="tag bg-gray-200 text-gray-500 !py-1.5 !px-2.5 text-[11px] cursor-not-allowed"
                title="Inserisci il numero di telefono per inviare messaggi WhatsApp"
              >
                💬 WhatsApp (inserisci telefono)
              </span>
            )}

            {!isManager && (
              <>
                <a
                  href={googleCalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tag bg-white hover:rotate-1 !py-1 !px-2.5 text-xs font-medium border border-ink shadow-xs"
                  title="Aggiungi a Google Calendar"
                >
                  📅 Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() =>
                    downloadIcsFile({
                      day,
                      hour,
                      clientName: name.trim() || "Cliente",
                      service,
                      notes,
                      reminderMinutes: reminder,
                    })
                  }
                  className="tag bg-white hover:rotate-1 !py-1 !px-2.5 text-xs font-medium border border-ink shadow-xs"
                  title="Scarica file calendario .ics"
                >
                  📎 Scarica .ics
                </button>
              </>
            )}
          </div>
        </div>

        {error && <div className="font-hand mt-2 text-lg text-crayon-red">✗ {error}</div>}

        {/* Pulsanti azione inferiori */}
        <div className="mt-4 flex flex-col gap-2 border-t-2 border-dashed border-ink/20 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {existing ? (
            <div className="flex flex-wrap gap-1.5">
              {isManager && existing.status !== "done" && (
                <button
                  type="button"
                  onClick={() => setStatus("done")}
                  className="btn btn-teal !px-2.5 !py-1 text-xs"
                  disabled={busy}
                  title="Marca la lezione come completata"
                >
                  ✓ Segna Fatto
                </button>
              )}
              {existing.status !== "cancelled" && (
                <button
                  type="button"
                  onClick={() => setStatus("cancelled")}
                  className="btn !px-2.5 !py-1 text-xs text-crayon-red border-crayon-red/40 hover:bg-crayon-red hover:text-white font-semibold"
                  disabled={busy}
                  title="Annulla la prenotazione"
                >
                  ✕ Annulla Prenotazione
                </button>
              )}
              {isManager && (
                <button
                  type="button"
                  onClick={remove}
                  className="btn !px-2.5 !py-1 text-xs text-crayon-red border-crayon-red/50 hover:bg-crayon-red hover:text-white"
                  disabled={busy}
                  title="Elimina definitivamente dal registro"
                >
                  🗑 Elimina
                </button>
              )}
            </div>
          ) : (
            <span className="font-hand text-xs text-ink-soft">Promemoria automatico attivo ✎</span>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isManager ? (
              <button
                type="submit"
                className="btn btn-teal !px-4 !py-1.5 text-xs font-bold text-white shadow-sm"
                disabled={busy}
              >
                {busy ? "Salvataggio…" : "💾 Salva Modifiche"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => submit(e, true)}
                  className="btn btn-yellow !px-3 !py-1.5 text-xs font-medium"
                  disabled={busy}
                  title="Salva la prenotazione e apre Google Calendar"
                >
                  📅 {isMoved ? "Sposta + Calendar" : existing ? "Salva + Calendar" : "Prenota + Calendar"}
                </button>
                <button type="submit" className="btn btn-red !px-3.5 !py-1.5 text-xs font-medium" disabled={busy}>
                  {busy ? "…" : isMoved ? "Sposta appuntamento ✎" : existing ? "Salva modifiche" : "Prenota ✎"}
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
