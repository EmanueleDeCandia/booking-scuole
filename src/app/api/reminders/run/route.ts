import { runReminderSweep } from "@/lib/bookings-service";

export const dynamic = "force-dynamic";

/** Endpoint per cron esterni: genera i promemoria scaduti. */
export async function POST() {
  const created = await runReminderSweep();
  return Response.json({ created: created.length, items: created });
}

export async function GET() {
  return POST();
}
