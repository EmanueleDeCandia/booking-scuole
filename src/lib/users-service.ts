import {
  firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "./firestore";
import type { UserDTO } from "./agenda";

export function toUserDTO(u: any): UserDTO {
  const rawRole = u.role || "user";
  const role: "user" | "manager" = rawRole === "manager" ? "manager" : "user";

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
    const patchData: Record<string, any> = {
      displayName: input.displayName || existing.displayName,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existing.avatarUrl,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      role: input.role || existing.role,
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
    displayName: input.displayName,
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
  const docRef = doc(firestore, "users", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error("USER_NOT_FOUND");

  await updateDoc(docRef, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  const updatedSnap = await getDoc(docRef);
  return toUserDTO({ id, ...updatedSnap.data() });
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
    const matchesUser =
      user.role === "manager" ||
      b.userId === user.id ||
      (b.clientEmail && b.clientEmail.toLowerCase() === user.email.toLowerCase());

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
        status: b.status || "confirmed",
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
    bookings: userBookings,
  };
}
