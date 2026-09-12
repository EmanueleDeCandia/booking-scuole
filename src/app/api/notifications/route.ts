import { NextRequest } from "next/server";
import { listNotifications, markNotificationsRead, clearNotifications, runReminderSweep } from "@/lib/bookings-service";
import { getUserById } from "@/lib/users-service";

export const dynamic = "force-dynamic";

async function resolveUserFilter(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cookieUserId = req.cookies.get("auth_user_id")?.value;
  const cookieRole = req.cookies.get("auth_role")?.value;

  const queryUserId = searchParams.get("userId");
  const queryRole = searchParams.get("role");
  const queryEmail = searchParams.get("email");

  const userId = queryUserId || cookieUserId || null;
  let role = queryRole || cookieRole || null;
  let email = queryEmail || null;

  // Se abbiamo userId ma mancano email o role, recuperiamo i dati aggiornati direttamente dal DB Firestore
  if (userId && (!role || !email)) {
    try {
      const dbUser = await getUserById(userId);
      if (dbUser) {
        role = role || dbUser.role;
        email = email || dbUser.email;
      }
    } catch {
      /* ignore */
    }
  }

  return { userId, role, email };
}

/** Restituisce le notifiche (limite massimo di 20); esegue prima lo sweep dei promemoria così il polling client li riceve. */
export async function GET(req: NextRequest) {
  await runReminderSweep();
  const filter = await resolveUserFilter(req);
  const data = await listNotifications(20, filter);
  return Response.json(data);
}

/** Segna come lette (tutte o un sottoinsieme di id). */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger) : undefined;
  const filter = await resolveUserFilter(req);
  await markNotificationsRead(ids, filter);
  return Response.json({ ok: true });
}

/** Cancella / svuota le notifiche. */
export async function DELETE(req: NextRequest) {
  const filter = await resolveUserFilter(req);
  await clearNotifications(filter);
  return Response.json({ ok: true, message: "Notifiche rimosse con successo" });
}


