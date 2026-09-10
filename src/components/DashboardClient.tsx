"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SERVICES,
  bookingDateTime,
  formatDayLong,
  formatHour,
  makeWhatsAppUrl,
  serviceColor,
  type BookingDTO,
  type NotificationDTO,
} from "@/lib/agenda";
import { BookingModal, type SlotTarget } from "./BookingModal";
import { useToast } from "./Toasts";

import { useAuth } from "./auth/AuthContext";

type Filter = "upcoming" | "today" | "done" | "cancelled" | "all";

export function DashboardClient({
  initialBookings,
  initialNotifications,
}: {
  initialBookings: BookingDTO[];
  initialNotifications: NotificationDTO[];
}) {
  const { user, role } = useAuth();
  const toast = useToast();
  const [bookings, setBookings] = useState(initialBookings);
  const [notifs, setNotifs] = useState(initialNotifications);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<SlotTarget | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const reload = useCallback(async () => {
    const [b, n] = await Promise.all([
      fetch("/api/bookings?all=1", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/notifications", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setBookings(b.items);
    setNotifs(n.items);
    window.dispatchEvent(new Event("bookings:changed"));
  }, []);

  const markAttendance = async (b: BookingDTO, attendanceStatus: "present" | "absent") => {
    if (b.status === "cancelled") return;
    const patch: Record<string, unknown> = { attendanceStatus };
    if (attendanceStatus === "present") {
      patch.status = "done";
    }
    await fetch(`/api/bookings/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    toast.push({
      title: attendanceStatus === "present" ? "Presenza Convalidata" : "Assenza Registrata",
      message: `${b.clientName} segnato come ${attendanceStatus === "present" ? "Presente" : "Assente"}`,
      tone: attendanceStatus === "present" ? "teal" : "red",
    });
    reload();
  };

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const stats = useMemo(() => {
    const upcoming = bookings.filter((b) => b.status === "confirmed" && bookingDateTime(b.day, b.hour) >= now);
    const today = bookings.filter((b) => b.day === todayISO && b.status !== "cancelled");
    const done = bookings.filter((b) => b.status === "done");
    const cancelled = bookings.filter((b) => b.status === "cancelled");
    const byService = SERVICES.map((s) => ({
      ...s,
      n: bookings.filter((b) => b.service === s.id && b.status !== "cancelled").length,
    }));
    const max = Math.max(1, ...byService.map((s) => s.n));
    return { upcoming, today, done, cancelled, byService, max, next: upcoming[0] ?? null };
  }, [bookings, now, todayISO]);

  const list = useMemo(() => {
    let l = bookings.slice();
    if (filter === "upcoming") l = l.filter((b) => b.status === "confirmed" && bookingDateTime(b.day, b.hour) >= now);
    if (filter === "today") l = l.filter((b) => b.day === todayISO && b.status !== "cancelled");
    if (filter === "done") l = l.filter((b) => b.status === "done");
    if (filter === "cancelled") l = l.filter((b) => b.status === "cancelled");
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      l = l.filter((b) => b.clientName.toLowerCase().includes(s) || b.service.toLowerCase().includes(s) || (b.notes ?? "").toLowerCase().includes(s));
    }
    return l.sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour);
  }, [bookings, filter, q, now, todayISO]);

  const quick = async (b: BookingDTO, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "cancelled") {
      patch.attendanceStatus = "pending";
    }
    const res = await fetch(`/api/bookings/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      toast.push({
        title: status === "done" ? "Completato" : status === "cancelled" ? "Annullato" : status === "confirmed" ? "Appuntamento Confermato" : "Ripristinato",
        message: b.clientName,
        tone: status === "cancelled" ? "ink" : status === "confirmed" ? "teal" : "yellow",
      });
      reload();
    }
  };

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "upcoming", label: "In arrivo", n: stats.upcoming.length },
    { id: "today", label: "Oggi", n: stats.today.length },
    { id: "done", label: "Fatti", n: stats.done.length },
    { id: "cancelled", label: "Annullati", n: stats.cancelled.length },
    { id: "all", label: "Tutti", n: bookings.length },
  ];

  const reminders = notifs.filter((n) => n.kind === "reminder");

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-16 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-[clamp(2rem,5vw,4.5rem)] leading-[0.95]">
            Dash<span className="crayon-hl" style={{ ["--hl" as string]: "var(--crayon-red)" }}>board</span>
          </h1>
          <p className="font-hand mt-1.5 sm:mt-2 text-xl sm:text-3xl text-ink-soft">Gestisci gli appuntamenti scritti sull&apos;agenda.</p>
        </div>
        <Link href="/" className="btn btn-red !py-2 !px-3.5 sm:!py-2.5 sm:!px-5 text-xs sm:text-base font-bold shadow-sketch">
          ✎ Apri l&apos;agenda 3D
        </Link>
      </div>

      {user && role !== "manager" && (
        <div className="sketch-sm mt-4 border-2 border-dashed border-crayon-yellow bg-crayon-yellow/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-display text-sm font-bold text-ink uppercase">⚠️ Modalità Allievo Attiva</span>
              <p className="font-hand text-lg text-ink-soft">
                Sei connesso con l&apos;account allievo <strong>{user.displayName}</strong>. Questa schermata è la console completa del gestore.
              </p>
            </div>
            <Link href="/profilo" className="btn btn-ink text-xs font-bold">
              Vai al Tuo Profilo Personale 👤
            </Link>
          </div>
        </div>
      )}

      {/* statistiche */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="In arrivo" value={stats.upcoming.length} bg="bg-crayon-teal" rot="-1.2deg" />
        <Stat label="Oggi" value={stats.today.length} bg="bg-crayon-yellow" rot="0.8deg" />
        <Stat label="Completati" value={stats.done.length} bg="bg-white" rot="-0.5deg" />
        <Stat label="Annullati" value={stats.cancelled.length} bg="bg-crayon-red text-white" rot="1.4deg" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* prossimo appuntamento */}
        <div className="sketch relative overflow-hidden bg-[#fff7d6] p-5">
          <div className="font-display text-xs uppercase tracking-wider">Prossimo appuntamento</div>
          {stats.next ? (
            <>
              <div className="font-hand mt-2 text-4xl leading-none">{stats.next.clientName}</div>
              <div className="font-hand mt-1 text-2xl text-crayon-red">
                {formatDayLong(stats.next.day)} · {formatHour(stats.next.hour)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="tag" style={{ background: serviceColor(stats.next.service), color: "#fff" }}>
                  {stats.next.service}
                </span>
                <span className="tag bg-white">⏰ {stats.next.reminderMinutes >= 60 ? `${stats.next.reminderMinutes / 60} h` : `${stats.next.reminderMinutes} min`} prima</span>
                <Countdown to={bookingDateTime(stats.next.day, stats.next.hour)} now={now} />
              </div>
              {stats.next.notes && <p className="font-hand mt-3 text-xl text-ink-soft">“{stats.next.notes}”</p>}
              <div className="mt-4 flex gap-2">
                <button className="btn btn-teal" onClick={() => quick(stats.next!, "done")}>
                  ✓ Fatto
                </button>
                <button className="btn" onClick={() => setTarget({ day: stats.next!.day, hour: stats.next!.hour, booking: stats.next })}>
                  Modifica
                </button>
              </div>
            </>
          ) : (
            <p className="font-hand mt-3 text-2xl text-ink-soft">Nessun appuntamento in arrivo. Apri l&apos;agenda e prenota ✎</p>
          )}
          <Doodle className="absolute -right-6 -bottom-6 h-32 w-32 opacity-60" />
        </div>

        {/* grafico servizi */}
        <div className="sketch p-5">
          <div className="font-display text-xs uppercase tracking-wider">Servizi più richiesti</div>
          <ul className="mt-4 space-y-3">
            {stats.byService.map((s) => (
              <li key={s.id}>
                <div className="flex items-center justify-between">
                  <span className="font-hand text-xl leading-none">{s.label}</span>
                  <span className="font-display text-sm">{s.n}</span>
                </div>
                <div className="mt-1 crayon-bar" style={{ ["--bar" as string]: s.color, width: `${Math.max(6, (s.n / stats.max) * 100)}%` }} />
              </li>
            ))}
          </ul>
        </div>

        {/* promemoria */}
        <div className="sketch p-5">
          <div className="flex items-center justify-between">
            <div className="font-display text-xs uppercase tracking-wider">Promemoria inviati</div>
            <span className="tag bg-crayon-yellow">{reminders.length}</span>
          </div>
          <ul className="scroll-thin mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {reminders.length === 0 && (
              <li className="font-hand text-xl text-ink-soft">
                I promemoria compaiono qui (e come notifica) quando manca poco all&apos;appuntamento.
              </li>
            )}
            {reminders.map((n) => (
              <li key={n.id} className="sketch-sm bg-white px-3 py-2">
                <div className="font-hand text-lg leading-tight">⏰ {n.message}</div>
                <div className="text-[10px] uppercase tracking-wider text-ink-soft">
                  {new Date(n.createdAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </li>
            ))}
          </ul>
          <button
            className="btn mt-3"
            onClick={async () => {
              const r = await fetch("/api/reminders/run", { method: "POST" }).then((x) => x.json());
              toast.push({ title: "Controllo promemoria", message: `${r.created} nuovi promemoria`, tone: "teal" });
              reload();
            }}
          >
            ⟳ Controlla ora
          </button>
        </div>
      </div>

      {/* lista */}
      <div className="sketch mt-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2.5">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`tag transition-transform hover:-rotate-1 !py-2 !px-4 text-sm sm:text-base font-bold ${
                  filter === f.id ? "bg-ink text-white shadow-sketch" : "bg-white text-ink"
                }`}
              >
                {f.label} <span className="font-display text-xs sm:text-sm opacity-80">({f.n})</span>
              </button>
            ))}
          </div>
          <input
            className="naive max-w-sm !py-2.5 !px-4 text-sm sm:text-base"
            placeholder="cerca cliente, servizio, note…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[850px] border-separate border-spacing-y-3">
            <thead>
              <tr className="font-display text-left text-xs sm:text-sm uppercase tracking-wider text-ink-soft">
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Servizio</th>
                <th className="px-4 py-2">Contatti</th>
                <th className="px-4 py-2">Stato</th>
                <th className="px-4 py-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="font-hand px-4 py-12 text-center text-3xl text-ink-soft">
                    Niente da mostrare qui ✎
                  </td>
                </tr>
              )}
              {list.map((b, i) => {
                const [y, m, d] = b.day.split("-").map(Number);
                const slotEnd = new Date(y, m - 1, d, Number(b.hour) + 1, 0, 0);
                const isPast = now >= slotEnd || b.status === "done";
                const isCancelled = b.status === "cancelled";

                return (
                  <tr key={b.id} className="bg-white hover:bg-paper-aged/30 transition-colors" style={{ transform: `rotate(${i % 2 ? 0.15 : -0.15}deg)` }}>
                    <td className="rounded-l-xl border-y-2 border-l-2 border-ink px-4 py-3.5">
                      <div className="font-hand text-2xl sm:text-3xl leading-none text-ink font-bold">{formatDayLong(b.day)}</div>
                      <div className="text-xs sm:text-sm uppercase tracking-wider text-ink-soft mt-1 font-medium">ore {formatHour(b.hour)}</div>
                    </td>
                    <td className="border-y-2 border-ink px-4 py-3.5">
                      <div className="font-hand text-2xl sm:text-3xl leading-none text-ink">{b.clientName}</div>
                      {b.notes && <div className="text-xs sm:text-sm text-ink-soft mt-1">“{b.notes}”</div>}
                    </td>
                    <td className="border-y-2 border-ink px-4 py-3.5">
                      <span className="tag text-xs sm:text-sm font-bold !py-1 !px-3 shadow-xs" style={{ background: serviceColor(b.service), color: "#fff" }}>
                        {b.service}
                      </span>
                    </td>
                    <td className="border-y-2 border-ink px-4 py-3.5 text-sm sm:text-base">
                      <div className="font-medium text-ink">{b.clientEmail ?? "—"}</div>
                      <div className="flex items-center gap-2 text-ink-soft mt-1">
                        <span>{b.clientPhone || "—"}</span>
                        {b.clientPhone && (
                          <a
                            href={makeWhatsAppUrl({
                              phone: b.clientPhone,
                              clientName: b.clientName,
                              day: b.day,
                              hour: b.hour,
                              service: b.service,
                              mode: b.status === "pending" ? "confirm" : "reminder",
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tag !bg-crayon-green !text-white !py-0.5 !px-2 text-xs font-bold hover:scale-105"
                            title={
                              b.status === "pending"
                                ? "Invia conferma WhatsApp e imposta lo stato su Confermato"
                                : "Invia promemoria WhatsApp al cliente (testo precompilato)"
                            }
                            onClick={() => {
                              if (b.status === "pending") {
                                quick(b, "confirmed");
                              }
                            }}
                          >
                            💬 WA
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="border-y-2 border-ink px-4 py-3.5">
                      <StatusPill status={b.status} sent={b.reminderSent} attendance={b.attendanceStatus} isPast={isPast} />
                    </td>
                    <td className="rounded-r-xl border-y-2 border-r-2 border-ink px-4 py-3.5">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {/* Validazione Presenze / Assenze: attiva se la lezione è passata e NON annullata */}
                        {!isCancelled && (
                          <div className="flex items-center gap-1.5 border-r border-ink/20 pr-2">
                            {isPast ? (
                              <>
                                <button
                                  className={`btn !px-2.5 !py-1 text-xs sm:text-sm font-bold uppercase transition-all ${
                                    b.attendanceStatus === "present"
                                      ? "bg-crayon-green text-white shadow-xs"
                                      : "text-crayon-green hover:bg-crayon-green/20"
                                  }`}
                                  title="Segna presenza dell'allievo"
                                  onClick={() => markAttendance(b, "present")}
                                >
                                  ✓ Presente
                                </button>
                                <button
                                  className={`btn !px-2.5 !py-1 text-xs sm:text-sm font-bold uppercase transition-all ${
                                    b.attendanceStatus === "absent"
                                      ? "bg-crayon-red text-white shadow-xs"
                                      : "text-crayon-red hover:bg-crayon-red/20"
                                  }`}
                                  title="Segna assenza dell'allievo"
                                  onClick={() => markAttendance(b, "absent")}
                                >
                                  ✗ Assente
                                </button>
                              </>
                            ) : (
                              <span className="tag bg-paper-aged/80 text-ink-soft !py-1 !px-2 text-xs border border-dashed border-ink/30 font-medium" title="La lezione non è ancora iniziata">
                                ⏳ In arrivo
                              </span>
                            )}
                          </div>
                        )}

                        {b.status === "pending" && (
                          <button
                            className="btn btn-yellow !px-2.5 !py-1 text-xs sm:text-sm font-bold shadow-xs flex items-center gap-1"
                            title="Conferma prenotazione"
                            onClick={() => quick(b, "confirmed")}
                          >
                            ✓ Conferma
                          </button>
                        )}
                        {b.status === "confirmed" && (
                          <button className="btn !px-3 !py-1 text-sm font-bold" title="Completa" onClick={() => quick(b, "done")}>
                            ✓
                          </button>
                        )}
                        {!isCancelled ? (
                          <button className="btn !px-3 !py-1 text-sm font-bold text-ink-soft hover:text-crayon-red" title="Annulla prenotazione" onClick={() => quick(b, "cancelled")}>
                            ✕
                          </button>
                        ) : (
                          <button className="btn btn-yellow !px-3 !py-1 text-xs sm:text-sm font-bold shadow-xs" title="Ripristina prenotazione" onClick={() => quick(b, "confirmed")}>
                            ↺ Ripristina
                          </button>
                        )}
                        <button className="btn !px-3 !py-1 text-sm font-bold" title="Modifica dettagli" onClick={() => setTarget({ day: b.day, hour: b.hour, booking: b })}>
                          ✎
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {target && (
        <BookingModal
          target={target}
          allowManagerReschedule={true}
          onClose={() => setTarget(null)}
          onCreated={() => {
            setTarget(null);
            reload();
          }}
          onUpdated={(b) => {
            const isMoved = b.day !== target.day || b.hour !== target.hour;
            setTarget(null);
            toast.push({
              title: isMoved ? "Spostato!" : "Aggiornato",
              message: `${b.clientName} · ${formatDayLong(b.day)} ${formatHour(b.hour)}`,
              tone: isMoved ? "teal" : "yellow",
            });
            reload();
          }}
          onDeleted={() => {
            setTarget(null);
            toast.push({ title: "Eliminato", tone: "ink" });
            reload();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, bg, rot }: { label: string; value: number; bg: string; rot: string }) {
  return (
    <div className={`sketch p-5 sm:p-6 ${bg}`} style={{ transform: `rotate(${rot})` }}>
      <div className="font-display text-xs sm:text-sm uppercase tracking-wider font-bold opacity-90">{label}</div>
      <div className="font-display mt-1 text-5xl sm:text-6xl leading-none">{value}</div>
    </div>
  );
}

function StatusPill({ status, sent, attendance, isPast }: { status: string; sent: boolean; attendance?: string; isPast: boolean }) {
  const map: Record<string, { l: string; c: string }> = {
    pending_confirmation: { l: "in attesa di conferma", c: "bg-crayon-yellow text-ink border-2 border-ink font-bold shadow-xs" },
    pending: { l: "in attesa", c: "bg-crayon-yellow text-ink border-2 border-ink font-bold shadow-xs" },
    confirmed: { l: "confermato", c: "bg-crayon-teal text-white" },
    done: { l: "fatto", c: "bg-crayon-green text-white" },
    cancelled: { l: "annullato", c: "bg-ink text-white" },
  };
  const s = map[status] ?? { l: status, c: "bg-white text-ink" };
  const isCancelled = status === "cancelled";

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`tag font-bold !py-0.5 !px-2.5 text-xs sm:text-sm ${s.c}`}>{s.l}</span>
        {/* SE qualcuno ha annullato NON può MAI essere Presente. Presente scatta solo se la lezione è passata/conclusa */}
        {!isCancelled && isPast && attendance === "present" && (
          <span className="tag bg-crayon-green text-white !py-0.5 !px-2 text-xs sm:text-sm font-bold shadow-xs">
            ✓ Presente
          </span>
        )}
        {!isCancelled && isPast && attendance === "absent" && (
          <span className="tag bg-crayon-red text-white !py-0.5 !px-2 text-xs sm:text-sm font-bold shadow-xs">
            ✗ Assente
          </span>
        )}
        {!isCancelled && !isPast && (
          <span className="tag bg-paper-aged/80 text-ink-soft !py-0.5 !px-2 text-xs font-medium border border-dashed border-ink/30">
            ⏳ In arrivo
          </span>
        )}
      </div>
      {status === "confirmed" && (
        <span className="text-[11px] sm:text-xs uppercase tracking-wider text-ink-soft">
          {sent ? "⏰ promemoria inviato" : "⏰ promemoria in attesa"}
        </span>
      )}
      {status === "pending" && (
        <span className="text-[11px] sm:text-xs uppercase tracking-wider text-crayon-red font-bold">
          ⚠️ da confermare (WhatsApp)
        </span>
      )}
    </div>
  );
}

function Countdown({ to, now }: { to: Date; now: Date }) {
  const ms = to.getTime() - now.getTime();
  if (ms <= 0) return <span className="tag bg-crayon-red text-white">adesso!</span>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const d = Math.floor(h / 24);
  const label = d >= 1 ? `tra ${d} g ${h % 24} h` : h >= 1 ? `tra ${h} h ${m} min` : `tra ${m} min`;
  return <span className="tag bg-crayon-teal">{label}</span>;
}

function Doodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <g fill="none" strokeWidth="4" strokeLinecap="round" filter="url(#crayon-rough)">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cx="50" cy="28" rx="16" ry="9" stroke="#e8542f" transform={`rotate(${a} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="9" stroke="#f2b632" />
        <path d="M50 60 Q 44 80 52 98" stroke="#3c9a5f" />
      </g>
    </svg>
  );
}
