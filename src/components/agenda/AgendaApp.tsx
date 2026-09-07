"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MONTH_NAMES_IT,
  addDays,
  formatDayLong,
  formatHour,
  isoWeekNumber,
  serviceColor,
  startOfWeek,
  toISODate,
  weekDays,
  type BookingDTO,
} from "@/lib/agenda";
import { BookingModal, type SlotTarget } from "../BookingModal";
import { useToast } from "../Toasts";
import { useAuth } from "../auth/AuthContext";
import type { FlipRequest, HoverInfo } from "./Agenda3D";
import { MobileRollerPicker } from "./MobileRollerPicker";

const Agenda3D = dynamic(() => import("./Agenda3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center">
      <div className="font-hand sketch-sm rotate-[-2deg] bg-crayon-yellow px-6 py-3 text-2xl">apro l&apos;agenda…</div>
    </div>
  ),
});

export function AgendaApp({ initialBookings }: { initialBookings: BookingDTO[] }) {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const toast = useToast();
  const [bookings, setBookings] = useState<BookingDTO[]>(initialBookings);
  const [version, setVersion] = useState(0);
  const [monday, setMonday] = useState<Date>(() => startOfWeek(new Date()));
  const [flipReq, setFlipReq] = useState<FlipRequest>(null);
  const flipCount = useRef(0);
  const [flipping, setFlipping] = useState(false);
  const [hover, setHover] = useState<HoverInfo>(null);
  const [target, setTarget] = useState<SlotTarget | null>(null);
  const [viewMode, setViewMode] = useState<"agenda3d" | "roller">("agenda3d");
  const today = toISODate(new Date());

  // Rileva schermi smartphone e attiva il selettore a cuscinetto
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("roller");
    }
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, BookingDTO[]>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const arr = m.get(b.day) ?? [];
      arr.push(b);
      m.set(b.day, arr);
    }
    return m;
  }, [bookings]);

  const getWeekBookings = useCallback(
    (m: Date) => weekDays(m).flatMap((d) => byDay.get(toISODate(d)) ?? []),
    [byDay],
  );

  const reload = useCallback(async () => {
    const res = await fetch("/api/bookings?all=1", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setBookings(data.items);
    }
    window.dispatchEvent(new Event("bookings:changed"));
  }, []);

  useEffect(() => {
    setVersion((v) => v + 1);
  }, [bookings]);

  const requestFlip = useCallback(
    (dir: 1 | -1) => {
      if (flipping) return;
      flipCount.current += 1;
      setFlipping(true);
      setFlipReq({ target: addDays(monday, dir * 7), dir, n: flipCount.current });
    },
    [flipping, monday],
  );

  const goToday = () => {
    if (flipping) return;
    const t = startOfWeek(new Date());
    if (toISODate(t) === toISODate(monday)) return;
    flipCount.current += 1;
    setFlipping(true);
    setFlipReq({ target: t, dir: t > monday ? 1 : -1, n: flipCount.current });
  };

  const onFlipDone = useCallback((m: Date) => {
    setMonday(m);
    setFlipping(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (target) return;
      if (e.key === "ArrowRight") requestFlip(1);
      if (e.key === "ArrowLeft") requestFlip(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestFlip, target]);

  const onSlot = useCallback(
    (day: string, hour: number, booking: BookingDTO | null) => {
      const slotEnd = new Date(day + "T00:00:00");
      slotEnd.setHours(hour + 1);
      if (!booking && slotEnd < new Date()) {
        toast.push({ title: "Slot passato", message: "Non puoi prenotare nel passato ✎", tone: "ink" });
        return;
      }
      setTarget({ day, hour, booking });
    },
    [toast],
  );

  const days = weekDays(monday);
  const weekBookings = getWeekBookings(monday);
  const freeSlots = 7 * 11 - weekBookings.length;

  return (
    <div className="mx-auto w-full max-w-[96vw] 2xl:max-w-[1750px] px-4 pb-12 sm:px-8">
      {/* intestazione */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(2.5rem,5.5vw,5rem)] leading-[0.95]">
            Agenda <span className="crayon-hl" style={{ ["--hl" as string]: "var(--crayon-teal)" }}>3D</span>
          </h1>
          <p className="font-hand mt-2 text-2xl sm:text-3xl text-ink-soft">
            {viewMode === "agenda3d"
              ? "Sfoglia con la penna, tocca uno slot libero e prenota. ← → per cambiare settimana."
              : "Fai girare i rulli del cuscinetto 3D con il dito per selezionare data e ora del tuo appuntamento ⚙️"}
          </p>
        </div>
        {viewMode === "agenda3d" && (
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => requestFlip(-1)} disabled={flipping}>
              ← Prec.
            </button>
            <button className="btn btn-yellow" onClick={goToday} disabled={flipping}>
              Oggi
            </button>
            <button className="btn" onClick={() => requestFlip(1)} disabled={flipping}>
              Succ. →
            </button>
          </div>
        )}
      </div>

      {/* selettore vista + etichette */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* Selettore modalità: Diario da Tavolo 3D vs Cuscinetto Mobile 3D */}
        <div className="inline-flex rounded-xl border-2 border-ink bg-white/90 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode("agenda3d")}
            className={`tag !py-1 !px-3 text-xs font-bold transition-transform ${
              viewMode === "agenda3d" ? "bg-ink text-white" : "bg-transparent text-ink hover:rotate-1"
            }`}
          >
            📖 Diario da Tavolo 3D
          </button>
          <button
            type="button"
            onClick={() => setViewMode("roller")}
            className={`tag !py-1 !px-3 text-xs font-bold transition-transform ${
              viewMode === "roller" ? "bg-crayon-teal text-white" : "bg-transparent text-ink hover:-rotate-1"
            }`}
          >
            ⚙️ Cuscinetto Mobile 3D
          </button>
        </div>

        {viewMode === "agenda3d" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag sticker bg-crayon-red text-white">Settimana {isoWeekNumber(monday)}</span>
            <span className="tag sticker-r bg-white">
              {days[0].getDate()} {MONTH_NAMES_IT[days[0].getMonth()].slice(0, 3)} – {days[6].getDate()}{" "}
              {MONTH_NAMES_IT[days[6].getMonth()]} {days[6].getFullYear()}
            </span>
            <span className="tag bg-crayon-yellow">{weekBookings.length} appuntamenti</span>
            <span className="tag bg-crayon-teal">{freeSlots} slot liberi</span>
          </div>
        )}
      </div>

      {/* Scena Principale: Cuscinetto Mobile oppure Scena 3D da tavolo */}
      {viewMode === "roller" ? (
        <div className="mt-5">
          <MobileRollerPicker bookings={bookings} onSelectSlot={onSlot} />
        </div>
      ) : (
        <div className="sketch relative mt-5 h-[62vh] min-h-[460px] overflow-hidden bg-[#ebe1d5]">
          <Agenda3D
            monday={monday}
            getWeekBookings={getWeekBookings}
            version={version}
            today={today}
            flipRequest={flipReq}
            onFlipDone={onFlipDone}
            onSlot={onSlot}
            onHover={setHover}
            onFlipRequest={requestFlip}
          />

          {/* tooltip penna */}
          <div className="pointer-events-none absolute top-4 left-4">
            {hover ? (
              <div
                className={`sketch-sm wobble-in px-4 py-2 ${hover.booking ? "bg-crayon-red text-white" : "bg-crayon-teal"}`}
                style={{ transform: "rotate(-1.5deg)" }}
              >
                <div className="font-display text-[11px] uppercase tracking-wider">
                  {hover.booking ? "Occupato" : "Libero"}
                </div>
                <div className="font-hand text-2xl leading-none">
                  {formatDayLong(hover.day)} · {formatHour(hover.hour)}
                </div>
                {hover.booking && (
                  <div className="font-hand mt-1 text-lg leading-none">
                    {hover.booking.clientName} — {hover.booking.service}
                  </div>
                )}
              </div>
            ) : (
              <div className="sketch-sm bg-white/90 px-4 py-2" style={{ transform: "rotate(-1.5deg)" }}>
                <div className="font-hand text-xl leading-none">✎ passa la penna sull&apos;agenda</div>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute right-4 bottom-4 hidden sm:block">
            <div className="font-hand sketch-sm rotate-2 bg-white/90 px-3 py-1 text-base">
              trascina per ruotare · rotella per zoom
            </div>
          </div>
        </div>
      )}

      {/* legenda + prossimi */}
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <div className="sketch p-5 md:col-span-2">
          <div className="font-display scribble-under inline-block text-lg uppercase">Questa settimana</div>
          {weekBookings.length === 0 ? (
            <p className="font-hand mt-3 text-2xl text-ink-soft">Nessun appuntamento: la pagina è tutta tua ✎</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {weekBookings
                .slice()
                .sort((a, b) => (a.day + a.hour).localeCompare(b.day + b.hour) || a.hour - b.hour)
                .map((b) => {
                  const isOwner = Boolean(
                    user && (
                      (b.userId && b.userId === user.id) ||
                      (b.clientEmail && user.email && b.clientEmail.toLowerCase() === user.email.toLowerCase())
                    )
                  );
                  const displayClient = isManager || isOwner ? b.clientName : "Slot Riservato";

                  return (
                    <li key={b.id}>
                      <button
                        onClick={() => setTarget({ day: b.day, hour: b.hour, booking: b })}
                        className="sketch-sm flex w-full items-center gap-3 bg-white px-3 py-2 text-left transition-transform hover:-rotate-1"
                      >
                        <span
                          className="h-8 w-2 shrink-0 rounded-full border-2 border-ink"
                          style={{ background: b.status === "done" ? "#8a8580" : serviceColor(b.service) }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-hand block truncate text-xl leading-none flex items-center gap-2">
                            <span>{displayClient}</span>
                            {isOwner && (
                              <span className="tag bg-crayon-teal text-white text-[9px] !py-0 !px-1 font-bold">
                                Il tuo corso
                              </span>
                            )}
                          </span>
                          <span className="block text-xs uppercase tracking-wider text-ink-soft">
                            {formatDayLong(b.day)} · {formatHour(b.hour)} · {b.service}
                          </span>
                        </span>
                        {isManager && b.status === "done" && <span className="tag bg-crayon-green text-white">fatto</span>}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
        <div className="sketch bg-crayon-yellow p-5">
          <div className="font-display text-lg uppercase">Come funziona</div>
          <ol className="font-hand mt-2 space-y-1 text-xl leading-tight">
            <li>1. Muovi la penna sopra la griglia oraria.</li>
            <li>2. Clicca uno slot libero → compili il post-it.</li>
            <li>3. Il promemoria arriva prima dell&apos;appuntamento.</li>
            <li>4. Clicca l&apos;angolo &quot;sfoglia&quot; per cambiare pagina.</li>
          </ol>
        </div>
      </div>

      {target && (
        <BookingModal
          target={target}
          onClose={() => setTarget(null)}
          onCreated={(b) => {
            setTarget(null);
            toast.push({ title: "Prenotato!", message: `${b.clientName} · ${formatDayLong(b.day)} ${formatHour(b.hour)}`, tone: "teal" });
            reload();
          }}
          onUpdated={(b) => {
            const isMoved = b.day !== target.day || b.hour !== target.hour;
            setTarget(null);
            toast.push({
              title: b.status === "cancelled" ? "Annullato" : b.status === "done" ? "Completato" : isMoved ? "Spostato!" : "Aggiornato",
              message: `${b.clientName} · ${formatDayLong(b.day)} ${formatHour(b.hour)}`,
              tone: b.status === "cancelled" ? "ink" : isMoved ? "teal" : "yellow",
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
