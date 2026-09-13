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
} from "./firestore";

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

export function toCourseDTO(c: any): CourseDTO {
  const votesSum = Number(c.votesSum || 0);
  const votesCount = Number(c.votesCount || 0);
  const appealRating =
    typeof c.appealRating === "number" && c.appealRating > 0
      ? c.appealRating
      : votesCount > 0
      ? Math.round((votesSum / votesCount) * 10) / 10
      : 8.5;

  return {
    id: typeof c.id === "number" ? c.id : parseInt(c.id, 10) || 1,
    title: c.title || "",
    description: c.description ?? null,
    instructor: c.instructor || "Docente Scuola",
    category: c.category || "Danza",
    color: c.color || "#e8542f",
    maxCapacity: Number(c.maxCapacity ?? 15),
    price: c.price !== undefined && c.price !== null ? Number(c.price) : 50,
    status: (c.status as "active" | "upcoming") || "active",
    votesSum,
    votesCount,
    appealRating,
    createdAt: typeof c.createdAt === "string" ? c.createdAt : new Date(c.createdAt || Date.now()).toISOString(),
  };
}

const gCourses = globalThis as typeof globalThis & { __coursesSeeded?: Promise<void> };

export async function ensureCoursesSeed() {
  if (gCourses.__coursesSeeded) {
    return gCourses.__coursesSeeded;
  }

  gCourses.__coursesSeeded = (async () => {
    try {
      const metaRef = doc(firestore, "courses", "_meta_init");
      const metaSnap = await getDoc(metaRef);
      if (metaSnap.exists()) {
        return;
      }

      const snap = await getDocs(collection(firestore, "courses"));
      const validDocs = snap.docs.filter((d) => !d.id.startsWith("_meta"));
      if (validDocs.length === 0) {
        const initial = [
          {
            id: 1,
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
            appealRating: 9.6,
            createdAt: new Date().toISOString(),
          },
          {
            id: 2,
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
            appealRating: 9.0,
            createdAt: new Date().toISOString(),
          },
          {
            id: 3,
            title: "Pilates & Posturale per Ballerini",
            description: "Rinforzo del core, allineamento e prevenzione infortuni.",
            instructor: "Trainer Marco Bellini",
            category: "Benessere",
            color: "#52a357",
            maxCapacity: 12,
            price: 55,
            status: "active",
            votesSum: 50,
            votesCount: 5,
            appealRating: 9.7,
            createdAt: new Date().toISOString(),
          },
          {
            id: 4,
            title: "Hip Hop & Urban Dance Lab",
            description: "Groove, isolazioni, popping e freestyle urbano.",
            instructor: "Coreografo Dave",
            category: "Urban",
            color: "#7a5cff",
            maxCapacity: 20,
            price: 60,
            status: "upcoming",
            votesSum: 39,
            votesCount: 4,
            appealRating: 8.4,
            createdAt: new Date().toISOString(),
          },
          {
            id: 5,
            title: "Canto & Dizione per Performer",
            description: "Tecnica vocale, respirazione diaframmatica e interpretazione scenica.",
            instructor: "Maestra Maria Rossi",
            category: "Canto",
            color: "#3c9a5f",
            maxCapacity: 10,
            price: 50,
            status: "upcoming",
            votesSum: 45,
            votesCount: 5,
            appealRating: 9.0,
            createdAt: new Date().toISOString(),
          },
        ];

        for (const c of initial) {
          await setDoc(doc(firestore, "courses", String(c.id)), c);
        }
      }

      await setDoc(metaRef, { initialized: true, at: new Date().toISOString() });
    } catch (e) {
      console.warn("Courses seed note:", e);
    }
  })();

  return gCourses.__coursesSeeded;
}

export async function listCourses(status?: "active" | "upcoming"): Promise<CourseDTO[]> {
  await ensureCoursesSeed();
  const snap = await getDocs(collection(firestore, "courses"));
  let list: CourseDTO[] = [];
  snap.forEach((docSnap) => {
    if (docSnap.id.startsWith("_meta")) return;
    const data = docSnap.data();
    list.push(toCourseDTO({ id: docSnap.id, ...data }));
  });

  if (status) {
    list = list.filter((c) => c.status === status);
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

export async function deleteCourse(courseId: number): Promise<boolean> {
  await ensureCoursesSeed();
  const docRef = doc(firestore, "courses", String(courseId));
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("CORSO_NON_TROVATO");
  }

  await deleteDoc(docRef);

  // Rimuove eventuali voti registrati per questo corso
  try {
    const votesSnap = await getDocs(
      query(collection(firestore, "course_votes"), where("courseId", "==", courseId))
    );
    for (const vDoc of votesSnap.docs) {
      await deleteDoc(vDoc.ref);
    }
  } catch (err) {
    console.warn("Note: could not delete related course_votes:", err);
  }

  return true;
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
  const snap = await getDocs(collection(firestore, "courses"));
  let maxId = 0;
  snap.forEach((docSnap) => {
    if (docSnap.id.startsWith("_meta")) return;
    const d = docSnap.data();
    const numericId = Number(d.id || docSnap.id);
    if (!isNaN(numericId) && numericId > maxId) {
      maxId = numericId;
    }
  });
  const newId = maxId + 1;

  const newCourse = {
    id: newId,
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
    appealRating: 8.5,
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(firestore, "courses", String(newId)), newCourse);
  return toCourseDTO(newCourse);
}

export async function updateCourse(
  courseId: number,
  patch: {
    title?: string;
    description?: string | null;
    instructor?: string | null;
    category?: string | null;
    color?: string | null;
    maxCapacity?: number | null;
    price?: number | null;
    status?: "active" | "upcoming";
  }
): Promise<CourseDTO> {
  await ensureCoursesSeed();
  const docRef = doc(firestore, "courses", String(courseId));
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("CORSO_NON_TROVATO");
  }

  const updates: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (patch.title !== undefined) updates.title = patch.title.trim();
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null;
  if (patch.instructor !== undefined) updates.instructor = patch.instructor?.trim() || "Maestro della Scuola";
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.color !== undefined) updates.color = patch.color;
  if (patch.maxCapacity !== undefined && patch.maxCapacity !== null) updates.maxCapacity = Number(patch.maxCapacity);
  if (patch.price !== undefined) updates.price = patch.price;
  if (patch.status !== undefined) updates.status = patch.status;

  await updateDoc(docRef, updates);
  const updatedSnap = await getDoc(docRef);
  return toCourseDTO({ id: courseId, ...updatedSnap.data() });
}

export async function submitCourseVote(input: {
  courseId: number;
  rating: number; // 1 a 10
  userId?: string | null;
  voterToken?: string | null;
}): Promise<{ course: CourseDTO; isUpdate: boolean; previousRating: number | null }> {
  await ensureCoursesSeed();
  const rating = Math.max(1, Math.min(10, Math.round(input.rating)));
  const docRef = doc(firestore, "courses", String(input.courseId));
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("CORSO_NON_TROVATO");
  }

  const courseData = snap.data();
  const currentVotesSum = Number(courseData.votesSum || 0);
  const currentVotesCount = Number(courseData.votesCount || 0);

  const rawKey = (input.userId || input.voterToken || "anon_user").trim();
  const voterKey = rawKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const voteDocRef = doc(firestore, "course_votes", `${input.courseId}_${voterKey}`);
  const existingVoteSnap = await getDoc(voteDocRef);

  let isUpdate = false;
  let previousRating: number | null = null;
  let newVotesSum = currentVotesSum;
  let newVotesCount = currentVotesCount;

  if (existingVoteSnap.exists()) {
    isUpdate = true;
    previousRating = Number(existingVoteSnap.data().rating || 0);
    // Sostituisce il vecchio voto con il nuovo, il conteggio totale votanti non aumenta
    newVotesSum = currentVotesSum - previousRating + rating;
    newVotesCount = currentVotesCount;
  } else {
    // Nuovo voto: incrementa di 1
    newVotesSum = currentVotesSum + rating;
    newVotesCount = currentVotesCount + 1;
  }

  const newAppeal = newVotesCount > 0 ? Math.round((newVotesSum / newVotesCount) * 10) / 10 : 0;

  await updateDoc(docRef, {
    votesSum: newVotesSum,
    votesCount: newVotesCount,
    appealRating: newAppeal,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(voteDocRef, {
      id: `${input.courseId}_${voterKey}`,
      courseId: input.courseId,
      userId: input.userId || null,
      voterToken: input.voterToken || null,
      rating,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Could not save individual vote doc:", err);
  }

  const updatedSnap = await getDoc(docRef);
  return {
    course: toCourseDTO({ id: input.courseId, ...updatedSnap.data() }),
    isUpdate,
    previousRating,
  };
}

export async function getManagerDashboardMetrics() {
  await ensureCoursesSeed();

  const allCourses = await listCourses();
  const activeCourses = allCourses.filter((c) => c.status === "active");
  const upcomingCourses = allCourses.filter((c) => c.status === "upcoming");

  // Totale studenti da Firestore users
  const userSnap = await getDocs(collection(firestore, "users"));
  const students: any[] = [];
  userSnap.forEach((d) => {
    const data = d.data();
    const role = data.role === "manager" ? "manager" : "user";
    if (role === "user") {
      students.push({ id: d.id, ...data, role });
    }
  });

  // Tutte le prenotazioni da Firestore bookings
  const bookingsSnap = await getDocs(collection(firestore, "bookings"));
  const allBookings: any[] = [];
  bookingsSnap.forEach((d) => {
    allBookings.push({ id: d.id, ...d.data() });
  });

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
    const isPresent = b.attendanceStatus === "present" || (b.status === "done" && b.attendanceStatus !== "absent");

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

      if (b.day && b.day.startsWith(currentMonthPrefix)) {
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
