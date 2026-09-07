import { NextRequest } from "next/server";
import { listNotifications, markNotificationsRead, runReminderSweep } from "@/lib/bookings-service";

export const dynamic = "force-dynamic";

/** Restituisce le notifiche; esegue prima lo sweep dei promemoria così il polling client li riceve. */
export async function GET() {
  await runReminderSweep();
  const data = await listNotifications();
  return Response.json(data);
}

/** Segna come lette (tutte o un sottoinsieme di id). */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger) : undefined;
  await markNotificationsRead(ids);
  return Response.json({ ok: true });
}
