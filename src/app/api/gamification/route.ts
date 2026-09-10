import { NextRequest, NextResponse } from "next/server";
import {
  getUserById,
  getUserByEmail,
  listStudentsGamification,
  addStudentEventPunch,
  awardStudentHonor,
  addStudentXp,
} from "@/lib/users-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    if (userId) {
      const u = await getUserById(userId);
      return NextResponse.json({ found: Boolean(u), user: u, gamification: u?.gamification || null });
    }

    if (email) {
      const u = await getUserByEmail(email);
      return NextResponse.json({ found: Boolean(u), user: u, gamification: u?.gamification || null });
    }

    // Leaderboard allievi per la console del gestore
    const students = await listStudentsGamification();
    return NextResponse.json({ students });
  } catch (error: any) {
    console.error("Gamification GET error:", error);
    return NextResponse.json({ error: error.message || "Errore recupero gamification" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, action, eventName, honorTitle, honorDesc, honorSymbol, xpBonus } = body;

    let targetId = userId;
    if (!targetId && email) {
      const u = await getUserByEmail(email);
      if (u) targetId = u.id;
    }

    if (!targetId) {
      return NextResponse.json({ error: "Identificativo allievo (userId o email) mancante" }, { status: 400 });
    }

    if (action === "add_event_punch") {
      const updated = await addStudentEventPunch(targetId, eventName);
      return NextResponse.json({ success: true, message: "Timbro evento straordinario aggiunto!", user: updated });
    }

    if (action === "award_honor") {
      if (!honorTitle) {
        return NextResponse.json({ error: "Titolo encomio richiesto" }, { status: 400 });
      }
      const updated = await awardStudentHonor(targetId, {
        title: honorTitle,
        desc: honorDesc || "Riconoscimento per meriti artistici conferito dalla Direzione",
        symbol: honorSymbol || "medal",
      });
      return NextResponse.json({ success: true, message: "Encomio artistico conferito con successo!", user: updated });
    }

    if (action === "add_xp" && xpBonus) {
      await addStudentXp(targetId, Number(xpBonus));
      const updated = await getUserById(targetId);
      return NextResponse.json({ success: true, user: updated });
    }

    return NextResponse.json({ error: "Azione non riconosciuta" }, { status: 400 });
  } catch (error: any) {
    console.error("Gamification POST error:", error);
    return NextResponse.json({ error: error.message || "Errore operazione gamification" }, { status: 500 });
  }
}
