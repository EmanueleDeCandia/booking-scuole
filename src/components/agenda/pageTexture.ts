import {
  DAY_SHORT_IT,
  HOURS,
  MONTH_NAMES_IT,
  SERVICES,
  formatHour,
  isoWeekNumber,
  serviceColor,
  toISODate,
  weekDays,
  type BookingDTO,
} from "@/lib/agenda";

export const CW = 1024;
export const CH = 1416;

export type PageSide = "left" | "right";

const DISPLAY = '"Archivo Black", Impact, "Arial Black", sans-serif';
const HAND = '"Caveat", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
const BODY = '"Space Grotesk", "Helvetica Neue", Arial, sans-serif';

type Layout = {
  hourX: number;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  cols: number;
  dayOffset: number; // indice del primo giorno (0=lun) su questa pagina
  rowH: number;
  colW: number;
};

export function getLayout(side: PageSide): Layout {
  const gridY = 250;
  const gridH = 1050;
  const rowH = gridH / HOURS.length;
  if (side === "left") {
    const gridX = 130;
    const gridW = 984 - gridX;
    return { hourX: 40, gridX, gridY, gridW, gridH, cols: 3, dayOffset: 0, rowH, colW: gridW / 3 };
  }
  const gridX = 112;
  const gridW = 984 - gridX;
  return { hourX: 40, gridX, gridY, gridW, gridH, cols: 4, dayOffset: 3, rowH, colW: gridW / 4 };
}

export type Hit =
  | { type: "slot"; dayIdx: number; hour: number }
  | { type: "flip"; dir: 1 | -1 }
  | null;

/** u,v in [0,1] (uv three.js: v=1 in alto) */
export function hitTest(side: PageSide, u: number, v: number): Hit {
  const x = u * CW;
  const y = (1 - v) * CH;
  // angolo piegato -> sfoglia
  if (side === "right" && x > CW - 130 && y > CH - 130) return { type: "flip", dir: 1 };
  if (side === "left" && x < 130 && y > CH - 130) return { type: "flip", dir: -1 };

  const L = getLayout(side);
  if (x < L.gridX || x > L.gridX + L.gridW || y < L.gridY || y > L.gridY + L.gridH) return null;
  const col = Math.min(L.cols - 1, Math.floor((x - L.gridX) / L.colW));
  const row = Math.min(HOURS.length - 1, Math.floor((y - L.gridY) / L.rowH));
  return { type: "slot", dayIdx: L.dayOffset + col, hour: HOURS[row] };
}

export function cellRect(side: PageSide, dayIdx: number, hour: number) {
  const L = getLayout(side);
  const col = dayIdx - L.dayOffset;
  const row = hour - HOURS[0];
  return { x: L.gridX + col * L.colW, y: L.gridY + row * L.rowH, w: L.colW, h: L.rowH };
}

/* ---------- utilità di disegno ---------- */

function rand(seed: number) {
  // piccolo PRNG deterministico
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function jitterLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, amp: number, r: () => number) {
  const steps = 6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t + (r() - 0.5) * amp;
    const y = y1 + (y2 - y1) * t + (r() - 0.5) * amp;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function crayonFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed: number) {
  const r = rand(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, y + 3, w - 6, h - 6);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  const spacing = 9;
  for (let d = -h; d < w + h; d += spacing) {
    ctx.globalAlpha = 0.28 + r() * 0.25;
    ctx.lineWidth = 5 + r() * 4;
    jitterLine(ctx, x + d, y + h, x + d + h, y, 3, r);
  }
  ctx.restore();
  // contorno a mano libera
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  jitterLine(ctx, x + 4, y + 4, x + w - 4, y + 5, 3, r);
  jitterLine(ctx, x + w - 4, y + 5, x + w - 5, y + h - 4, 3, r);
  jitterLine(ctx, x + w - 5, y + h - 4, x + 4, y + h - 5, 3, r);
  jitterLine(ctx, x + 4, y + h - 5, x + 3, y + 4, 3, r);
  ctx.restore();
}

function crayonCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, rad: number, color: string, seed: number) {
  const r = rand(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2.15;
    const rr = rad + (r() - 0.5) * 6;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.85;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function doodleFlower(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, petal: string, center: string, seed: number) {
  const r = rand(seed);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = petal;
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * Math.PI * 2 + r() * 0.3;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * s * 0.9, cy + Math.sin(a) * s * 0.9, s * 0.55, s * 0.32, a, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = center;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#3c9a5f";
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.6);
  ctx.quadraticCurveTo(cx - s * 0.3, cy + s * 1.6, cx + s * 0.1, cy + s * 2.4);
  ctx.stroke();
  ctx.restore();
}

function paperBackground(ctx: CanvasRenderingContext2D, seed: number) {
  ctx.fillStyle = "#f8f4ec";
  ctx.fillRect(0, 0, CW, CH);
  const r = rand(seed);
  ctx.fillStyle = "rgba(90,70,50,0.05)";
  for (let i = 0; i < 2600; i++) {
    ctx.fillRect(r() * CW, r() * CH, 1 + r() * 2, 1 + r() * 2);
  }
  // leggera sfumatura verso il dorso
  const g = ctx.createLinearGradient(0, 0, CW, 0);
  g.addColorStop(0, "rgba(0,0,0,0.0)");
  g.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
}

function miniMonth(ctx: CanvasRenderingContext2D, x: number, y: number, monday: Date, today: string) {
  const ref = new Date(monday);
  ref.setDate(ref.getDate() + 3); // giovedì determina il mese della settimana
  const year = ref.getFullYear();
  const month = ref.getMonth();
  ctx.save();
  ctx.fillStyle = "#141210";
  ctx.font = `700 26px ${HAND}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${MONTH_NAMES_IT[month]} ${year}`, x, y);
  ctx.font = `500 13px ${BODY}`;
  ctx.fillStyle = "#6b625c";
  const heads = ["L", "M", "M", "G", "V", "S", "D"];
  const cw = 26;
  heads.forEach((h, i) => ctx.fillText(h, x + i * cw + 8, y + 24));
  const first = new Date(year, month, 1);
  let col = (first.getDay() + 6) % 7;
  let row = 0;
  const days = new Date(year, month + 1, 0).getDate();
  const weekDates = weekDays(monday).map(toISODate);
  for (let d = 1; d <= days; d++) {
    const iso = toISODate(new Date(year, month, d));
    const cx = x + col * cw + 8;
    const cy = y + 42 + row * 16;
    if (weekDates.includes(iso)) {
      ctx.fillStyle = "rgba(242,182,50,0.55)";
      ctx.fillRect(cx - 5, cy - 12, cw - 2, 16);
    }
    ctx.fillStyle = iso === today ? "#e8542f" : "#141210";
    ctx.font = `${iso === today ? 700 : 500} 13px ${BODY}`;
    ctx.fillText(String(d), cx, cy);
    col++;
    if (col === 7) {
      col = 0;
      row++;
    }
  }
  ctx.restore();
}

export type DrawOpts = {
  side: PageSide;
  monday: Date;
  bookings: BookingDTO[]; // già filtrate per la settimana
  today: string; // YYYY-MM-DD
  now: Date;
};

export function drawPage(canvas: HTMLCanvasElement, opts: DrawOpts) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { side, monday, bookings, today, now } = opts;
  const L = getLayout(side);
  const days = weekDays(monday);
  const weekNo = isoWeekNumber(monday);
  const seed = monday.getTime() / 86400000 + (side === "left" ? 1 : 2);
  const r = rand(Math.floor(seed));

  paperBackground(ctx, Math.floor(seed) * 7);

  /* ---------- intestazione ---------- */
  ctx.save();
  ctx.fillStyle = "#141210";
  ctx.textBaseline = "alphabetic";
  if (side === "left") {
    miniMonth(ctx, 44, 40, monday, today);
    ctx.font = `400 74px ${DISPLAY}`;
    ctx.textAlign = "right";
    ctx.fillText(`SETT. ${weekNo}`, 984, 118);
    ctx.font = `500 30px ${HAND}`;
    ctx.fillStyle = "#3b3532";
    const last = days[6];
    ctx.fillText(
      `${days[0].getDate()} ${MONTH_NAMES_IT[days[0].getMonth()].slice(0, 3).toLowerCase()} — ${last.getDate()} ${MONTH_NAMES_IT[last.getMonth()].toLowerCase()} ${last.getFullYear()}`,
      984,
      160,
    );
    ctx.textAlign = "left";
  } else {
    const ref = days[3];
    ctx.font = `400 74px ${DISPLAY}`;
    ctx.fillText(MONTH_NAMES_IT[ref.getMonth()].toUpperCase(), 112, 118);
    ctx.font = `500 30px ${HAND}`;
    ctx.fillStyle = "#3b3532";
    ctx.fillText(`anno ${ref.getFullYear()} · agenda naïve`, 116, 160);
    // legenda servizi
    ctx.font = `500 22px ${HAND}`;
    let lx = 665;
    SERVICES.forEach((s, i) => {
      const ly = 62 + i * 27;
      if (i === 3) {
        lx = 835;
      }
      const y = i >= 3 ? 62 + (i - 3) * 27 : ly;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(lx + 8, y - 7, 9, 7, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#141210";
      ctx.fillText(s.label, lx + 26, y);
    });
    doodleFlower(ctx, 930, 150, 16, "#e8542f", "#f2b632", Math.floor(seed) * 3);
  }
  ctx.restore();

  /* ---------- griglia ---------- */
  // linee stampate
  ctx.save();
  ctx.strokeStyle = "#141210";
  ctx.lineWidth = 2;
  ctx.strokeRect(L.gridX, L.gridY, L.gridW, L.gridH);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(20,18,16,0.35)";
  for (let rI = 1; rI < HOURS.length; rI++) {
    const y = L.gridY + rI * L.rowH;
    ctx.beginPath();
    ctx.moveTo(L.gridX, y);
    ctx.lineTo(L.gridX + L.gridW, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#141210";
  ctx.lineWidth = 1.5;
  for (let c = 1; c < L.cols; c++) {
    const x = L.gridX + c * L.colW;
    ctx.beginPath();
    ctx.moveTo(x, L.gridY - 70);
    ctx.lineTo(x, L.gridY + L.gridH);
    ctx.stroke();
  }
  // intestazione giorni
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(L.gridX, L.gridY - 70);
  ctx.lineTo(L.gridX + L.gridW, L.gridY - 70);
  ctx.stroke();
  ctx.restore();

  // etichette ore
  ctx.save();
  ctx.fillStyle = "#3b3532";
  ctx.font = `500 15px ${BODY}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  HOURS.forEach((h, i) => {
    ctx.fillText(formatHour(h), L.gridX - 8, L.gridY + i * L.rowH + 14);
  });
  ctx.restore();

  // giorni
  for (let c = 0; c < L.cols; c++) {
    const dayIdx = L.dayOffset + c;
    const d = days[dayIdx];
    const iso = toISODate(d);
    const x = L.gridX + c * L.colW;
    const isToday = iso === today;
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#141210";
    ctx.font = `400 40px ${DISPLAY}`;
    ctx.fillText(String(d.getDate()), x + 14, L.gridY - 22);
    ctx.font = `500 15px ${BODY}`;
    ctx.fillStyle = "#3b3532";
    ctx.fillText(DAY_SHORT_IT[dayIdx], x + 14 + (d.getDate() > 9 ? 56 : 32), L.gridY - 24);
    if (isToday) crayonCircle(ctx, x + 34, L.gridY - 36, 32, "#f2b632", Math.floor(seed) + 99);
    if (dayIdx === 6) {
      // domenica: leggero tratteggio (chiuso)
      ctx.fillStyle = "rgba(20,18,16,0.04)";
      ctx.fillRect(x, L.gridY, L.colW, L.gridH);
    }
    ctx.restore();

    // slot passati
    for (let rI = 0; rI < HOURS.length; rI++) {
      const slotEnd = new Date(d);
      slotEnd.setHours(HOURS[rI] + 1, 0, 0, 0);
      if (slotEnd < now) {
        const y = L.gridY + rI * L.rowH;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, L.colW, L.rowH);
        ctx.clip();
        ctx.strokeStyle = "rgba(20,18,16,0.10)";
        ctx.lineWidth = 1;
        for (let k = -L.rowH; k < L.colW; k += 10) {
          ctx.beginPath();
          ctx.moveTo(x + k, y + L.rowH);
          ctx.lineTo(x + k + L.rowH, y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  /* ---------- prenotazioni (scritte a mano) ---------- */
  for (const b of bookings) {
    const dayIdx = days.findIndex((d) => toISODate(d) === b.day);
    if (dayIdx < L.dayOffset || dayIdx >= L.dayOffset + L.cols) continue;
    const rect = cellRect(side, dayIdx, b.hour);
    const color = b.status === "done" ? "#8a8580" : serviceColor(b.service);
    crayonFill(ctx, rect.x, rect.y, rect.w, rect.h, color, b.id * 31 + 7);
    ctx.save();
    ctx.fillStyle = "#141210";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 ${L.cols === 3 ? 30 : 27}px ${HAND}`;
    const name = b.clientName.length > 16 ? b.clientName.slice(0, 15) + "…" : b.clientName;
    ctx.fillText(name, rect.x + 12, rect.y + 40);
    ctx.font = `500 20px ${HAND}`;
    ctx.fillStyle = "#3b3532";
    ctx.fillText(`${b.service} · ${formatHour(b.hour)}`, rect.x + 12, rect.y + 68);
    if (b.status === "done") {
      ctx.strokeStyle = "#141210";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.7;
      jitterLine(ctx, rect.x + 10, rect.y + 34, rect.x + rect.w - 14, rect.y + 30, 3, r);
      ctx.globalAlpha = 1;
      ctx.font = `700 26px ${HAND}`;
      ctx.fillStyle = "#3c9a5f";
      ctx.fillText("✓ fatto", rect.x + rect.w - 92, rect.y + rect.h - 12);
    }
    ctx.restore();
  }

  /* ---------- piè di pagina ---------- */
  ctx.save();
  if (side === "left") {
    ctx.fillStyle = "rgba(20,18,16,0.35)";
    for (let yy = 1318; yy < 1400; yy += 14) {
      for (let xx = 150; xx < 960; xx += 14) {
        ctx.beginPath();
        ctx.arc(xx, yy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = "rgba(20,18,16,0.35)";
    ctx.lineWidth = 1;
    for (let yy = 1325; yy < 1400; yy += 22) {
      ctx.beginPath();
      ctx.moveTo(120, yy);
      ctx.lineTo(880, yy);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#6b625c";
  ctx.font = `500 11px ${BODY}`;
  ctx.textAlign = "center";
  ctx.fillText("NAÏVE AGENDA · PLANNER SETTIMANALE", CW / 2, 1408);
  ctx.restore();

  /* ---------- angolo piegato (sfoglia) ---------- */
  ctx.save();
  const s = 92;
  if (side === "right") {
    ctx.fillStyle = "#e6dfd4";
    ctx.beginPath();
    ctx.moveTo(CW, CH - s);
    ctx.lineTo(CW - s, CH);
    ctx.lineTo(CW, CH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fbf8f2";
    ctx.beginPath();
    ctx.moveTo(CW, CH - s);
    ctx.lineTo(CW - s, CH);
    ctx.lineTo(CW - s + 8, CH - s + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(20,18,16,0.35)";
    ctx.stroke();
    ctx.fillStyle = "#e8542f";
    ctx.font = `700 22px ${HAND}`;
    ctx.textAlign = "right";
    ctx.fillText("sfoglia →", CW - 20, CH - s - 12);
  } else {
    ctx.fillStyle = "#e6dfd4";
    ctx.beginPath();
    ctx.moveTo(0, CH - s);
    ctx.lineTo(s, CH);
    ctx.lineTo(0, CH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fbf8f2";
    ctx.beginPath();
    ctx.moveTo(0, CH - s);
    ctx.lineTo(s, CH);
    ctx.lineTo(s - 8, CH - s + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(20,18,16,0.35)";
    ctx.stroke();
    ctx.fillStyle = "#e8542f";
    ctx.font = `700 22px ${HAND}`;
    ctx.fillText("← sfoglia", 20, CH - s - 12);
  }
  ctx.restore();

  // ombra del dorso
  ctx.save();
  const sg =
    side === "left"
      ? ctx.createLinearGradient(CW - 90, 0, CW, 0)
      : ctx.createLinearGradient(90, 0, 0, 0);
  sg.addColorStop(0, "rgba(0,0,0,0)");
  sg.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();
}
