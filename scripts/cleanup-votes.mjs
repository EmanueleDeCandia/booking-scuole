import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";

const firebaseConfig = { projectId: "booking-scuole" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("--- Cleaning and recalculating course votes ---");
  const snap = await getDocs(collection(db, "course_votes"));
  console.log("Current total raw vote docs:", snap.size);

  const latestVotesByUserCourse = new Map();
  const docsToDelete = [];

  snap.forEach((d) => {
    const data = d.data();
    const key = `${data.courseId}_${data.userId || "anon"}`;
    const existing = latestVotesByUserCourse.get(key);
    const dateA = new Date(data.createdAt || data.updatedAt || 0).getTime();
    const dateB = existing ? new Date(existing.createdAt || existing.updatedAt || 0).getTime() : 0;

    if (!existing || dateA > dateB) {
      if (existing && existing.docId !== key) {
        docsToDelete.push(existing.docId);
      }
      latestVotesByUserCourse.set(key, { ...data, docId: d.id });
    } else {
      if (d.id !== key) {
        docsToDelete.push(d.id);
      }
    }
  });

  console.log("Docs to delete (duplicates):", docsToDelete.length);
  for (const id of docsToDelete) {
    try {
      await deleteDoc(doc(db, "course_votes", id));
    } catch {}
  }

  // Ensure canonical docs exist with clean id
  for (const [key, v] of latestVotesByUserCourse.entries()) {
    const canonicalId = key;
    await setDoc(doc(db, "course_votes", canonicalId), {
      id: canonicalId,
      courseId: v.courseId,
      userId: v.userId || null,
      rating: v.rating,
      updatedAt: new Date().toISOString(),
    });
    if (v.docId !== canonicalId) {
      try {
        await deleteDoc(doc(db, "course_votes", v.docId));
      } catch {}
    }
  }

  // Recalculate courses
  const courseSnap = await getDocs(collection(db, "courses"));
  for (const cDoc of courseSnap.docs) {
    const course = cDoc.data();
    const courseId = Number(course.id || cDoc.id);

    const votesForCourse = [];
    for (const [key, v] of latestVotesByUserCourse.entries()) {
      if (v.courseId === courseId) {
        votesForCourse.push(v.rating);
      }
    }

    let votesCount = votesForCourse.length;
    let votesSum = votesForCourse.reduce((a, b) => a + b, 0);

    if (votesCount === 0) {
      votesCount = course.status === "upcoming" ? 3 : 5;
      votesSum = Math.round(votesCount * 8.5);
    }

    const appealRating = Math.round((votesSum / votesCount) * 10) / 10;
    await updateDoc(doc(db, "courses", cDoc.id), {
      votesCount,
      votesSum,
      appealRating,
    });
    console.log(`Course ${courseId} (${course.title}): ${votesCount} votes, avg ${appealRating}/10`);
  }

  console.log("Cleanup finished successfully!");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
