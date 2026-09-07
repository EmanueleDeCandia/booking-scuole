"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DAY_NAMES_IT,
  DAY_SHORT_IT,
  HOURS,
  MONTH_NAMES_IT,
  formatDayLong,
  formatHour,
  serviceColor,
  type BookingDTO,
} from "@/lib/agenda";

type Props = {
  bookings: BookingDTO[];
  onSelectSlot: (day: string, hour: number, booking: BookingDTO | null) => void;
};

// Altezza di ciascuna etichetta del rullo in pixel
const ITEM_HEIGHT = 42;
// Angolo di curvatura per ogni elemento (in gradi)
const DEG_STEP = 24;
// Raggio del cilindro 3D
const RADIUS = 100;

interface RollerProps {
  label: string;
  items: { id: string | number; label: string; sub?: string }[];
  selectedIndex: number;
  onChange: (index: number) => void;
  colorTone?: string;
}

function Roller({ label, items, selectedIndex, onChange, colorTone = "var(--crayon-teal)" }: RollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const currentRotation = useRef(selectedIndex * -DEG_STEP);
  const [rotation, setRotation] = useState(selectedIndex * -DEG_STEP);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Sincronizza quando selectedIndex cambia esternamente
  useEffect(() => {
    currentRotation.current = selectedIndex * -DEG_STEP;
    setRotation(selectedIndex * -DEG_STEP);
  }, [selectedIndex]);

  const snapToIndex = useCallback(
    (targetIndex: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, targetIndex));
      setIsTransitioning(true);
      const newRot = clamped * -DEG_STEP;
      currentRotation.current = newRot;
      setRotation(newRot);
      onChange(clamped);
      setTimeout(() => setIsTransitioning(false), 200);
    },
    [items.length, onChange],
  );

  // Gestione trascinamento Touch / Mouse
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    setIsTransitioning(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.clientY - startY.current;
    startY.current = e.clientY;
    const rotDelta = (deltaY / ITEM_HEIGHT) * DEG_STEP;
    currentRotation.current += rotDelta;
    setRotation(currentRotation.current);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const nearestIndex = Math.round(-currentRotation.current / DEG_STEP);
    snapToIndex(nearestIndex);
  };

  // Supporto rotellina del mouse
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      snapToIndex(selectedIndex + 1);
    } else if (e.deltaY < 0) {
      snapToIndex(selectedIndex - 1);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center select-none">
      {/* Etichetta rullo */}
      <div className="font-display mb-1 text-[11px] uppercase tracking-wider text-ink-soft">
        {label}
      </div>

      {/* Pulsante freccia su per facilitare l'uso a scatto */}
      <button
        type="button"
        onClick={() => snapToIndex(selectedIndex - 1)}
        disabled={selectedIndex <= 0}
        className="text-ink/60 hover:text-ink disabled:opacity-20 py-0.5 text-xs transition-transform active:scale-90"
        title={`Precedente ${label}`}
      >
        ▲
      </button>

      {/* Tamburo / Cuscinetto 3D */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="sketch-sm relative h-[170px] w-full cursor-grab active:cursor-grabbing overflow-hidden bg-[#fffdf7] shadow-inner"
        style={{
          perspective: "800px",
          boxShadow: "inset 0 4px 10px rgba(0,0,0,0.15), inset 0 -4px 10px rgba(0,0,0,0.15)",
        }}
      >
        {/* Ombreggiature superiore e inferiore per creare profondità cilindrica */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14 bg-gradient-to-b from-[#e8decb]/90 via-[#e8decb]/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-14 bg-gradient-to-t from-[#e8decb]/90 via-[#e8decb]/40 to-transparent" />

        {/* Finestrella centrale di selezione (il "lettore" dello scatto) */}
        <div
          className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-[44px] -translate-y-1/2 rounded-md border-2 border-ink bg-white/40 shadow-sm backdrop-blur-[1px]"
          style={{ borderColor: colorTone }}
        />

        {/* Cilindro rotante in 3D */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotation}deg)`,
            transition: isTransitioning ? "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2)" : "none",
          }}
        >
          {items.map((item, index) => {
            const itemAngle = index * DEG_STEP;
            const diff = Math.abs(index - selectedIndex);
            const isVisible = diff <= 4;
            if (!isVisible) return null;

            const isSelected = index === selectedIndex;

            return (
              <div
                key={item.id}
                className="absolute flex h-[42px] w-full items-center justify-center px-1 text-center"
                style={{
                  transform: `rotateX(${itemAngle}deg) translateZ(${RADIUS}px)`,
                  backfaceVisibility: "hidden",
                }}
              >
                <div
                  className={`leading-none transition-all duration-150 ${
                    isSelected
                      ? "font-display text-ink scale-105"
                      : "font-hand text-ink/50 scale-95"
                  }`}
                >
                  <div className={isSelected ? "text-base font-bold" : "text-lg"}>
                    {item.label}
                  </div>
                  {item.sub && (
                    <div className="text-[10px] uppercase tracking-wider text-ink-soft">
                      {item.sub}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pulsante freccia giù */}
      <button
        type="button"
        onClick={() => snapToIndex(selectedIndex + 1)}
        disabled={selectedIndex >= items.length - 1}
        className="text-ink/60 hover:text-ink disabled:opacity-20 py-0.5 text-xs transition-transform active:scale-90"
        title={`Successivo ${label}`}
      >
        ▼
      </button>
    </div>
  );
}

export function MobileRollerPicker({ bookings, onSelectSlot }: Props) {
  const now = useMemo(() => new Date(), []);

  // Genera i prossimi 12 mesi a partire da oggi
  const months = useMemo(() => {
    const list: { id: string; label: string; year: number; month: number }[] = [];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    for (let i = 0; i < 12; i++) {
      const d = new Date(currentYear, currentMonth + i, 1);
      const mIdx = d.getMonth();
      const y = d.getFullYear();
      list.push({
        id: `${y}-${mIdx}`,
        label: `${MONTH_NAMES_IT[mIdx].slice(0, 3)} ${y}`,
        year: y,
        month: mIdx,
      });
    }
    return list;
  }, [now]);

  const [monthIdx, setMonthIdx] = useState(0);

  // Calcola i giorni validi per il mese attualmente selezionato
  const daysInMonth = useMemo(() => {
    const sel = months[monthIdx] ?? months[0];
    const daysCount = new Date(sel.year, sel.month + 1, 0).getDate();
    const list: { id: string; label: string; sub: string; dateStr: string; dayNum: number }[] = [];

    for (let day = 1; day <= daysCount; day++) {
      const d = new Date(sel.year, sel.month, day);
      const dow = (d.getDay() + 6) % 7; // 0 = Lunedì
      const dateStr = `${sel.year}-${String(sel.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      list.push({
        id: dateStr,
        label: `${day} ${DAY_SHORT_IT[dow]}`,
        sub: DAY_NAMES_IT[dow],
        dateStr,
        dayNum: day,
      });
    }
    return list;
  }, [months, monthIdx]);

  // Seleziona di default il giorno odierno
  const initialDayIndex = useMemo(() => {
    const todayNum = now.getDate();
    const idx = daysInMonth.findIndex((d) => d.dayNum === todayNum);
    return idx >= 0 ? idx : 0;
  }, [daysInMonth, now]);

  const [dayIdx, setDayIdx] = useState(initialDayIndex);

  // Aggiorna giorno se cambia mese
  useEffect(() => {
    if (dayIdx >= daysInMonth.length) {
      setDayIdx(daysInMonth.length - 1);
    }
  }, [daysInMonth, dayIdx]);

  // Ore disponibili
  const hoursList = useMemo(() => {
    return HOURS.map((h) => ({
      id: h,
      label: formatHour(h),
      sub: `${formatHour(h + 1)}`,
      hour: h,
    }));
  }, []);

  const [hourIdx, setHourIdx] = useState(() => {
    const currentHour = now.getHours();
    const idx = hoursList.findIndex((h) => h.hour >= currentHour + 1);
    return idx >= 0 ? idx : 1; // es. 09:00 default
  });

  // Giorno e ora correnti selezionati
  const selectedDayObj = daysInMonth[dayIdx] ?? daysInMonth[0];
  const selectedHourObj = hoursList[hourIdx] ?? hoursList[0];

  const selectedDay = selectedDayObj?.dateStr ?? "";
  const selectedHour = selectedHourObj?.hour ?? 9;

  // Cerca se esiste una prenotazione attiva in questo slot
  const bookingMatch = useMemo(() => {
    if (!selectedDay) return null;
    return (
      bookings.find(
        (b) => b.day === selectedDay && b.hour === selectedHour && b.status !== "cancelled",
      ) ?? null
    );
  }, [bookings, selectedDay, selectedHour]);

  // Verifica se lo slot è nel passato
  const isPast = useMemo(() => {
    if (!selectedDay) return false;
    const [y, m, d] = selectedDay.split("-").map(Number);
    const slotEnd = new Date(y, m - 1, d, selectedHour + 1, 0, 0);
    return slotEnd < now;
  }, [selectedDay, selectedHour, now]);

  const handleBookingClick = () => {
    onSelectSlot(selectedDay, selectedHour, bookingMatch);
  };

  return (
    <div className="sketch relative w-full overflow-hidden bg-[#fdf8f0] p-4 sm:p-6 shadow-md">
      {/* Testata del selettore */}
      <div className="flex items-center justify-between border-b-2 border-dashed border-ink/20 pb-3">
        <div>
          <div className="font-display text-lg uppercase tracking-tight">
            Selettore a Cuscinetto <span className="crayon-hl" style={{ ["--hl" as string]: "var(--crayon-yellow)" }}>3D</span>
          </div>
          <p className="font-hand text-base text-ink-soft">
            Trascina i rulli o tocca le frecce con il dito per girare il cuscinetto ⚙️
          </p>
        </div>
        <span className="font-hand hidden sm:inline-block rotate-3 rounded-full border-2 border-ink bg-crayon-yellow px-3 py-1 text-sm">
          Tocco rapido
        </span>
      </div>

      {/* Meccanismo dei 3 rulli 3D affiancati */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
        {/* Rullo 1: Mese */}
        <Roller
          label="Mese"
          items={months}
          selectedIndex={monthIdx}
          onChange={setMonthIdx}
          colorTone="var(--crayon-red)"
        />

        {/* Rullo 2: Giorno */}
        <Roller
          label="Giorno"
          items={daysInMonth}
          selectedIndex={dayIdx}
          onChange={setDayIdx}
          colorTone="var(--crayon-teal)"
        />

        {/* Rullo 3: Ora */}
        <Roller
          label="Orario"
          items={hoursList}
          selectedIndex={hourIdx}
          onChange={setHourIdx}
          colorTone="var(--crayon-yellow)"
        />
      </div>

      {/* Cartellino di Stato dello Slot Selezionato */}
      <div className="mt-5 rounded-xl border-2 border-ink bg-white p-4 shadow-[4px_4px_0_0_#141210] transition-all">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-xs uppercase tracking-wider text-ink-soft">
              Orario Selezionato
            </div>
            <div className="font-hand text-2xl text-ink leading-tight">
              {formatDayLong(selectedDay)} · ore {formatHour(selectedHour)}
            </div>

            {/* Dettagli disponibilità */}
            <div className="mt-1 flex items-center gap-2">
              {bookingMatch ? (
                <span
                  className="tag text-xs font-bold text-white shadow-xs"
                  style={{ background: serviceColor(bookingMatch.service) }}
                >
                  🔴 Occupato · {bookingMatch.clientName} ({bookingMatch.service})
                </span>
              ) : isPast ? (
                <span className="tag bg-gray-200 text-gray-600 text-xs font-medium">
                  ⚪ Orario passato
                </span>
              ) : (
                <span className="tag bg-crayon-teal text-white text-xs font-bold shadow-xs">
                  🟢 Libero · Pronto per la prenotazione
                </span>
              )}
            </div>
          </div>

          {/* Azione di prenotazione o modifica */}
          <div>
            {bookingMatch ? (
              <button
                type="button"
                onClick={handleBookingClick}
                className="btn btn-yellow w-full sm:w-auto text-sm"
              >
                ✎ Modifica o Gestisci
              </button>
            ) : isPast ? (
              <button
                type="button"
                disabled
                className="btn cursor-not-allowed opacity-50 w-full sm:w-auto text-sm"
              >
                Non Prenotabile
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBookingClick}
                className="btn btn-red w-full sm:w-auto text-sm animate-pulse hover:animate-none"
              >
                Prenota questo Slot ✎
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
