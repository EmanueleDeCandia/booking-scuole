import { firestore, collection, getDocs } from "./firestore";
import { addDays, startOfWeek, toISODate } from "./agenda";
import { createBooking } from "./bookings-service";
import { ensureCoursesSeed } from "./courses-service";
import { ensureUsersSeed } from "./users-service";

const g = globalThis as typeof globalThis & { __naiveSeeded?: Promise<void> };

/** Inserisce alcune prenotazioni dimostrative se Firestore è vuoto */
export async function ensureSeed() {
  if (g.__naiveSeeded) {
    return g.__naiveSeeded;
  }

  g.__naiveSeeded = (async () => {
    await ensureUsersSeed();
    await ensureCoursesSeed();

    try {
      const snap = await getDocs(collection(firestore, "bookings"));
      if (snap.size >= 6) {
        return; // Dati già presenti e popolati in Firestore!
      }

      const monday = startOfWeek(new Date());
      const samples: Array<[number, number, string, string, string | null, string | undefined, string | undefined]> = [
        [0, 9, "Elena Rossi (Allieva)", "Danza Classica Avanzata", "Lezione tecnica sbarra", "student-demo", "allievo@scuola.it"],
        [0, 15, "Marco Bellini", "Modern & Contemporary Jazz", null, undefined, undefined],
        [1, 10, "Sara Conti", "Pilates & Posturale per Ballerini", "Rinforzo", undefined, undefined],
        [2, 11, "Elena Rossi (Allieva)", "Modern & Contemporary Jazz", "Coreografia", "student-demo", "allievo@scuola.it"],
        [2, 16, "Anna Ricci", "Modern & Contemporary Jazz", "Coreografia", undefined, undefined],
        [3, 9, "Paolo Greco", "Pilates & Posturale per Ballerini", null, undefined, undefined],
        [4, 14, "Elena Sala", "Danza Classica Avanzata", "Sbarra", undefined, undefined],
        [5, 10, "Davide Fontana", "Modern & Contemporary Jazz", null, undefined, undefined],
        [7, 9, "Chiara Villa", "Pilates & Posturale per Ballerini", "Controllo", undefined, undefined],
        [8, 17, "Matteo Riva", "Danza Classica Avanzata", null, undefined, undefined],
      ];

      for (const [off, hour, name, service, notes, userId, clientEmail] of samples) {
        const day = toISODate(addDays(monday, off));
        try {
          await createBooking({
            userId: userId || null,
            day,
            hour,
            clientName: name,
            clientEmail: clientEmail || `${name.toLowerCase().replace(/[^a-z0-9]/g, ".")}@scuola.it`,
            clientPhone: "+39 340 " + Math.floor(1000000 + Math.random() * 9000000),
            service,
            notes,
            attendanceStatus: off <= 1 ? "present" : "pending",
          });
        } catch {
          /* slot occupato */
        }
      }
    } catch (e) {
      console.error("seed failed", e);
    }
  })();

  return g.__naiveSeeded;
}
