export const START_HOUR = 8;
export const END_HOUR = 18; // ultimo slot: 18:00-19:00
export const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export const DAY_NAMES_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
export const DAY_SHORT_IT = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];
export const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export const SERVICES = [
  { id: "Consulenza", label: "Consulenza", color: "#e8542f" },
  { id: "Taglio", label: "Taglio & Piega", color: "#4fb3bf" },
  { id: "Massaggio", label: "Massaggio", color: "#f2b632" },
  { id: "Visita", label: "Visita", color: "#7a5cff" },
  { id: "Lezione", label: "Lezione", color: "#3c9a5f" },
];

export type BookingDTO = {
  id: number;
  userId?: string | null;
  day: string; // YYYY-MM-DD
  hour: number;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  service: string;
  notes: string | null;
  status: string; // confirmed | cancelled | done
  attendanceStatus: string; // pending | present | absent
  reminderMinutes: number;
  reminderSent: boolean;
  createdAt: string;
};

export type StudentBadge = {
  id: string;
  title: string;
  desc: string;
  earnedAt: string;
  symbol?: "palette" | "star" | "feather" | "mask" | "medal" | "scroll" | "ribbon";
};

export type GamificationProfile = {
  danceXp: number; // punti esperienza artistica
  levelRank: number; // 1..5
  levelTitle: string; // titolo accademico
  currentStreak: number; // settimane consecutive di frequenza
  longestStreak: number;
  eventPunches: number; // 0..10 timbri Eventi Extra (gare, concorsi, scambi, trasferte)
  eventLogs?: Array<{ name: string; date: string }>;
  badges: StudentBadge[];
  lastAttendedWeek?: string; // tracciamento settimana per streak reale
};

export const DANCE_LEVELS = [
  { rank: 1, title: "Apprendista d'Atelier", minXp: 0, maxXp: 29 },
  { rank: 2, title: "Corpo di Ballo Didattico", minXp: 30, maxXp: 69 },
  { rank: 3, title: "Solista in Perfezionamento", minXp: 70, maxXp: 119 },
  { rank: 4, title: "Primo Ballerino di Sala", minXp: 120, maxXp: 179 },
  { rank: 5, title: "Étoile dell'Accademia", minXp: 180, maxXp: Infinity },
] as const;

export function calculateGamificationLevel(xp: number) {
  const safeXp = Math.max(0, xp || 0);
  let current: (typeof DANCE_LEVELS)[number] = DANCE_LEVELS[0];
  for (const lvl of DANCE_LEVELS) {
    if (safeXp >= lvl.minXp) {
      current = lvl;
    }
  }
  const next = DANCE_LEVELS.find((l) => l.rank === current.rank + 1) || null;
  const prevBase = current.minXp;
  const targetXp = next ? next.minXp : current.minXp + 60;
  const progressPercent = next
    ? Math.min(100, Math.max(10, Math.round(((safeXp - prevBase) / (targetXp - prevBase)) * 100)))
    : 100;

  return {
    rank: current.rank,
    title: current.title,
    currentXp: safeXp,
    nextLevelXp: targetXp,
    progressPercent,
  };
}

export type UserDTO = {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: "user" | "manager";
  status: string;
  membershipDate: string;
  notes: string | null;
  createdAt: string;
  gamification?: GamificationProfile;
};

export type NotificationDTO = {
  id: number;
  bookingId: number | null;
  userId?: string | null;
  clientEmail?: string | null;
  clientName?: string | null;
  kind: string;
  title: string;
  message: string;
  read: boolean;
  scheduledFor: string | null;
  createdAt: string;
};

/** Formatta una data locale come YYYY-MM-DD (senza problemi di timezone). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Lunedì della settimana che contiene `d`. */
export function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (date.getDay() + 6) % 7; // 0 = lunedì
  date.setDate(date.getDate() - dow);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function bookingDateTime(day: string, hour: number): Date {
  const d = parseISODate(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export function formatDayLong(day: string): string {
  const d = parseISODate(day);
  const dow = (d.getDay() + 6) % 7;
  return `${DAY_NAMES_IT[dow]} ${d.getDate()} ${MONTH_NAMES_IT[d.getMonth()]}`;
}

const COURSE_COLORS: Record<string, string> = {
  "Danza Classica Avanzata": "#e8542f",
  "Modern & Contemporary Jazz": "#4fb3bf",
  "Pilates & Posturale per Ballerini": "#52a357",
  "Hip Hop & Urban Choreo (Nuovo In Programma)": "#f2b632",
  "Hip Hop & Urban Dance Lab": "#7a5cff",
  "Propedeutica alla Danza Bambini (Nuovo In Programma)": "#a463f2",
  "Canto & Dizione per Performer": "#3c9a5f",
};

export function serviceColor(service: string): string {
  if (COURSE_COLORS[service]) return COURSE_COLORS[service];
  return SERVICES.find((s) => s.id === service)?.color ?? "#2f7bbf";
}

/** Genera il link per aprire direttamente Google Calendar con campi precompilati */
export function makeGoogleCalendarUrl({
  day,
  hour,
  clientName,
  service,
  notes,
  clientEmail,
}: {
  day: string;
  hour: number;
  clientName: string;
  service: string;
  notes?: string | null;
  clientEmail?: string | null;
}): string {
  const [y, m, d] = day.split("-").map(Number);
  const startDate = new Date(y, m - 1, d, hour, 0, 0);
  const endDate = new Date(y, m - 1, d, hour + 1, 0, 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  const toUtcCompact = (date: Date) => {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  };

  const dates = `${toUtcCompact(startDate)}/${toUtcCompact(endDate)}`;
  const text = encodeURIComponent(`${service} - ${clientName}`);
  const details = encodeURIComponent(
    `Appuntamento per ${service} con ${clientName}.${notes ? `\nNote: ${notes}` : ""}\nPresso: Naïve Studio`,
  );
  const location = encodeURIComponent("Naïve Studio");
  const ctz = encodeURIComponent(
    (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "Europe/Rome"
  );
  const add = clientEmail && clientEmail.includes("@") ? `&add=${encodeURIComponent(clientEmail.trim())}` : "";

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}&ctz=${ctz}${add}`;
}

/** Genera e avvia il download di un file .ics standard con allarmi multipli (1 giorno e 1 ora prima) */
export function downloadIcsFile({
  day,
  hour,
  clientName,
  service,
  notes,
  reminderMinutes = 60,
}: {
  day: string;
  hour: number;
  clientName: string;
  service: string;
  notes?: string | null;
  reminderMinutes?: number;
}) {
  const [y, m, d] = day.split("-").map(Number);
  const startDate = new Date(y, m - 1, d, hour, 0, 0);
  const endDate = new Date(y, m - 1, d, hour + 1, 0, 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  const toUtcCompact = (date: Date) => {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  };

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Naive Agenda//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${day}-${hour}-${Date.now()}@naiveagenda`,
    `DTSTAMP:${toUtcCompact(new Date())}`,
    `DTSTART:${toUtcCompact(startDate)}`,
    `DTEND:${toUtcCompact(endDate)}`,
    `SUMMARY:${service} - ${clientName}`,
    `DESCRIPTION:${service} con ${clientName}${notes ? ` - Note: ${notes}` : ""}`,
    "LOCATION:Naïve Studio",
    "STATUS:CONFIRMED",
    // Allarme configurato (es. 1 ora prima)
    "BEGIN:VALARM",
    `TRIGGER:-PT${reminderMinutes}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:Promemoria: ${service} con ${clientName}`,
    "END:VALARM",
    // Allarme aggiuntivo: 1 giorno prima (se il promemoria principale non era già a 1 giorno)
    reminderMinutes !== 1440
      ? [
          "BEGIN:VALARM",
          "TRIGGER:-P1D",
          "ACTION:DISPLAY",
          `DESCRIPTION:Domani hai ${service} alle ${formatHour(hour)}`,
          "END:VALARM",
        ].join("\r\n")
      : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const blob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appuntamento-${day}-${hour}h.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Genera il link WhatsApp wa.me precompilato con nome, servizio, giorno e orario */
export function makeWhatsAppUrl({
  phone,
  clientName,
  day,
  hour,
  service,
  mode = "reminder",
}: {
  phone?: string | null;
  clientName: string;
  day: string;
  hour: number;
  service: string;
  mode?: "reminder" | "confirm";
}): string {
  let clean = (phone ?? "").replace(/[^\d+]/g, "");
  if (clean.startsWith("00")) {
    clean = clean.replace(/^00/, "");
  } else if (clean.startsWith("+")) {
    clean = clean.replace(/^\+/, "");
  } else if (clean.length >= 9 && !clean.startsWith("39")) {
    clean = `39${clean}`;
  }

  const dayStr = formatDayLong(day);
  const hourStr = formatHour(hour);

  const text =
    mode === "confirm"
      ? `Ciao ${clientName}! Ti confermiamo il tuo appuntamento per *${service}* fissato per *${dayStr}* alle ore *${hourStr}*. A presto! Naïve Studio`
      : `Ciao ${clientName}! Ti ricordiamo il tuo appuntamento per *${service}* fissato per *${dayStr}* alle ore *${hourStr}*. A presto! Naïve Studio`;

  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

