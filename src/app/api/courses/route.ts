import { NextRequest, NextResponse } from "next/server";
import { listCourses, createCourse, updateCourse, deleteCourse, getManagerDashboardMetrics } from "@/lib/courses-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    if (mode === "metrics") {
      const metrics = await getManagerDashboardMetrics();
      return NextResponse.json(metrics);
    }

    const status = searchParams.get("status") as "active" | "upcoming" | null;
    const courses = await listCourses(status || undefined);
    return NextResponse.json({ courses });
  } catch (error: any) {
    console.error("Error in /api/courses GET:", error);
    return NextResponse.json({ error: error.message || "Errore caricamento corsi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.title || body.title.trim().length < 2) {
      return NextResponse.json({ error: "Inserisci il nome del corso" }, { status: 400 });
    }

    const course = await createCourse({
      title: body.title,
      description: body.description,
      instructor: body.instructor,
      category: body.category,
      color: body.color,
      maxCapacity: body.maxCapacity,
      price: body.price,
      status: body.status || "active",
    });

    return NextResponse.json({ ok: true, course }, { status: 201 });
  } catch (error: any) {
    console.error("Error in /api/courses POST:", error);
    return NextResponse.json({ error: error.message || "Errore creazione corso" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    let courseId: number | null = null;

    if (idParam) {
      courseId = parseInt(idParam, 10);
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.id) courseId = Number(body.id);
      else if (body.courseId) courseId = Number(body.courseId);
    }

    if (!courseId || isNaN(courseId)) {
      return NextResponse.json({ error: "ID del corso mancante o non valido" }, { status: 400 });
    }

    await deleteCourse(courseId);
    return NextResponse.json({ ok: true, deletedId: courseId, message: "Corso eliminato con successo" });
  } catch (error: any) {
    console.error("Error in /api/courses DELETE:", error);
    if (error.message === "CORSO_NON_TROVATO") {
      return NextResponse.json({ error: "Corso non trovato o già rimosso" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || "Errore durante l'eliminazione del corso" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const courseId = Number(body.id || body.courseId);
    if (!courseId || isNaN(courseId)) {
      return NextResponse.json({ error: "ID del corso mancante o non valido" }, { status: 400 });
    }

    const instructor = body.instructor !== undefined ? String(body.instructor).trim() : undefined;
    if (instructor === "") {
      return NextResponse.json({ error: "Il nome del docente non può essere vuoto" }, { status: 400 });
    }

    const course = await updateCourse(courseId, {
      title: body.title,
      description: body.description,
      instructor,
      category: body.category,
      color: body.color,
      maxCapacity: body.maxCapacity,
      price: body.price,
      status: body.status,
    });

    return NextResponse.json({ ok: true, course });
  } catch (error: any) {
    console.error("Error in /api/courses PATCH:", error);
    if (error.message === "CORSO_NON_TROVATO") {
      return NextResponse.json({ error: "Corso non trovato" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || "Errore aggiornamento corso" }, { status: 500 });
  }
}

