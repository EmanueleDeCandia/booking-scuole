import { NextRequest } from "next/server";
import { deleteBooking, updateBooking } from "@/lib/bookings-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return Response.json({ error: "ID non valido" }, { status: 400 });
  try {
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    for (const key of ["clientName", "clientEmail", "clientPhone", "service", "notes", "status", "day", "attendanceStatus", "userId"]) {
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

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return Response.json({ error: "ID non valido" }, { status: 400 });
  await deleteBooking(numId);
  return Response.json({ ok: true });
}
