import { db, ensureDbSchema } from "@/db";
import { courses, courseVotes, bookings, users, type Course, type NewCourse } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export type CourseDTO = {
  id: number;
  title: string;
  description: string | null;
  instructor: string;
  category: string;
  color: string;
  maxCapacity: number;
  price: number | null;
  status: "active" | "upcoming";
  votesSum: number;
  votesCount: number;
  appealRating: number; // media da 1 a 10
  createdAt: string;
};

export function toCourseDTO(c: Course): CourseDTO {
  const appealRating = c.votesCount > 0 ? Math.round((c.votesSum / c.votesCount) * 10) / 10 : 0;
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    instructor: c.instructor,
    category: c.category,
    color: c.color,
    maxCapacity: c.maxCapacity,
    price: c.price,
    status: (c.status as "active" | "upcoming") || "active",
    votesSum: c.votesSum,
    votesCount: c.votesCount,
    appealRating,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function ensureCoursesSeed() {
  await ensureDbSchema();
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(courses);
  if ((existing[0]?.count ?? 0) === 0) {
    const initial: NewCourse[] = [
      {
        title: "Danza Classica Avanzata",
        description: "Tecnica delle punte, repertorio e sbarra a terra.",
        instructor: "M° Roberto Bolle",
        category: "Balletto",
        color: "#e8542f",
        maxCapacity: 15,
        price: 70,
        status: "active",
        votesSum: 48,
        votesCount: 5,
      },
      {
        title: "Modern & Contemporary Jazz",
        description: "Espressione corporea, floorwork e coreografia fluida.",
        instructor: "Docente Elena Sala",
        category: "Modern",
        color: "#4fb3bf",
        maxCapacity: 18,
        price: 65,
        status: "active",
        votesSum: 36,
        votesCount: 4,
      },
      {
        title: "Pilates & Posturale per Ballerini",
        description: "Rinforzo del core, mobilità articolare e prevenzione infortuni.",
        instructor: "M° Claudia Rossi",
        category: "Fitness",
        color: "#52a357",
        maxCapacity: 12,
        price: 55,
        status: "active",
        votesSum: 29,
        votesCount: 3,
      },
      {
        title: "Hip Hop & Urban Choreo (Nuovo In Programma)",
        description: "Workshop intensivo di freestyle e urban flow per allievi.",
        instructor: "Guest Choreographer",
        category: "Urban",
        color: "#f2b632",
        maxCapacity: 20,
        price: 60,
        status: "upcoming",
        votesSum: 76,
        votesCount: 9,
      },
      {
        title: "Propedeutica alla Danza Bambini (Nuovo In Programma)",
        description: "Avviamento al ritmo, coordinazione e creatività per bambini 4-6 anni.",
        instructor: "M° Laura Conti",
        category: "Propedeutica",
        color: "#a463f2",
        maxCapacity: 10,
        price: 50,
        status: "upcoming",
        votesSum: 45,
        votesCount: 5,
      },
    ];

    try {
      await db.insert(courses).values(initial);
    } catch (e) {
      console.warn("Courses seed insertion handled:", e);
    }
  }
}

export async function listCourses(status?: "active" | "upcoming"): Promise<CourseDTO[]> {
  await ensureCoursesSeed();
  const rows = await db
    .select()
    .from(courses)
    .where(status ? eq(courses.status, status) : undefined)
    .orderBy(desc(courses.createdAt));
  return rows.map(toCourseDTO);
}

export async function createCourse(input: {
  title: string;
  description?: string | null;
  instructor?: string | null;
  category?: string | null;
  color?: string | null;
  maxCapacity?: number | null;
  price?: number | null;
  status?: "active" | "upcoming";
}): Promise<CourseDTO> {
  await ensureCoursesSeed();
  const [created] = await db
    .insert(courses)
    .values({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      instructor: input.instructor?.trim() || "Maestro della Scuola",
      category: input.category || "Musica",
      color: input.color || "#2f7bbf",
      maxCapacity: input.maxCapacity || 15,
      price: input.price !== undefined && input.price !== null ? input.price : 50,
      status: input.status || "active",
      votesSum: 0,
      votesCount: 0,
    })
    .returning();

  return toCourseDTO(created);
}

export async function submitCourseVote(input: {
  courseId: number;
  rating: number; // 1 a 10
  userId?: string | null;
}): Promise<CourseDTO> {
  await ensureCoursesSeed();
  const rating = Math.max(1, Math.min(10, Math.round(input.rating)));

  let validUserId: string | null = null;
  if (input.userId) {
    try {
      const foundUser = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
      if (foundUser.length > 0) {
        validUserId = foundUser[0].id;
      }
    } catch {
      validUserId = null;
    }
  }

  try {
    await db.insert(courseVotes).values({
      courseId: input.courseId,
      userId: validUserId,
      rating,
    });
  } catch {}

  const [updated] = await db
    .update(courses)
    .set({
      votesSum: sql`votes_sum + ${rating}`,
      votesCount: sql`votes_count + 1`,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, input.courseId))
    .returning();

  if (!updated) throw new Error("CORSO_NON_TROVATO");
  return toCourseDTO(updated);
}

export async function getManagerDashboardMetrics() {
  await ensureCoursesSeed();

  const allCourses = await listCourses();
  const activeCourses = allCourses.filter((c) => c.status === "active");
  const upcomingCourses = allCourses.filter((c) => c.status === "upcoming");

  // Totale studenti
  const students = await db
    .select()
    .from(users)
    .where(eq(users.role, "user"))
    .orderBy(desc(users.createdAt));

  // Tutte le prenotazioni per statistiche corsi e presenze
  const allBookings = await db.select().from(bookings);

  // Mese corrente ISO
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 1. Studenti iscritti per Corso
  const studentsPerCourse: Record<string, { count: number; color: string; instructor: string }> = {};
  for (const c of activeCourses) {
    studentsPerCourse[c.title] = { count: 0, color: c.color, instructor: c.instructor };
  }

  // 2. Presenze per Corso (totali e del mese corrente)
  const attendancesPerCourse: Record<
    string,
    { totalPresences: number; thisMonthPresences: number; color: string }
  > = {};
  for (const c of activeCourses) {
    attendancesPerCourse[c.title] = { totalPresences: 0, thisMonthPresences: 0, color: c.color };
  }

  let totalMonthPresences = 0;
  let totalOverallPresences = 0;

  for (const b of allBookings) {
    const courseKey = b.service;
    const isPresent = b.attendanceStatus === "present" || b.status === "done";

    if (!studentsPerCourse[courseKey]) {
      studentsPerCourse[courseKey] = { count: 0, color: "#e8542f", instructor: "Scuola" };
    }
    studentsPerCourse[courseKey].count += 1;

    if (!attendancesPerCourse[courseKey]) {
      attendancesPerCourse[courseKey] = { totalPresences: 0, thisMonthPresences: 0, color: "#e8542f" };
    }

    if (isPresent) {
      attendancesPerCourse[courseKey].totalPresences += 1;
      totalOverallPresences += 1;

      if (b.day.startsWith(currentMonthPrefix)) {
        attendancesPerCourse[courseKey].thisMonthPresences += 1;
        totalMonthPresences += 1;
      }
    }
  }

  // Media Appeal complessivo dei corsi in programma
  const totalAppealVotes = upcomingCourses.reduce((sum, c) => sum + c.votesCount, 0);
  const avgAppealScore =
    totalAppealVotes > 0
      ? Math.round(
          (upcomingCourses.reduce((sum, c) => sum + c.votesSum, 0) / totalAppealVotes) * 10
        ) / 10
      : 8.5;

  const totalStudents = students.length > 0 ? students.length : Object.values(studentsPerCourse).reduce((acc, curr) => acc + curr.count, 0);

  return {
    coursesCount: activeCourses.length,
    totalCourses: allCourses.length,
    activeCoursesCount: activeCourses.length,
    upcomingCoursesCount: upcomingCourses.length,
    activeCourses,
    upcomingCourses,
    totalStudents,
    totalEnrolledStudents: totalStudents,
    students,
    totalMonthPresences,
    monthAttendances: totalMonthPresences,
    totalOverallPresences,
    totalAttendances: totalOverallPresences,
    avgAppealScore,
    studentsPerCourse: Object.entries(studentsPerCourse).map(([title, val]) => ({
      title,
      enrolledCount: val.count,
      count: val.count,
      color: val.color,
      instructor: val.instructor,
    })),
    attendancesPerCourse: Object.entries(attendancesPerCourse).map(([title, val]) => ({
      title,
      service: title,
      totalPresences: val.totalPresences,
      count: val.totalPresences,
      thisMonthPresences: val.thisMonthPresences,
      color: val.color,
    })),
  };
}
