import { NextRequest, NextResponse } from "next/server";
import { getUserProfileData, updateUser } from "@/lib/users-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get("userId") || undefined;
    const cookieUserId = req.cookies.get("auth_user_id")?.value;

    // Priorità all'ID richiesto esplicitamente dal client autenticato, con fallback al cookie
    const targetId: string | undefined = queryUserId || cookieUserId;

    if (!targetId) {
      return NextResponse.json({ error: "Non autorizzato o nessun utente specificato" }, { status: 401 });
    }

    const data = await getUserProfileData(targetId);
    if (!data) {
      return NextResponse.json({ error: "Profilo non trovato" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in /api/profile GET:", error);
    return NextResponse.json({ error: error.message || "Errore caricamento profilo" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const cookieUserId = req.cookies.get("auth_user_id")?.value;
    const body = await req.json();
    const targetId = body.userId || cookieUserId;

    if (!targetId) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const updated = await updateUser(targetId, {
      displayName: body.displayName,
      phone: body.phone,
      avatarUrl: body.avatarUrl,
      notes: body.notes,
    });

    const res = NextResponse.json({ ok: true, user: updated });
    res.cookies.set("auth_user_id", updated.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: false,
    });
    res.cookies.set("auth_role", updated.role, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: false,
    });

    return res;
  } catch (error: any) {
    console.error("Error in /api/profile PUT:", error);
    return NextResponse.json({ error: error.message || "Errore aggiornamento profilo" }, { status: 500 });
  }
}
