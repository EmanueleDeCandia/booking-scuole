import {
  firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "./firestore";
import {
  bookingDateTime,
  formatDayLong,
  formatHour,
  toISODate,
  type BookingDTO,
  type NotificationDTO,
} from "./agenda";
import { addStudentXp, recordAttendanceGamification } from "./users-service";

export function toBookingDTO(b: any): BookingDTO {
  const status = (b.status as any) || "pending";
  let attendanceStatus = (b.attendanceStatus as any) || "pending";

  if (status === "cancelled") {
    attendanceStatus = "pending";
  } else if (b.day && b.hour !== undefined) {
    const [y, m, d] = String(b.day).split("-").map(Number);
    const slotEnd = new Date(y, m - 1, d, Number(b.hour) + 1, 0, 0);
    const now = new Date();
    // Se la lezione non è ancora terminata e non è marcata esplicitamente come 'done', non può mai essere Presente
    if (now < slotEnd && status !== "done") {
      attendanceStatus = "pending";
    } else if (now >= slotEnd && status === "confirmed" && attendanceStatus === "pending") {
      // All'orario di fine lezione (es. alle 11 per appuntamento 10-11) scatta automaticamente la presenza
      attendanceStatus = "present";
    }
  }

  return {
    id: typeof b.id === "number" ? b.id : parseInt(b.id, 10) || Date.now(),
    userId: b.userId ?? null,
    day: b.day,
    hour: Number(b.hour),
    clientName: b.clientName || "",
    clientEmail: b.clientEmail ?? null,
    clientPhone: b.clientPhone ?? null,
    service: b.service || "",
    notes: b.notes ?? null,
    status,
    attendanceStatus,
    reminderMinutes: Number(b.reminderMinutes ?? 60),
    reminderSent: Boolean(b.reminderSent),
    createdAt: typeof b.createdAt === "string" ? b.createdAt : new Date(b.createdAt || Date.now()).toISOString(),
  };
}

export function toNotificationDTO(n: any): NotificationDTO {
  return {
    id: typeof n.id === "number" ? n.id : parseInt(n.id, 10) || Date.now(),
    bookingId: n.bookingId ? Number(n.bookingId) : null,
    userId: n.userId ?? null,
    clientEmail: n.clientEmail ?? null,
    clientName: n.clientName ?? null,
    kind: (n.kind as any) || "system",
    title: n.title || "",
    message: n.message || "",
    read: Boolean(n.read),
    scheduledFor: n.scheduledFor
      ? typeof n.scheduledFor === "string"
        ? n.scheduledFor
        : new Date(n.scheduledFor).toISOString()
      : null,
    createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date(n.createdAt || Date.now()).toISOString(),
  };
}

export async function listBookings(
  opts: { from?: string; to?: string; includeCancelled?: boolean; userId?: string } = {}
): Promise<BookingDTO[]> {
  const snap = await getDocs(collection(firestore, "bookings"));
  let list: BookingDTO[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    list.push(toBookingDTO({ id: docSnap.id, ...data }));
  });

  if (opts.from) {
    list = list.filter((b) => b.day >= opts.from!);
  }
  if (opts.to) {
    list = list.filter((b) => b.day <= opts.to!);
  }
  if (!opts.includeCancelled) {
    list = list.filter((b) => b.status !== "cancelled");
  }
  if (opts.userId) {
    list = list.filter((b) => b.userId === opts.userId);
  }

  list.sort((a, b) => {
    if (a.day !== b.day) return a.day.localeCompare(b.day);
    return a.hour - b.hour;
  });

  return list;
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
  status?: string;
  reminderMinutes?: number;
  attendanceStatus?: string;
}): Promise<BookingDTO> {
  const today = toISODate(new Date());
  if (input.day < today) {
    throw new Error("PAST_DATE_NOT_ALLOWED");
  }
  const currentHour = new Date().getHours();
  if (input.day === today && input.hour <= currentHour) {
    throw new Error("PAST_HOUR_NOT_ALLOWED");
  }

  const existingList = await listBookings({ from: input.day, to: input.day, includeCancelled: false });
  const isTaken = existingList.some((b) => b.hour === input.hour);
  if (isTaken) {
    throw new Error("SLOT_TAKEN");
  }

  // Trova il massimo ID numerico esistente
  const allSnap = await getDocs(collection(firestore, "bookings"));
  let maxId = 0;
  allSnap.forEach((docSnap) => {
    const d = docSnap.data();
    const numericId = Number(d.id || docSnap.id);
    if (!isNaN(numericId) && numericId > maxId) {
      maxId = numericId;
    }
  });
  const newId = maxId + 1;

  const nowIso = new Date().toISOString();
  const newBooking = {
    id: newId,
    userId: input.userId ?? null,
    day: input.day,
    hour: input.hour,
    clientName: input.clientName,
    clientEmail: input.clientEmail ?? null,
    clientPhone: input.clientPhone ?? null,
    service: input.service,
    notes: input.notes ?? null,
    status: input.status ?? "pending",
    attendanceStatus: input.attendanceStatus ?? "pending",
    reminderMinutes: input.reminderMinutes ?? 60,
    reminderSent: false,
    createdAt: nowIso,
  };

  await setDoc(doc(firestore, "bookings", String(newId)), newBooking);

  const when = bookingDateTime(newBooking.day, newBooking.hour);
  const remindAt = new Date(when.getTime() - newBooking.reminderMinutes * 60_000);

  try {
    const notifId = Date.now();
    await setDoc(doc(firestore, "notifications", String(notifId)), {
      id: notifId,
      bookingId: newId,
      userId: newBooking.userId ?? null,
      clientEmail: newBooking.clientEmail ?? null,
      clientName: newBooking.clientName,
      kind: "created",
      title: "Nuova prenotazione",
      message: `${newBooking.clientName} · ${newBooking.service} · ${formatDayLong(newBooking.day)} alle ${formatHour(newBooking.hour)}.`,
      read: false,
      scheduledFor: remindAt.toISOString(),
      createdAt: nowIso,
    });
  } catch (err) {
    console.warn("Could not write notification:", err);
  }

  // Gamification: +6 XP per nuova lezione prenotata
  if (newBooking.userId) {
    addStudentXp(newBooking.userId, 6).catch(() => {});
  }

  return toBookingDTO(newBooking);
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
): Promise<BookingDTO> {
  const docRef = doc(firestore, "bookings", String(id));
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("NOT_FOUND");
  }

  const before = snap.data();
  const targetDay = patch.day ?? before.day;
  const targetHour = patch.hour !== undefined ? Number(patch.hour) : Number(before.hour);
  const targetStatus = patch.status ?? before.status;

  const isMoved =
    (patch.day !== undefined && patch.day !== before.day) ||
    (patch.hour !== undefined && Number(patch.hour) !== Number(before.hour));

  if (isMoved && targetStatus !== "cancelled") {
    const existingList = await listBookings({ from: targetDay, to: targetDay, includeCancelled: false });
    const conflict = existingList.find((b) => b.id !== id && b.hour === targetHour);
    if (conflict) {
      throw new Error("SLOT_TAKEN");
    }
  }

  const updateData: Record<string, any> = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (targetStatus === "cancelled") {
    updateData.attendanceStatus = "pending";
  }
  if (isMoved) {
    updateData.reminderSent = false;
  }

  await updateDoc(docRef, updateData);
  const updatedSnap = await getDoc(docRef);
  const row: Record<string, any> = { id, ...(updatedSnap.data() || {}) };

  if (isMoved) {
    const when = bookingDateTime(row.day, Number(row.hour));
    const remindAt = new Date(when.getTime() - Number(row.reminderMinutes || 60) * 60_000);
    try {
      const notifId = Date.now();
      await setDoc(doc(firestore, "notifications", String(notifId)), {
        id: notifId,
        bookingId: id,
        userId: row.userId ?? null,
        clientEmail: row.clientEmail ?? null,
        clientName: row.clientName ?? null,
        kind: "updated",
        title: "Appuntamento spostato",
        message: `${row.clientName} · ${row.service} spostato al ${formatDayLong(row.day)} alle ${formatHour(row.hour)}`,
        read: false,
        scheduledFor: remindAt.toISOString(),
        createdAt: new Date().toISOString(),
      });
    } catch {}
  } else if (patch.status && patch.status !== before.status) {
    const isConfirmed = patch.status === "confirmed";
    const kind =
      patch.status === "cancelled"
        ? "cancelled"
        : patch.status === "done"
        ? "done"
        : isConfirmed
        ? "confirmed"
        : "updated";
    const title =
      kind === "cancelled"
        ? "Appuntamento annullato"
        : kind === "done"
        ? "Appuntamento completato"
        : isConfirmed
        ? "Appuntamento confermato"
        : "Appuntamento aggiornato";
    const message = isConfirmed
      ? `${row.clientName} · ${row.service} confermato per ${formatDayLong(row.day)} alle ${formatHour(row.hour)}`
      : `${row.clientName} · ${formatDayLong(row.day)} alle ${formatHour(row.hour)}`;
    try {
      const notifId = Date.now();
      await setDoc(doc(firestore, "notifications", String(notifId)), {
        id: notifId,
        bookingId: id,
        userId: row.userId ?? null,
        clientEmail: row.clientEmail ?? null,
        clientName: row.clientName ?? null,
        kind,
        title,
        message,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch {}
  }

  // Gamification: +10 XP e streak per convalida presenza o completamento lezione
  if ((patch.attendanceStatus === "present" || patch.status === "done") && row.userId) {
    recordAttendanceGamification(row.userId, row.day).catch(() => {});
  }

  return toBookingDTO(row);
}

export async function getBookingById(id: number): Promise<BookingDTO | null> {
  const docRef = doc(firestore, "bookings", String(id));
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return toBookingDTO({ id, ...snap.data() });
}

export async function deleteBooking(id: number): Promise<void> {
  const docRef = doc(firestore, "bookings", String(id));
  await deleteDoc(docRef);
}

export async function runReminderSweep(now = new Date()): Promise<NotificationDTO[]> {
  const snap = await getDocs(collection(firestore, "bookings"));
  const created: NotificationDTO[] = [];

  for (const docSnap of snap.docs) {
    const b = docSnap.data();
    if (b.status === "confirmed" && !b.reminderSent) {
      const when = bookingDateTime(b.day, Number(b.hour));
      const remindMinutes = Number(b.reminderMinutes ?? 60);
      const remindAt = new Date(when.getTime() - remindMinutes * 60_000);

      if (now >= remindAt && now <= new Date(when.getTime() + 5 * 60_000)) {
        const minutesLeft = Math.max(0, Math.round((when.getTime() - now.getTime()) / 60_000));
        const notifId = Date.now() + Math.floor(Math.random() * 1000);
        const notif = {
          id: notifId,
          bookingId: Number(b.id || docSnap.id),
          userId: b.userId ?? null,
          clientEmail: b.clientEmail ?? null,
          clientName: b.clientName ?? null,
          kind: "reminder",
          title: "Promemoria appuntamento",
          message: `Tra ${minutesLeft} min: ${b.clientName} · ${b.service} · ${formatDayLong(b.day)} alle ${formatHour(b.hour)}`,
          read: false,
          scheduledFor: remindAt.toISOString(),
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(firestore, "notifications", String(notifId)), notif);
        await updateDoc(docSnap.ref, { reminderSent: true });
        created.push(toNotificationDTO(notif));
      } else if (now > when) {
        await updateDoc(docSnap.ref, { reminderSent: true });
      }
    }
  }

  return created;
}

export type NotificationFilter = {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
};

export async function listNotifications(
  limitCount = 30,
  filter?: NotificationFilter
): Promise<{ items: NotificationDTO[]; unread: number }> {
  const snap = await getDocs(collection(firestore, "notifications"));
  let list: NotificationDTO[] = [];

  const isManager = filter?.role === "manager";
  const targetUserId = filter?.userId?.trim();
  const targetEmail = filter?.email?.toLowerCase().trim();

  // Cache prenotazioni per retrocompatibilità con notifiche sprovviste di userId/clientEmail
  let bookingMap: Map<number, { userId: string | null; clientEmail: string | null }> | null = null;
  if (!isManager && (targetUserId || targetEmail)) {
    try {
      const bookingsSnap = await getDocs(collection(firestore, "bookings"));
      bookingMap = new Map();
      bookingsSnap.forEach((bDoc) => {
        const bData = bDoc.data();
        const bId = Number(bData.id || bDoc.id);
        bookingMap!.set(bId, {
          userId: bData.userId ?? null,
          clientEmail: bData.clientEmail ?? null,
        });
      });
    } catch {
      /* ignore */
    }
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const dto = toNotificationDTO({ id: docSnap.id, ...data });

    if (isManager) {
      // Il gestore può visualizzare tutte le notifiche della scuola
      list.push(dto);
    } else if (targetUserId || targetEmail) {
      // Gli studenti vedono solo le notifiche che li riguardano direttamente
      let belongsToUser = false;
      if (targetUserId && dto.userId && dto.userId === targetUserId) {
        belongsToUser = true;
      }
      if (!belongsToUser && targetEmail && dto.clientEmail && dto.clientEmail.toLowerCase() === targetEmail) {
        belongsToUser = true;
      }

      // Fallback su booking correlato per vecchie notifiche
      if (!belongsToUser && dto.bookingId && bookingMap) {
        const bMeta = bookingMap.get(dto.bookingId);
        if (bMeta) {
          if (targetUserId && bMeta.userId && bMeta.userId === targetUserId) {
            belongsToUser = true;
          }
          if (!belongsToUser && targetEmail && bMeta.clientEmail && bMeta.clientEmail.toLowerCase() === targetEmail) {
            belongsToUser = true;
          }
        }
      }

      if (belongsToUser) {
        list.push(dto);
      }
    } else {
      // Utente anonimo o non loggato: non esporre notifiche altrui
    }
  });

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const unread = list.filter((n) => !n.read).length;
  return { items: list.slice(0, limitCount), unread };
}

export async function markNotificationsRead(
  ids?: number[],
  filter?: NotificationFilter
): Promise<void> {
  const isManager = filter?.role === "manager";
  const targetUserId = filter?.userId?.trim();
  const targetEmail = filter?.email?.toLowerCase().trim();

  const snap = await getDocs(collection(firestore, "notifications"));
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const id = Number(data.id || docSnap.id);
    if (ids && ids.length > 0 && !ids.includes(id)) {
      continue;
    }

    // Se non è il gestore, segna solo le notifiche appartenenti allo studente
    if (!isManager && (targetUserId || targetEmail)) {
      let belongsToUser = false;
      if (targetUserId && data.userId && data.userId === targetUserId) {
        belongsToUser = true;
      }
      if (!belongsToUser && targetEmail && data.clientEmail && String(data.clientEmail).toLowerCase() === targetEmail) {
        belongsToUser = true;
      }
      if (!belongsToUser) {
        continue;
      }
    }

    if (!data.read) {
      await updateDoc(docSnap.ref, { read: true });
    }
  }
}

export async function getStats() {
  const all = await listBookings({ includeCancelled: true });
  const now = new Date();
  const upcoming = all.filter((b) => b.status === "confirmed" && bookingDateTime(b.day, b.hour) >= now);
  const done = all.filter((b) => b.status === "done");
  const cancelled = all.filter((b) => b.status === "cancelled");
  const byService: Record<string, number> = {};
  for (const b of all) {
    if (b.status !== "cancelled") {
      byService[b.service] = (byService[b.service] ?? 0) + 1;
    }
  }
  return {
    total: all.length,
    upcoming: upcoming.length,
    done: done.length,
    cancelled: cancelled.length,
    byService,
    next: upcoming[0] ?? null,
  };
}
