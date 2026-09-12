import { NextRequest, NextResponse } from "next/server";
import {
  listAllUsersWithStats,
  listDeletedUsers,
  archiveAndDeleteUser,
  restoreDeletedUser,
} from "@/lib/users-service";

export async function GET(req: NextRequest) {
  try {
    const [users, deletedUsers] = await Promise.all([
      listAllUsersWithStats(),
      listDeletedUsers(),
    ]);

    return NextResponse.json({
      ok: true,
      users,
      deletedUsers,
      totalActive: users.length,
      totalDeleted: deletedUsers.length,
    });
  } catch (err: any) {
    console.error("Error in /api/users GET:", err);
    return NextResponse.json({ error: err.message || "Errore caricamento utenti" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Ripristino di un utente archiviato
    if (body.action === "restore") {
      if (!body.deletedDocId) {
        return NextResponse.json({ error: "deletedDocId mancante" }, { status: 400 });
      }
      const restored = await restoreDeletedUser(body.deletedDocId);
      return NextResponse.json({ ok: true, restoredUser: restored });
    }

    // 2. Eliminazione / Archiviazione utente
    if (body.action === "delete") {
      if (!body.userId) {
        return NextResponse.json({ error: "userId mancante" }, { status: 400 });
      }
      const result = await archiveAndDeleteUser(body.userId, {
        purgeBookings: body.purgeBookings !== false,
        deletedBy: body.deletedBy || "Gestore",
        reason: body.reason || "Account Fake / Test eliminato dalla direzione",
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in /api/users POST:", err);
    if (err.message === "CANNOT_DELETE_ROOT_MANAGER") {
      return NextResponse.json({ error: "Impossibile eliminare l'account del Gestore Principale!" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Errore gestione utente" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const purgeBookings = searchParams.get("purgeBookings") !== "false";
    const reason = searchParams.get("reason") || "Account Fake o Test rimosso dal database";

    if (!userId) {
      return NextResponse.json({ error: "userId mancante" }, { status: 400 });
    }

    const result = await archiveAndDeleteUser(userId, {
      purgeBookings,
      deletedBy: "Gestore",
      reason,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Error in /api/users DELETE:", err);
    if (err.message === "CANNOT_DELETE_ROOT_MANAGER") {
      return NextResponse.json({ error: "Impossibile eliminare l'account del Gestore Principale!" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Errore eliminazione utente" }, { status: 500 });
  }
}
