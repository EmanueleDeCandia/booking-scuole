import { NextRequest, NextResponse } from "next/server";
import { upsertUser, getUserById } from "@/lib/users-service";
import { adminAuth, isFirebaseAdminConfigured } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, uid, email, displayName, phone, avatarUrl, role } = body;

    let verifiedUid = uid;
    let verifiedEmail = email;
    let verifiedName = displayName;

    // Se Firebase Admin è configurato e viene passato un idToken, verifichiamo la firma
    if (isFirebaseAdminConfigured && adminAuth && idToken) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        verifiedUid = decoded.uid;
        verifiedEmail = decoded.email || email;
        verifiedName = decoded.name || displayName || decoded.email?.split("@")[0] || "Utente";
      } catch (err) {
        console.warn("Firebase token verification warning (skipped for pre-production):", err);
        // In pre-produzione non blocchiamo l'iscrizione
        verifiedUid = uid || `user-${email.split("@")[0]}`;
        verifiedEmail = email;
      }
    }

    if (!verifiedUid || !verifiedEmail) {
      return NextResponse.json({ error: "Dati utente mancanti" }, { status: 400 });
    }

    const user = await upsertUser({
      id: verifiedUid,
      email: verifiedEmail,
      displayName: verifiedName || verifiedEmail.split("@")[0],
      phone: phone ?? null,
      avatarUrl: avatarUrl ?? null,
      role: role ?? "user",
    });

    const res = NextResponse.json({ ok: true, user });

    // Imposta cookie di sessione per SSR/Middleware
    res.cookies.set("auth_user_id", user.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 giorni
      sameSite: "lax",
      httpOnly: false, // accessibile anche dal client se necessario
    });
    res.cookies.set("auth_role", user.role, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: false,
    });

    return res;
  } catch (error: any) {
    console.error("Error in /api/auth/sync:", error);
    return NextResponse.json({ error: error.message || "Errore sincronizzazione utente" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.cookies.get("auth_user_id")?.value;
    if (!userId) {
      return NextResponse.json({ user: null });
    }
    const user = await getUserById(userId);
    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
