import { NextRequest } from "next/server";
import { deleteBooking, getBookingById, updateBooking } from "@/lib/bookings-service";
import { getUserById, getUserByEmail } from "@/lib/users-service";

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

  // Carica l'utente autenticato se presente
  let currentUser = currentUserId ? await getUserById(currentUserId) : null;

  const body = await req.json().catch(() => ({}));

  // Se l'utente non è ancora risolto da cookie ma invia un clientEmail che esiste nel database
  if (!currentUser && body.clientEmail) {
    currentUser = await getUserByEmail(String(body.clientEmail));
  }

  // Verifica se è gestore (ruolo manager): solo "manager" ha i permessi di direzione didattica
  const isManager = Boolean(
    currentUser?.role === "manager" ||
    (currentRole && currentRole.toLowerCase() === "manager")
  );

  // Verifica proprietà (allievo / studente):
  // 1) Corrispondenza diretta userId
  // 2) Corrispondenza email tra l'account registrato e la prenotazione
  // 3) Se la prenotazione è stata effettuata prima dell'iscrizione con la stessa email
  const userEmail = currentUser?.email?.toLowerCase().trim();
  const bookingEmail = existingBooking.clientEmail?.toLowerCase().trim();
  const bodyEmail = typeof body.clientEmail === "string" ? body.clientEmail.toLowerCase().trim() : null;

  const isOwner = Boolean(
    (currentUser && existingBooking.userId && existingBooking.userId === currentUser.id) ||
    (userEmail && bookingEmail && userEmail === bookingEmail) ||
    (bodyEmail && bookingEmail && bodyEmail === bookingEmail)
  );

  if (!isManager && !isOwner) {
    return Response.json(
      { error: "Non sei autorizzato a modificare o spostare gli appuntamenti di un altro allievo." },
      { status: 403 }
    );
  }

  try {
    const patch: Record<string, unknown> = {};

    // Se l'allievo era proprietario tramite email ma non aveva ancora userId associato (prenotato prima dell'iscrizione),
    // colleghiamo permanentemente la prenotazione al suo account
    if (currentUser && (!existingBooking.userId || existingBooking.userId !== currentUser.id)) {
      patch.userId = currentUser.id;
    }

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

  const currentUserId = req.cookies.get("auth_user_id")?.value;
  const currentRole = req.cookies.get("auth_role")?.value;

  const existingBooking = await getBookingById(numId);
  if (!existingBooking) {
    return Response.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }

  const currentUser = currentUserId ? await getUserById(currentUserId) : null;
  const isManager = Boolean(
    currentUser?.role === "manager" ||
    (currentRole && currentRole.toLowerCase() === "manager")
  );

  const userEmail = currentUser?.email?.toLowerCase().trim();
  const bookingEmail = existingBooking.clientEmail?.toLowerCase().trim();
  const isOwner = Boolean(
    (currentUser && existingBooking.userId && existingBooking.userId === currentUser.id) ||
    (userEmail && bookingEmail && userEmail === bookingEmail)
  );

  // Sia la direzione che l'allievo proprietario possono rimuovere/annullare la propria prenotazione
  if (!isManager && !isOwner) {
    return Response.json(
      { error: "Non sei autorizzato a eliminare questa prenotazione." },
      { status: 403 }
    );
  }

  await deleteBooking(numId);
  return Response.json({ ok: true });
}
