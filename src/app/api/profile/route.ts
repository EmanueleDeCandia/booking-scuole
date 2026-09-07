import { NextRequest, NextResponse } from "next/server";
import { getUserProfileData, updateUser } from "@/lib/users-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get("userId");
    const cookieUserId = req.cookies.get("auth_user_id")?.value;
    const cookieRole = req.cookies.get("auth_role")?.value;

    let targetId = cookieUserId;
    if (cookieRole === "manager" && queryUserId) {
      targetId = queryUserId;
    } else if (!targetId) {
      targetId = queryUserId;
    }

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

    return NextResponse.json({ ok: true, user: updated });
  } catch (error: any) {
    console.error("Error in /api/profile PUT:", error);
    return NextResponse.json({ error: error.message || "Errore aggiornamento profilo" }, { status: 500 });
  }
}
