import { NextRequest } from "next/server";
import { deleteBooking, getBookingById, updateBooking } from "@/lib/bookings-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return Response.json({ error: "ID non valido" }, { status: 400 });

  const currentUserId = req.cookies.get("auth_user_id")?.value;
  const currentRole = req.cookies.get("auth_role")?.value;

  const existingBooking = await getBookingById(numId);
  if (!existingBooking) {
    return Response.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }

  // Verifica autorizzazione:
  // - Il gestore ("manager") può aggiornare presenze, note o dettagli
  // - L'allievo ("user") può aggiornare SOLO la propria prenotazione
  const isManager = currentRole === "manager";
  const isOwner = Boolean(currentUserId && existingBooking.userId === currentUserId);

  if (!isManager && !isOwner) {
    return Response.json(
      { error: "Non sei autorizzato a modificare o spostare gli appuntamenti di un altro allievo." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const patch: Record<string, unknown> = {};

    // Se allievo, non può cambiare l'assegnazione ad altri utenti o cambiare attendanceStatus
    const allowedKeys = isManager
      ? ["clientName", "clientEmail", "clientPhone", "service", "notes", "status", "day", "attendanceStatus", "userId"]
      : ["clientName", "clientEmail", "clientPhone", "service", "notes", "status", "day"];

    for (const key of allowedKeys) {
      if (key in body) patch[key] = body[key];
    }
    if ("hour" in body) patch.hour = Number(body.hour);
    if ("reminderMinutes" in body) patch.reminderMinutes = Number(body.reminderMinutes);

    const booking = await updateBooking(numId, patch);
    return Response.json({ booking });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return Response.json({ error: "Prenotazione non trovata" }, { status: 404 });
    }
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return Response.json({ error: "Il nuovo slot selezionato è già occupato da un'altra prenotazione" }, { status: 409 });
    }
    console.error(e);
    return Response.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return Response.json({ error: "ID non valido" }, { status: 400 });

  const currentRole = req.cookies.get("auth_role")?.value;

  // Solo il gestore può eliminare definitivamente una riga dal registro
  // L'allievo può invece annullare la propria prenotazione (impostando status: 'cancelled')
  if (currentRole !== "manager") {
    return Response.json(
      { error: "Solo la direzione della scuola può eliminare definitivamente un record dal registro." },
      { status: 403 }
    );
  }

  await deleteBooking(numId);
  return Response.json({ ok: true });
}
