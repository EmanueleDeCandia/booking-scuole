import { NextRequest, NextResponse } from "next/server";
import { submitCourseVote } from "@/lib/courses-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const courseId = Number(body.courseId);
    const rating = Number(body.rating);
    const userId = body.userId || req.cookies.get("auth_user_id")?.value || null;
    const voterToken = body.voterToken ? String(body.voterToken) : null;

    if (!courseId || !rating || rating < 1 || rating > 10) {
      return NextResponse.json({ error: "Voto non valido (deve essere compreso tra 1 e 10)" }, { status: 400 });
    }

    const result = await submitCourseVote({
      courseId,
      rating,
      userId,
      voterToken,
    });

    return NextResponse.json({
      ok: true,
      course: result.course,
      isUpdate: result.isUpdate,
      previousRating: result.previousRating,
    });
  } catch (error: any) {
    console.error("Error in /api/courses/vote POST:", error);
    return NextResponse.json({ error: error.message || "Errore registrazione preferenza" }, { status: 500 });
  }
}
