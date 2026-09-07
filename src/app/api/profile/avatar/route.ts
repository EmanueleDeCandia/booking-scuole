import { NextRequest, NextResponse } from "next/server";
import { updateUser } from "@/lib/users-service";
import path from "node:path";
import fs from "node:fs/promises";

export async function POST(req: NextRequest) {
  try {
    const cookieUserId = req.cookies.get("auth_user_id")?.value;
    const contentType = req.headers.get("content-type") || "";

    let userId = cookieUserId;
    let avatarUrl = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const paramUserId = formData.get("userId") as string | null;
      if (paramUserId) userId = paramUserId;

      if (!file) {
        return NextResponse.json({ error: "Nessun file caricato" }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Assicurati che esista la cartella public/avatars
      const uploadsDir = path.join(process.cwd(), "public", "avatars");
      await fs.mkdir(uploadsDir, { recursive: true });

      const ext = file.name.split(".").pop() || "jpg";
      const filename = `avatar-${userId || Date.now()}-${Date.now()}.${ext}`;
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, buffer);

      avatarUrl = `/avatars/${filename}`;
    } else {
      const body = await req.json();
      if (body.userId) userId = body.userId;
      avatarUrl = body.avatarUrl;
    }

    if (!userId) {
      return NextResponse.json({ error: "Utente non identificato" }, { status: 401 });
    }

    if (!avatarUrl) {
      return NextResponse.json({ error: "URL avatar mancante" }, { status: 400 });
    }

    const updatedUser = await updateUser(userId, { avatarUrl });

    return NextResponse.json({ ok: true, avatarUrl, user: updatedUser });
  } catch (error: any) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json({ error: error.message || "Errore durante il caricamento della foto" }, { status: 500 });
  }
}
