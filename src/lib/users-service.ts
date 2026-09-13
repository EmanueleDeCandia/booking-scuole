import {
  firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from "./firestore";
import {
  calculateGamificationLevel,
  type GamificationProfile,
  type StudentBadge,
  type UserDTO,
  type UserWithStatsDTO,
  type DeletedUserDTO,
} from "./agenda";

export function toUserDTO(u: any): UserDTO {
  const rawRole = u.role || "user";
  const role: "user" | "manager" = rawRole === "manager" ? "manager" : "user";

  const defaultBadges: StudentBadge[] = [
    {
      id: "first_arabesque",
      title: "Primo Passo in Sala",
      desc: "Debutto e iscrizione al percorso artistico della scuola",
      earnedAt: typeof u.createdAt === "string" ? u.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
      symbol: "feather",
    },
  ];

  const rawG = u.gamification || {};
  const danceXp = typeof rawG.danceXp === "number" ? rawG.danceXp : 12;
  const levelInfo = calculateGamificationLevel(danceXp);

  const gamification: GamificationProfile = {
    danceXp,
    levelRank: levelInfo.rank,
    levelTitle: levelInfo.title,
    currentStreak: typeof rawG.currentStreak === "number" ? rawG.currentStreak : 1,
    longestStreak: typeof rawG.longestStreak === "number" ? rawG.longestStreak : 1,
    eventPunches: typeof rawG.eventPunches === "number" ? rawG.eventPunches : 0,
    eventLogs: Array.isArray(rawG.eventLogs) ? rawG.eventLogs : [],
    badges: Array.isArray(rawG.badges) && rawG.badges.length > 0 ? rawG.badges : defaultBadges,
    lastAttendedWeek: rawG.lastAttendedWeek ?? null,
  };

  return {
    id: u.id || "",
    email: u.email || "",
    displayName: u.displayName || u.email || "Utente",
    phone: u.phone ?? null,
    avatarUrl: u.avatarUrl ?? null,
    role,
    status: u.status || "active",
    membershipDate: typeof u.membershipDate === "string" ? u.membershipDate : new Date().toISOString(),
    notes: u.notes ?? null,
    createdAt: typeof u.createdAt === "string" ? u.createdAt : new Date().toISOString(),
    gamification,
  };
}

const gUsers = globalThis as typeof globalThis & { __usersSeeded?: Promise<void> };

export async function ensureUsersSeed() {
  if (gUsers.__usersSeeded) {
    return gUsers.__usersSeeded;
  }

  gUsers.__usersSeeded = (async () => {
    try {
      const snap = await getDocs(collection(firestore, "users"));
      if (snap.size === 0) {
        const demoManager = {
          id: "manager-demo",
          email: "gestore@scuola.it",
          displayName: "Elena Rossi (Gestore)",
          phone: "+39 340 1234567",
          role: "manager",
          status: "active",
          notes: "Direzione Didattica · Corsi Musicali e Discipline Artistiche",
          createdAt: new Date().toISOString(),
        };
        const demoStudent = {
          id: "student-demo",
          email: "allievo@scuola.it",
          displayName: "Marco Bellini",
          phone: "+39 340 3289266",
          role: "student",
          status: "active",
          notes: "Allievo corso Modern Jazz",
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(firestore, "users", demoManager.id), demoManager);
        await setDoc(doc(firestore, "users", demoStudent.id), demoStudent);
      }
    } catch (e) {
      console.warn("Users seed note:", e);
    }
  })();

  return gUsers.__usersSeeded;
}

export async function getUserById(id: string): Promise<UserDTO | null> {
  await ensureUsersSeed();
  const directRef = doc(firestore, "users", id);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) {
    return toUserDTO({ id: directSnap.id, ...directSnap.data() });
  }

  // Fallback: cerca per campo id o id normalizzato
  const allSnap = await getDocs(collection(firestore, "users"));
  for (const docSnap of allSnap.docs) {
    const data = docSnap.data();
    if (data.id === id || docSnap.id === id) {
      return toUserDTO({ id: docSnap.id, ...data });
    }
  }
  return null;
}

export async function getUserByEmail(email: string): Promise<UserDTO | null> {
  await ensureUsersSeed();
  const target = email.toLowerCase().trim();
  const allSnap = await getDocs(collection(firestore, "users"));
  for (const docSnap of allSnap.docs) {
    const data = docSnap.data();
    if (data.email && data.email.toLowerCase().trim() === target) {
      return toUserDTO({ id: docSnap.id, ...data });
    }
  }
  return null;
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
  await ensureUsersSeed();
  const email = input.email.toLowerCase().trim();

  const existingById = await getUserById(input.id);
  const existingByEmail = await getUserByEmail(email);
  const existing = existingById || existingByEmail;

  if (existing) {
    const targetId = existing.id;
    const docRef = doc(firestore, "users", targetId);

    // Se l'utente ha già un nome personalizzato salvato, non sovrascriverlo con il fallback dell'email
    const hasCustomName = Boolean(existing.displayName && existing.displayName.trim() && !existing.displayName.includes("@"));
    const finalDisplayName = hasCustomName ? existing.displayName : (input.displayName || existing.displayName);

    const patchData: Record<string, any> = {
      displayName: finalDisplayName,
      phone: input.phone || existing.phone || null,
      avatarUrl: input.avatarUrl || existing.avatarUrl || null,
      notes: input.notes !== undefined && input.notes !== null ? input.notes : existing.notes,
      role: existing.role || input.role || "user",
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, patchData);
    const updatedSnap = await getDoc(docRef);
    return toUserDTO({ id: targetId, ...updatedSnap.data() });
  }

  const role = input.role ?? (email.includes("gestore") || email.includes("admin") ? "manager" : "user");
  const newId = input.id || `user-${email.replace(/[^a-z0-9]/g, "-")}`;
  const newUser = {
    id: newId,
    email,
    displayName: input.displayName || email.split("@")[0],
    phone: input.phone ?? null,
    avatarUrl: input.avatarUrl ?? null,
    role,
    status: "active",
    notes: input.notes ?? null,
    membershipDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(firestore, "users", newId), newUser);
  return toUserDTO(newUser);
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
  await ensureUsersSeed();
  const existing = await getUserById(id);
  if (!existing) throw new Error("USER_NOT_FOUND");

  const docRef = doc(firestore, "users", existing.id);

  const cleanPatch: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };
  if (patch.displayName !== undefined) cleanPatch.displayName = patch.displayName.trim();
  if (patch.phone !== undefined) cleanPatch.phone = patch.phone ? patch.phone.trim() : null;
  if (patch.avatarUrl !== undefined) cleanPatch.avatarUrl = patch.avatarUrl;
  if (patch.notes !== undefined) cleanPatch.notes = patch.notes ? patch.notes.trim() : null;
  if (patch.role !== undefined) cleanPatch.role = patch.role;
  if (patch.status !== undefined) cleanPatch.status = patch.status;

  await updateDoc(docRef, cleanPatch);

  const updatedSnap = await getDoc(docRef);
  return toUserDTO({ id: existing.id, ...updatedSnap.data() });
}

export async function getUserProfileData(userId: string) {
  await ensureUsersSeed();
  const user = await getUserById(userId);
  if (!user) {
    return null;
  }

  const bookingsSnap = await getDocs(collection(firestore, "bookings"));
  let userBookings: any[] = [];

  bookingsSnap.forEach((d) => {
    const b = d.data();
    const userEmail = user.email.toLowerCase().trim();
    const matchesUser =
      (b.userId && b.userId === user.id) ||
      (b.clientEmail && String(b.clientEmail).toLowerCase().trim() === userEmail);

    if (matchesUser) {
      userBookings.push({
        id: typeof b.id === "number" ? b.id : parseInt(d.id, 10) || 1,
        userId: b.userId ?? null,
        day: b.day,
        hour: Number(b.hour),
        clientName: b.clientName,
        clientEmail: b.clientEmail,
        clientPhone: b.clientPhone,
        service: b.service,
        notes: b.notes,
        status: b.status || "pending",
        attendanceStatus: b.attendanceStatus || "pending",
        reminderMinutes: Number(b.reminderMinutes || 60),
        reminderSent: Boolean(b.reminderSent),
        createdAt: typeof b.createdAt === "string" ? b.createdAt : new Date().toISOString(),
      });
    }
  });

  userBookings.sort((a, b) => {
    if (a.day !== b.day) return b.day.localeCompare(a.day);
    return b.hour - a.hour;
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const total = userBookings.length;
  const isAbsent = (b: any) => b.attendanceStatus === "absent";
  const isPresent = (b: any) => !isAbsent(b) && (b.attendanceStatus === "present" || b.status === "done");
  const present = userBookings.filter(isPresent).length;
  const absent = userBookings.filter(isAbsent).length;
  const upcoming = userBookings.filter((b) => b.status !== "cancelled" && b.day >= todayStr).length;
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
      bookings: userBookings,
    };
  }

function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function addStudentXp(userId: string, delta: number): Promise<void> {
  if (!userId) return;
  try {
    const docRef = doc(firestore, "users", userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const g = data.gamification || {};
    const newXp = Math.max(0, (g.danceXp || 12) + delta);
    const levelInfo = calculateGamificationLevel(newXp);
    await updateDoc(docRef, {
      "gamification.danceXp": newXp,
      "gamification.levelRank": levelInfo.rank,
      "gamification.levelTitle": levelInfo.title,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("addStudentXp error:", err);
  }
}

export async function recordAttendanceGamification(userId: string, dateStr: string): Promise<void> {
  if (!userId) return;
  try {
    const docRef = doc(firestore, "users", userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const g = data.gamification || {};
    const newXp = (g.danceXp || 12) + 10; // +10 XP per presenza lezione
    const levelInfo = calculateGamificationLevel(newXp);

    const attendDate = dateStr ? new Date(dateStr) : new Date();
    const currentWeek = getIsoWeek(attendDate);
    const lastWeek = g.lastAttendedWeek || "";

    let currentStreak = typeof g.currentStreak === "number" ? g.currentStreak : 1;
    let longestStreak = typeof g.longestStreak === "number" ? g.longestStreak : 1;

    if (lastWeek && lastWeek !== currentWeek) {
      currentStreak += 1;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    }

    let badges: StudentBadge[] = Array.isArray(g.badges) ? [...g.badges] : [];
    if (currentStreak >= 3 && !badges.some((b) => b.id === "costanza_3settimane")) {
      badges.push({
        id: "costanza_3settimane",
        title: "Costanza di Studio",
        desc: "Tre settimane consecutive di dedizione e presenza in sala",
        earnedAt: new Date().toISOString().split("T")[0],
        symbol: "medal",
      });
    }

    await updateDoc(docRef, {
      "gamification.danceXp": newXp,
      "gamification.levelRank": levelInfo.rank,
      "gamification.levelTitle": levelInfo.title,
      "gamification.currentStreak": currentStreak,
      "gamification.longestStreak": longestStreak,
      "gamification.lastAttendedWeek": currentWeek,
      "gamification.badges": badges,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("recordAttendanceGamification error:", err);
  }
}

export async function addStudentEventPunch(userId: string, eventName?: string): Promise<UserDTO | null> {
  if (!userId) return null;
  const docRef = doc(firestore, "users", userId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  const g = data.gamification || {};

  const currentPunch = typeof g.eventPunches === "number" ? g.eventPunches : 0;
  const newPunch = currentPunch >= 10 ? 1 : currentPunch + 1;
  const newXp = (g.danceXp || 12) + 5; // +5 XP per evento speciale extra
  const levelInfo = calculateGamificationLevel(newXp);

  const eventLogs = Array.isArray(g.eventLogs) ? [...g.eventLogs] : [];
  const cleanName = eventName?.trim() || "Gara / Concorso / Trasferta Scuola";
  eventLogs.unshift({
    name: cleanName,
    date: new Date().toISOString().split("T")[0],
  });

  let badges: StudentBadge[] = Array.isArray(g.badges) ? [...g.badges] : [];
  if (newPunch === 10 && !badges.some((b) => b.id === "passaporto_masterclass")) {
    badges.push({
      id: "passaporto_masterclass",
      title: "Passaporto Eventi Completato",
      desc: "10 partecipazioni a gare, trasferte o scambi artistici: masterclass omaggio sbloccata!",
      earnedAt: new Date().toISOString().split("T")[0],
      symbol: "medal",
    });
  }

  await updateDoc(docRef, {
    "gamification.eventPunches": newPunch,
    "gamification.eventLogs": eventLogs.slice(0, 20),
    "gamification.danceXp": newXp,
    "gamification.levelRank": levelInfo.rank,
    "gamification.levelTitle": levelInfo.title,
    "gamification.badges": badges,
    updatedAt: new Date().toISOString(),
  });

  const updatedSnap = await getDoc(docRef);
  return toUserDTO({ id: userId, ...updatedSnap.data() });
}

export async function awardStudentHonor(
  userId: string,
  honor: { title: string; desc: string; symbol?: any }
): Promise<UserDTO | null> {
  if (!userId) return null;
  const docRef = doc(firestore, "users", userId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  const g = data.gamification || {};

  const newXp = (g.danceXp || 12) + 15; // +15 XP bonus encomio
  const levelInfo = calculateGamificationLevel(newXp);
  const badges: StudentBadge[] = Array.isArray(g.badges) ? [...g.badges] : [];

  badges.push({
    id: `honor-${Date.now()}`,
    title: honor.title.trim(),
    desc: honor.desc.trim() || "Riconoscimento conferito dalla Direzione Didattica",
    earnedAt: new Date().toISOString().split("T")[0],
    symbol: honor.symbol || "scroll",
  });

  await updateDoc(docRef, {
    "gamification.danceXp": newXp,
    "gamification.levelRank": levelInfo.rank,
    "gamification.levelTitle": levelInfo.title,
    "gamification.badges": badges,
    updatedAt: new Date().toISOString(),
  });

  const updatedSnap = await getDoc(docRef);
  return toUserDTO({ id: userId, ...updatedSnap.data() });
}

export async function listStudentsGamification(): Promise<UserDTO[]> {
  await ensureUsersSeed();
  const snap = await getDocs(collection(firestore, "users"));
  const students: UserDTO[] = [];
  snap.forEach((d) => {
    const data = d.data();
    const dto = toUserDTO({ id: d.id, ...data });
    if (dto.role !== "manager") {
      students.push(dto);
    }
  });

  students.sort((a, b) => (b.gamification?.danceXp || 0) - (a.gamification?.danceXp || 0));
  return students;
}

export async function listAllUsersWithStats(): Promise<UserWithStatsDTO[]> {
  await ensureUsersSeed();
  const [usersSnap, bookingsSnap] = await Promise.all([
    getDocs(collection(firestore, "users")),
    getDocs(collection(firestore, "bookings")),
  ]);

  const bookingsByUser = new Map<string, { total: number; upcoming: number }>();
  const now = new Date().toISOString();
  const todayStr = now.split("T")[0];

  bookingsSnap.forEach((d) => {
    const b = d.data();
    if (b.status === "cancelled") return;
    const emailKey = b.clientEmail ? String(b.clientEmail).toLowerCase().trim() : null;
    const userIdKey = b.userId || null;
    const isUpcoming = b.day >= todayStr;

    const recordKey = (key: string) => {
      const cur = bookingsByUser.get(key) || { total: 0, upcoming: 0 };
      cur.total += 1;
      if (isUpcoming) cur.upcoming += 1;
      bookingsByUser.set(key, cur);
    };

    if (userIdKey) recordKey(userIdKey);
    if (emailKey) recordKey(emailKey);
  });

  const users: UserWithStatsDTO[] = [];
  usersSnap.forEach((d) => {
    const u = toUserDTO({ id: d.id, ...d.data() });
    const statsId = bookingsByUser.get(u.id);
    const statsEmail = bookingsByUser.get(u.email.toLowerCase().trim());
    const total = Math.max(statsId?.total || 0, statsEmail?.total || 0);
    const upcoming = Math.max(statsId?.upcoming || 0, statsEmail?.upcoming || 0);
    users.push({
      ...u,
      bookingsCount: total,
      upcomingBookingsCount: upcoming,
    });
  });

  return users.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function listDeletedUsers(): Promise<DeletedUserDTO[]> {
  const snap = await getDocs(collection(firestore, "deleted_users"));
  const list: DeletedUserDTO[] = [];
  snap.forEach((d) => {
    const data = d.data();
    list.push({
      id: d.id,
      originalId: data.originalId || d.id,
      email: data.email || "",
      displayName: data.displayName || "",
      phone: data.phone || null,
      role: data.role || "user",
      notes: data.notes || null,
      deletedAt: data.deletedAt || new Date().toISOString(),
      deletedBy: data.deletedBy || "Gestore",
      reason: data.reason || "Eliminato dal Gestore",
      userData: data.userData,
    });
  });
  return list.sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));
}

export async function archiveAndDeleteUser(
  userId: string,
  options?: { purgeBookings?: boolean; deletedBy?: string; reason?: string }
): Promise<{ ok: boolean; archivedUser: DeletedUserDTO; purgedBookingsCount: number }> {
  await ensureUsersSeed();
  const existing = await getUserById(userId);
  if (!existing) {
    throw new Error("USER_NOT_FOUND");
  }

  // Protezione account gestore principale
  if (existing.email.toLowerCase().trim() === "gestore@scuola.it") {
    throw new Error("CANNOT_DELETE_ROOT_MANAGER");
  }

  // 1. Archiviazione nella collezione 'deleted_users' di Firestore
  const archiveDocId = `del_${existing.id}_${Date.now()}`;
  const archivedUser: DeletedUserDTO = {
    id: archiveDocId,
    originalId: existing.id,
    email: existing.email,
    displayName: existing.displayName,
    phone: existing.phone || null,
    role: existing.role,
    notes: existing.notes || null,
    deletedAt: new Date().toISOString(),
    deletedBy: options?.deletedBy || "Gestore",
    reason: options?.reason || "Account Fake o Test rimosso dal database",
    userData: existing,
  };

  await setDoc(doc(firestore, "deleted_users", archiveDocId), archivedUser);

  // 2. Rimozione fisica dalla collezione 'users'
  await deleteDoc(doc(firestore, "users", existing.id));

  // 3. Opzionale: pulizia o cancellazione delle prenotazioni collegate
  let purgedBookingsCount = 0;
  if (options?.purgeBookings) {
    const bookingsSnap = await getDocs(collection(firestore, "bookings"));
    const userEmail = existing.email.toLowerCase().trim();
    const userName = existing.displayName ? existing.displayName.toLowerCase().trim() : "";

    for (const bDoc of bookingsSnap.docs) {
      const bData = bDoc.data();
      const emailMatch = bData.clientEmail && String(bData.clientEmail).toLowerCase().trim() === userEmail;
      const nameMatch = userName && bData.clientName && String(bData.clientName).toLowerCase().trim() === userName;
      const match = bData.userId === existing.id || emailMatch || nameMatch;

      if (match) {
        await deleteDoc(doc(firestore, "bookings", bDoc.id));
        purgedBookingsCount++;
      }
    }

    // Pulizia notifiche collegate
    const notifSnap = await getDocs(collection(firestore, "notifications"));
    for (const nDoc of notifSnap.docs) {
      const nData = nDoc.data();
      const emailMatch = nData.clientEmail && String(nData.clientEmail).toLowerCase().trim() === userEmail;
      const match = nData.userId === existing.id || emailMatch;
      if (match) {
        await deleteDoc(doc(firestore, "notifications", nDoc.id));
      }
    }

    // Pulizia voti corsi espressi dall'utente
    try {
      const votesSnap = await getDocs(collection(firestore, "course_votes"));
      for (const vDoc of votesSnap.docs) {
        const vData = vDoc.data();
        if (vData.userId === existing.id || vDoc.id.includes(existing.id)) {
          await deleteDoc(doc(firestore, "course_votes", vDoc.id));
        }
      }
    } catch {
      /* ignore if collection not present */
    }
  }

  return { ok: true, archivedUser, purgedBookingsCount };
}

export async function restoreDeletedUser(deletedDocId: string): Promise<UserDTO> {
  const delDocRef = doc(firestore, "deleted_users", deletedDocId);
  const snap = await getDoc(delDocRef);
  if (!snap.exists()) {
    throw new Error("DELETED_USER_NOT_FOUND");
  }
  const data = snap.data();
  const original = data.userData || {
    id: data.originalId,
    email: data.email,
    displayName: data.displayName,
    phone: data.phone,
    role: data.role,
    notes: data.notes,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  // Re-inserisci nella collezione users attiva
  await setDoc(doc(firestore, "users", original.id), original);

  // Rimuovi dall'archivio deleted_users
  await deleteDoc(delDocRef);

  return toUserDTO({ id: original.id, ...original });
}

