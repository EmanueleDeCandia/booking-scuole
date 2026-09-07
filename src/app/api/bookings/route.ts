import { NextRequest } from "next/server";
import { createBooking, listBookings } from "@/lib/bookings-service";
import { END_HOUR, START_HOUR } from "@/lib/agenda";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const includeCancelled = sp.get("all") === "1";
  const userId = sp.get("userId") ?? undefined;
  const items = await listBookings({ from, to, includeCancelled, userId });
  return Response.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const day = String(body.day ?? "");
    const hour = Number(body.hour);
    const clientName = String(body.clientName ?? "").trim();
    const service = String(body.service ?? "Consulenza");
    const userId = body.userId || req.cookies.get("auth_user_id")?.value || null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return Response.json({ error: "Data non valida" }, { status: 400 });
    }
    if (!Number.isInteger(hour) || hour < START_HOUR || hour > END_HOUR) {
      return Response.json({ error: "Orario non valido" }, { status: 400 });
    }
    if (clientName.length < 2) {
      return Response.json({ error: "Inserisci il nome del cliente" }, { status: 400 });
    }

    const booking = await createBooking({
      userId,
      day,
      hour,
      clientName,
      clientEmail: body.clientEmail ? String(body.clientEmail) : null,
      clientPhone: body.clientPhone ? String(body.clientPhone) : null,
      service,
      notes: body.notes ? String(body.notes) : null,
      reminderMinutes: body.reminderMinutes ? Number(body.reminderMinutes) : 60,
      attendanceStatus: body.attendanceStatus ? String(body.attendanceStatus) : "pending",
    });
    return Response.json({ booking }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return Response.json({ error: "Questo slot è già prenotato" }, { status: 409 });
    }
    console.error(e);
    return Response.json({ error: "Errore interno" }, { status: 500 });
  }
}
