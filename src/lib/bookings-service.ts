import { db, ensureDbSchema } from "@/db";
import { bookings, notifications, type Booking, type Notification } from "@/db/schema";
import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import {
  bookingDateTime,
  formatDayLong,
  formatHour,
  type BookingDTO,
  type NotificationDTO,
} from "./agenda";

export function toBookingDTO(b: Booking): BookingDTO {
  return {
    id: b.id,
    userId: b.userId ?? null,
    day: b.day,
    hour: b.hour,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    clientPhone: b.clientPhone,
    service: b.service,
    notes: b.notes,
    status: b.status as any,
    attendanceStatus: (b.attendanceStatus as any) ?? "pending",
    reminderMinutes: b.reminderMinutes,
    reminderSent: b.reminderSent,
    createdAt: b.createdAt.toISOString(),
  };
}

export function toNotificationDTO(n: Notification): NotificationDTO {
  return {
    id: n.id,
    bookingId: n.bookingId,
    kind: n.kind as any,
    title: n.title,
    message: n.message,
    read: n.read,
    scheduledFor: n.scheduledFor ? n.scheduledFor.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function listBookings(
  opts: { from?: string; to?: string; includeCancelled?: boolean; userId?: string } = {}
) {
  await ensureDbSchema();
  try {
    const existingCount = await db.select({ count: sql<number>`count(*)::int` }).from(bookings);
    if ((existingCount[0]?.count ?? 0) < 8) {
      const { ensureSeed } = await import("./seed");
      await ensureSeed();
    }
  } catch (e) {
    console.warn("Could not check bookings count for seed:", e);
  }

  const conds = [];
  if (opts.from) conds.push(gte(bookings.day, opts.from));
  if (opts.to) conds.push(lte(bookings.day, opts.to));
  if (!opts.includeCancelled) conds.push(ne(bookings.status, "cancelled"));
  if (opts.userId) conds.push(eq(bookings.userId, opts.userId));
  const rows = await db
    .select()
    .from(bookings)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(bookings.day), asc(bookings.hour));
  return rows.map(toBookingDTO);
}

export async function createBooking(input: {
  userId?: string | null;
  day: string;
  hour: number;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  service: string;
  notes?: string | null;
  reminderMinutes?: number;
  attendanceStatus?: string;
}) {
  await ensureDbSchema();
  const existing = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.day, input.day), eq(bookings.hour, input.hour), ne(bookings.status, "cancelled")))
    .limit(1);
  if (existing.length) {
    throw new Error("SLOT_TAKEN");
  }

  const [row] = await db
    .insert(bookings)
    .values({
      userId: input.userId ?? null,
      day: input.day,
      hour: input.hour,
      clientName: input.clientName,
      clientEmail: input.clientEmail ?? null,
      clientPhone: input.clientPhone ?? null,
      service: input.service,
      notes: input.notes ?? null,
      reminderMinutes: input.reminderMinutes ?? 60,
      attendanceStatus: input.attendanceStatus ?? "pending",
    })
    .returning();

  const when = bookingDateTime(row.day, row.hour);
  const remindAt = new Date(when.getTime() - row.reminderMinutes * 60_000);

  try {
    await db.insert(notifications).values({
      bookingId: row.id,
      kind: "created",
      title: "Nuova prenotazione",
      message: `${row.clientName} · ${row.service} · ${formatDayLong(row.day)} alle ${formatHour(row.hour)}.`,
      scheduledFor: remindAt,
    });
  } catch {}

  return toBookingDTO(row);
}

export async function updateBooking(
  id: number,
  patch: Partial<{
    userId: string | null;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    service: string;
    notes: string | null;
    status: string;
    attendanceStatus: string;
    reminderMinutes: number;
    day: string;
    hour: number;
  }>
) {
  await ensureDbSchema();
  const [before] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!before) throw new Error("NOT_FOUND");

  const targetDay = patch.day ?? before.day;
  const targetHour = patch.hour ?? before.hour;
  const targetStatus = patch.status ?? before.status;

  const isMoved =
    (patch.day !== undefined && patch.day !== before.day) ||
    (patch.hour !== undefined && patch.hour !== before.hour);

  if (isMoved && targetStatus !== "cancelled") {
    const conflict = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.day, targetDay),
          eq(bookings.hour, targetHour),
          ne(bookings.id, id),
          ne(bookings.status, "cancelled")
        )
      )
      .limit(1);
    if (conflict.length > 0) {
      throw new Error("SLOT_TAKEN");
    }
  }

  const updateData: Record<string, unknown> = {
    ...patch,
    updatedAt: new Date(),
  };
  if (isMoved) {
    updateData.reminderSent = false;
  }

  const [row] = await db
    .update(bookings)
    .set(updateData)
    .where(eq(bookings.id, id))
    .returning();

  if (isMoved) {
    const when = bookingDateTime(row.day, row.hour);
    const remindAt = new Date(when.getTime() - row.reminderMinutes * 60_000);
    try {
      await db.insert(notifications).values({
        bookingId: row.id,
        kind: "updated",
        title: "Appuntamento spostato",
        message: `${row.clientName} · ${row.service} spostato al ${formatDayLong(row.day)} alle ${formatHour(row.hour)}`,
        scheduledFor: remindAt,
      });
    } catch {}
  } else if (patch.status && patch.status !== before.status) {
    const kind = patch.status === "cancelled" ? "cancelled" : patch.status === "done" ? "done" : "updated";
    const title =
      kind === "cancelled" ? "Appuntamento annullato" : kind === "done" ? "Appuntamento completato" : "Appuntamento aggiornato";
    try {
      await db.insert(notifications).values({
        bookingId: row.id,
        kind,
        title,
        message: `${row.clientName} · ${formatDayLong(row.day)} alle ${formatHour(row.hour)}`,
      });
    } catch {}
  }
  return toBookingDTO(row);
}

export async function deleteBooking(id: number) {
  await ensureDbSchema();
  await db.delete(bookings).where(eq(bookings.id, id));
}

export async function runReminderSweep(now = new Date()) {
  await ensureDbSchema();
  const rows = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "confirmed"), eq(bookings.reminderSent, false)));

  const created: NotificationDTO[] = [];
  for (const b of rows) {
    const when = bookingDateTime(b.day, b.hour);
    const remindAt = new Date(when.getTime() - b.reminderMinutes * 60_000);
    if (now >= remindAt && now <= new Date(when.getTime() + 5 * 60_000)) {
      const minutesLeft = Math.max(0, Math.round((when.getTime() - now.getTime()) / 60_000));
      const [n] = await db
        .insert(notifications)
        .values({
          bookingId: b.id,
          kind: "reminder",
          title: "Promemoria appuntamento",
          message: `Tra ${minutesLeft} min: ${b.clientName} · ${b.service} · ${formatDayLong(b.day)} alle ${formatHour(b.hour)}`,
          scheduledFor: remindAt,
        })
        .returning();
      await db.update(bookings).set({ reminderSent: true }).where(eq(bookings.id, b.id));
      created.push(toNotificationDTO(n));
    } else if (now > when) {
      await db.update(bookings).set({ reminderSent: true }).where(eq(bookings.id, b.id));
    }
  }
  return created;
}

export async function listNotifications(limit = 30) {
  await ensureDbSchema();
  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.read, false));
  return { items: rows.map(toNotificationDTO), unread: count };
}

export async function markNotificationsRead(ids?: number[]) {
  await ensureDbSchema();
  if (ids && ids.length) {
    for (const id of ids) {
      await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
    }
  } else {
    await db.update(notifications).set({ read: true }).where(eq(notifications.read, false));
  }
}

export async function getStats() {
  const all = await listBookings({ includeCancelled: true });
  const now = new Date();
  const upcoming = all.filter((b) => b.status === "confirmed" && bookingDateTime(b.day, b.hour) >= now);
  const done = all.filter((b) => b.status === "done");
  const cancelled = all.filter((b) => b.status === "cancelled");
  const byService: Record<string, number> = {};
  for (const b of all) if (b.status !== "cancelled") byService[b.service] = (byService[b.service] ?? 0) + 1;
  return {
    total: all.length,
    upcoming: upcoming.length,
    done: done.length,
    cancelled: cancelled.length,
    byService,
    next: upcoming[0] ?? null,
  };
}
