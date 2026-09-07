import { db, ensureDbSchema } from "@/db";
import { users, bookings, type User, type NewUser } from "@/db/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";
import type { UserDTO } from "./agenda";

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    role: (u.role as "user" | "manager") ?? "user",
    status: u.status,
    membershipDate: u.membershipDate ? u.membershipDate.toISOString() : new Date().toISOString(),
    notes: u.notes,
    createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
  };
}

export async function ensureUsersSeed() {
  await ensureDbSchema();
  const demoManager: NewUser = {
    id: "manager-demo-01",
    email: "gestore@scuola.it",
    displayName: "Elena (Gestore Didattico)",
    phone: "+39 340 1234567",
    role: "manager",
    status: "active",
    notes: "Direzione Didattica · Corsi Musicali e Discipline Artistiche",
  };
  const demoStudent: NewUser = {
    id: "student-demo-01",
    email: "allievo.danza@esempio.it",
    displayName: "Elena Rossi (Allieva)",
    phone: "+39 340 9876543",
    role: "user",
    status: "active",
    notes: "Iscritta ai corsi di Danza Classica e Modern Contemporary",
  };
  for (const u of [demoManager, demoStudent]) {
    try {
      await db.insert(users).values(u).onConflictDoNothing();
    } catch (e) {
      console.warn("Users seed note:", e);
    }
  }
}

export async function getUserById(id: string): Promise<UserDTO | null> {
  await ensureDbSchema();
  await ensureUsersSeed();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!rows.length) return null;
  return toUserDTO(rows[0]);
}

export async function getUserByEmail(email: string): Promise<UserDTO | null> {
  await ensureDbSchema();
  await ensureUsersSeed();
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  if (!rows.length) return null;
  return toUserDTO(rows[0]);
}

export async function upsertUser(input: {
  id: string;
  email: string;
  displayName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: "user" | "manager";
  notes?: string | null;
}): Promise<UserDTO> {
  await ensureDbSchema();
  await ensureUsersSeed();
  const email = input.email.toLowerCase().trim();

  const existingById = await getUserById(input.id);
  const existingByEmail = await getUserByEmail(email);
  const existing = existingById || existingByEmail;

  if (existing) {
    const targetId = existing.id;
    const [updated] = await db
      .update(users)
      .set({
        displayName: input.displayName || existing.displayName,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existing.avatarUrl,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        role: input.role || existing.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetId))
      .returning();
    return toUserDTO(updated);
  }

  const role = input.role ?? (email.includes("gestore") || email.includes("admin") ? "manager" : "user");

  const [created] = await db
    .insert(users)
    .values({
      id: input.id,
      email,
      displayName: input.displayName,
      phone: input.phone ?? null,
      avatarUrl: input.avatarUrl ?? null,
      role,
      status: "active",
      notes: input.notes ?? null,
    })
    .returning();

  return toUserDTO(created);
}

export async function updateUser(
  id: string,
  patch: Partial<{
    displayName: string;
    phone: string | null;
    avatarUrl: string | null;
    notes: string | null;
    role: "user" | "manager";
    status: string;
  }>
): Promise<UserDTO> {
  await ensureDbSchema();
  const [updated] = await db
    .update(users)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  if (!updated) throw new Error("USER_NOT_FOUND");
  return toUserDTO(updated);
}

export async function getUserProfileData(userId: string) {
  await ensureDbSchema();
  await ensureUsersSeed();
  const user = await getUserById(userId);
  if (!user) {
    return null;
  }

  // Se gestore didattico, visualizza la panoramica generale della scuola
  // Se allievo, visualizza RIGOROSAMENTE SOLO i corsi e le lezioni a cui è iscritto
  const userBookings = await db
    .select()
    .from(bookings)
    .where(
      user.role === "manager"
        ? undefined
        : or(eq(bookings.userId, user.id), eq(bookings.clientEmail, user.email))
    )
    .orderBy(desc(bookings.day), desc(bookings.hour));

  const total = userBookings.length;
  const present = userBookings.filter((b) => b.attendanceStatus === "present" || b.status === "done").length;
  const absent = userBookings.filter((b) => b.attendanceStatus === "absent").length;
  const upcoming = userBookings.filter((b) => b.status === "confirmed").length;
  const cancelled = userBookings.filter((b) => b.status === "cancelled").length;

  return {
    user,
    stats: {
      total,
      present,
      absent,
      upcoming,
      cancelled,
    },
    bookings: userBookings.map((b) => ({
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
      attendanceStatus: (b.attendanceStatus as any) || "pending",
      reminderMinutes: b.reminderMinutes,
      reminderSent: b.reminderSent,
      createdAt: b.createdAt.toISOString(),
    })),
  };
}
