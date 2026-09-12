import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Utenti / Profili registrati (collegati all'UID Firebase).
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // Firebase UID
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    role: text("role").notNull().default("user"), // 'user' (allievo/studente) | 'manager' (gestore)
    status: text("status").notNull().default("active"), // 'active' | 'pending' | 'suspended'
    membershipDate: timestamp("membership_date", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_role_idx").on(t.role)],
);

/**
 * Prenotazioni: ogni riga è uno slot di 1 ora in un giorno specifico.
 * `day` è la data (YYYY-MM-DD), `hour` è l'ora di inizio (8..18).
 */
export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    day: date("day", { mode: "string" }).notNull(),
    hour: integer("hour").notNull(),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    service: text("service").notNull().default("Formazione"),
    notes: text("notes"),
    status: text("status").notNull().default("pending"), // pending | confirmed | cancelled | done
    attendanceStatus: text("attendance_status").notNull().default("pending"), // pending | present | absent
    reminderMinutes: integer("reminder_minutes").notNull().default(60),
    reminderSent: boolean("reminder_sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_day_idx").on(t.day),
    index("bookings_user_id_idx").on(t.userId),
    uniqueIndex("bookings_day_hour_active_idx")
      .on(t.day, t.hour)
      .where(sqlActive()),
  ],
);

/**
 * Notifiche: promemoria automatici + eventi (creazione, cancellazione).
 */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // reminder | created | cancelled | done
    title: text("title").notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_read_idx").on(t.read)],
);

/**
 * Corsi della scuola (attivi e in programma per appeal/survey).
 */
export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    instructor: text("instructor").notNull().default("Maestro della Scuola"),
    category: text("category").notNull().default("Danza"),
    color: text("color").notNull().default("#e8542f"),
    maxCapacity: integer("max_capacity").notNull().default(15),
    price: integer("price").notNull().default(50), // quota mensile in euro
    status: text("status").notNull().default("active"), // 'active' | 'upcoming' (nuovo corso in programma)
    votesSum: integer("votes_sum").notNull().default(0), // somma voti di appeal (1-10)
    votesCount: integer("votes_count").notNull().default(0), // totale voti ricevuti
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("courses_status_idx").on(t.status)],
);

/**
 * Voti di gradimento / Appeal espressi dagli studenti per i corsi in programma (da 1 a 10)
 */
export const courseVotes = pgTable(
  "course_votes",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // da 1 a 10
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("course_votes_course_id_idx").on(t.courseId)],
);

function sqlActive() {
  return sql`status <> 'cancelled'`;
}

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type CourseVote = typeof courseVotes.$inferSelect;


