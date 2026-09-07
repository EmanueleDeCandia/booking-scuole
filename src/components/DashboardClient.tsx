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
    const res = await fetch(`/api/bookings/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.push({ title: status === "done" ? "Completato" : status === "cancelled" ? "Annullato" : "Ripristinato", message: b.clientName, tone: "yellow" });
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
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95]">
            Dash<span className="crayon-hl" style={{ ["--hl" as string]: "var(--crayon-red)" }}>board</span>
          </h1>
          <p className="font-hand mt-2 text-2xl text-ink-soft">Gestisci gli appuntamenti scritti sull&apos;agenda.</p>
        </div>
        <Link href="/" className="btn btn-red">
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
      <div className="sketch mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`tag transition-transform hover:-rotate-1 ${filter === f.id ? "bg-ink text-white" : "bg-white"}`}
              >
                {f.label} <span className="font-display text-xs">{f.n}</span>
              </button>
            ))}
          </div>
          <input className="naive max-w-xs" placeholder="cerca cliente, servizio, note…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-2">
            <thead>
              <tr className="font-display text-left text-[11px] uppercase tracking-wider text-ink-soft">
                <th className="px-3">Quando</th>
                <th className="px-3">Cliente</th>
                <th className="px-3">Servizio</th>
                <th className="px-3">Contatti</th>
                <th className="px-3">Stato</th>
                <th className="px-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="font-hand px-3 py-8 text-center text-2xl text-ink-soft">
                    Niente da mostrare qui ✎
                  </td>
                </tr>
              )}
              {list.map((b, i) => (
                <tr key={b.id} className="bg-white" style={{ transform: `rotate(${i % 2 ? 0.15 : -0.15}deg)` }}>
                  <td className="rounded-l-xl border-y-2 border-l-2 border-ink px-3 py-2">
                    <div className="font-hand text-xl leading-none">{formatDayLong(b.day)}</div>
                    <div className="text-xs uppercase tracking-wider text-ink-soft">ore {formatHour(b.hour)}</div>
                  </td>
                  <td className="border-y-2 border-ink px-3 py-2">
                    <div className="font-hand text-xl leading-none">{b.clientName}</div>
                    {b.notes && <div className="text-xs text-ink-soft">{b.notes}</div>}
                  </td>
                  <td className="border-y-2 border-ink px-3 py-2">
                    <span className="tag" style={{ background: serviceColor(b.service), color: "#fff" }}>
                      {b.service}
                    </span>
                  </td>
                  <td className="border-y-2 border-ink px-3 py-2 text-sm">
                    <div>{b.clientEmail ?? "—"}</div>
                    <div className="flex items-center gap-1.5 text-ink-soft">
                      <span>{b.clientPhone || "—"}</span>
                      {b.clientPhone && (
                        <a
                          href={makeWhatsAppUrl({
                            phone: b.clientPhone,
                            clientName: b.clientName,
                            day: b.day,
                            hour: b.hour,
                            service: b.service,
                            mode: "reminder",
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tag !bg-crayon-green !text-white !py-0 !px-1.5 text-[11px] font-bold hover:scale-105"
                          title="Invia promemoria WhatsApp al cliente (testo precompilato)"
                        >
                          💬 WA
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="border-y-2 border-ink px-3 py-2">
                    <StatusPill status={b.status} sent={b.reminderSent} attendance={b.attendanceStatus} />
                  </td>
                  <td className="rounded-r-xl border-y-2 border-r-2 border-ink px-3 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {/* Validazione Presenze / Assenze da parte del gestore */}
                      {b.status !== "cancelled" && (
                        <div className="flex items-center gap-1 border-r border-ink/20 pr-1.5">
                          <button
                            className={`btn !px-2 !py-0.5 text-[11px] font-bold transition-all ${
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
                            className={`btn !px-2 !py-0.5 text-[11px] font-bold transition-all ${
                              b.attendanceStatus === "absent"
                                ? "bg-crayon-red text-white shadow-xs"
                                : "text-crayon-red hover:bg-crayon-red/20"
                            }`}
                            title="Segna assenza dell'allievo"
                            onClick={() => markAttendance(b, "absent")}
                          >
                            ✗ Assente
                          </button>
                        </div>
                      )}

                      {b.status === "confirmed" && (
                        <button className="btn !px-2 !py-1" title="Completa" onClick={() => quick(b, "done")}>
                          ✓
                        </button>
                      )}
                      {b.status !== "cancelled" ? (
                        <button className="btn !px-2 !py-1" title="Annulla" onClick={() => quick(b, "cancelled")}>
                          ✕
                        </button>
                      ) : (
                        <button className="btn !px-2 !py-1" title="Ripristina" onClick={() => quick(b, "confirmed")}>
                          ↺
                        </button>
                      )}
                      <button className="btn !px-2 !py-1" title="Modifica" onClick={() => setTarget({ day: b.day, hour: b.hour, booking: b })}>
                        ✎
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {target && (
        <BookingModal
          target={target}
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
    <div className={`sketch p-4 ${bg}`} style={{ transform: `rotate(${rot})` }}>
      <div className="font-display text-[11px] uppercase tracking-wider">{label}</div>
      <div className="font-display mt-1 text-5xl leading-none">{value}</div>
    </div>
  );
}

function StatusPill({ status, sent, attendance }: { status: string; sent: boolean; attendance?: string }) {
  const map: Record<string, { l: string; c: string }> = {
    confirmed: { l: "confermato", c: "bg-crayon-teal" },
    done: { l: "fatto", c: "bg-crayon-green text-white" },
    cancelled: { l: "annullato", c: "bg-ink text-white" },
  };
  const s = map[status] ?? { l: status, c: "bg-white" };
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <span className={`tag ${s.c}`}>{s.l}</span>
        {attendance === "present" && (
          <span className="tag bg-crayon-green text-white !py-0 !px-1.5 text-[10px] font-bold">
            ✓ Presente
          </span>
        )}
        {attendance === "absent" && (
          <span className="tag bg-crayon-red text-white !py-0 !px-1.5 text-[10px] font-bold">
            ✗ Assente
          </span>
        )}
      </div>
      {status === "confirmed" && (
        <span className="text-[10px] uppercase tracking-wider text-ink-soft">
          {sent ? "⏰ promemoria inviato" : "⏰ promemoria in attesa"}
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
