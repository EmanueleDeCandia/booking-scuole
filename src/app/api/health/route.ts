import { firestore, collection, getDocs, limit, query } from "@/lib/firestore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Verifica reattività di Cloud Firestore
    const snap = await getDocs(query(collection(firestore, "courses"), limit(1)));
    return Response.json({
      ok: true,
      status: "healthy",
      database: "firestore",
      docsAvailable: snap.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || "Health check failed" }, { status: 500 });
  }
}
