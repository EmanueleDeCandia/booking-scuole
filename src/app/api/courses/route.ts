import { NextRequest, NextResponse } from "next/server";
import { listCourses, createCourse, getManagerDashboardMetrics } from "@/lib/courses-service";

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
