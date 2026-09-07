"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "./auth/AuthContext";
import { useToast } from "./Toasts";
import { BookingModal, type SlotTarget } from "./BookingModal";
import { toISODate } from "@/lib/agenda";
import type { CourseDTO } from "@/lib/courses-service";

export function CoursesShowcaseClient() {
  const { user } = useAuth();
  const toast = useToast();

  const [courses, setCourses] = useState<CourseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "active">("upcoming");
  const [votingCourseId, setVotingCourseId] = useState<number | null>(null);
  const [userVotes, setUserVotes] = useState<Record<number, number>>({});
  const [voterToken, setVoterToken] = useState<string>("");

  // Modale di prenotazione diretta per corsi attivi
  const [bookingTarget, setBookingTarget] = useState<SlotTarget | null>(null);
  const [preselectedCourse, setPreselectedCourse] = useState<string | null>(null);

  useEffect(() => {
    try {
      let token = localStorage.getItem("naive_voter_token");
      if (!token) {
        token = "voter_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
        localStorage.setItem("naive_voter_token", token);
      }
      setVoterToken(token);

      const savedVotes = localStorage.getItem("naive_course_votes");
      if (savedVotes) {
        setUserVotes(JSON.parse(savedVotes));
      }
    } catch {}
  }, []);

  const loadCourses = useCallback(async () => {
    try {
      const res = await fetch("/api/courses", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleVoteAppeal = async (courseId: number, rating: number) => {
    setVotingCourseId(courseId);
    try {
      const res = await fetch("/api/courses/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          rating,
          userId: user?.id || null,
          voterToken: voterToken || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore registrazione voto");

      const nextVotes = { ...userVotes, [courseId]: rating };
      setUserVotes(nextVotes);
      try {
        localStorage.setItem("naive_course_votes", JSON.stringify(nextVotes));
      } catch {}

      if (data.isUpdate) {
        toast.show(`🔄 Preferenza aggiornata a ${rating}/10!`, "info");
      } else {
        toast.show(`⭐ Grazie! Hai espresso la tua preferenza: ${rating}/10!`, "info");
      }
      await loadCourses();
    } catch (err: any) {
      toast.show(err.message || "Errore voto appeal", "error");
    } finally {
      setVotingCourseId(null);
    }
  };

  const upcomingCourses = courses.filter((c) => c.status === "upcoming");
  const activeCourses = courses.filter((c) => c.status === "active");

  const handleBookCourse = (courseTitle: string) => {
    const today = new Date().toISOString().split("T")[0];
    const curH = new Date().getHours();
    const nextH = Math.min(18, Math.max(8, curH >= 18 ? 9 : curH + 1));
    setPreselectedCourse(courseTitle);
    setBookingTarget({
      day: today,
      hour: nextH,
      booking: null,
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-16 sm:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 border-b-2 border-dashed border-ink/20 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="tag bg-crayon-teal text-white text-xs font-bold uppercase shadow-xs">
              Scuola di Danza &amp; Arti
            </span>
            <span className="tag bg-crayon-yellow text-ink text-xs font-bold shadow-xs">
              Sondaggio Attivo
            </span>
          </div>
          <h1 className="font-display text-[clamp(2rem,5vw,3.8rem)] leading-[1] mt-2 text-ink">
            Corsi &amp; <span className="crayon-hl" style={{ ["--hl" as string]: "var(--crayon-yellow)" }}>Sondaggio Appeal</span>
          </h1>
          <p className="font-hand mt-1.5 sm:mt-2 text-lg sm:text-2xl text-ink-soft">
            Vota i corsi in programma per aiutarci ad attivarli oppure iscriviti ai corsi già attivi!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/" className="btn !py-2 !px-3 sm:!py-2.5 sm:!px-4 text-xs sm:text-sm font-bold shadow-sketch">
            ✎ Agenda 3D
          </Link>
          <Link href="/profilo" className="btn btn-ink !py-2 !px-3 sm:!py-2.5 sm:!px-4 text-xs sm:text-sm font-bold shadow-sketch">
            👤 Il Tuo Profilo
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-b-2 border-ink/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={`btn text-xs sm:text-sm font-bold transition-all ${
            activeTab === "upcoming" ? "btn-yellow shadow-sketch" : "text-ink-soft hover:bg-white"
          }`}
        >
          🌟 Nuovi Corsi in Programma &amp; Voto Appeal ({upcomingCourses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`btn text-xs sm:text-sm font-bold transition-all ${
            activeTab === "active" ? "btn-teal text-white shadow-sketch" : "text-ink-soft hover:bg-white"
          }`}
        >
          🩰 Corsi Attivi della Scuola ({activeCourses.length})
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="font-hand animate-pulse text-2xl text-ink-soft">
            Caricamento del catalogo corsi in corso… 🎨
          </div>
        </div>
      ) : activeTab === "upcoming" ? (
        /* TAB 1: Nuovi Corsi in Programma & Sondaggio Appeal */
        <div className="mt-6 space-y-6">
          <div className="sketch-sm border-2 border-dashed border-crayon-yellow bg-crayon-yellow/20 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base sm:text-lg uppercase font-bold text-ink">
                  💡 Come funziona il Sondaggio Appeal?
                </h2>
                <p className="font-hand text-base sm:text-lg text-ink-soft mt-1">
                  La scuola pianifica periodicamente nuovi workshop e laboratori. Ogni allievo o visitatore può esprimere
                  un voto da 1 a 10. I corsi che superano l&apos;indice di gradimento 8.0/10 verranno confermati e inseriti nel calendario ufficiale!
                </p>
              </div>
            </div>
          </div>

          {upcomingCourses.length === 0 ? (
            <div className="card-sketch bg-white p-8 text-center">
              <p className="font-hand text-xl text-ink-soft">Al momento non ci sono nuovi corsi in fase di proposta.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {upcomingCourses.map((course) => {
                const isVoting = votingCourseId === course.id;

                return (
                  <div
                    key={course.id}
                    className="sketch relative flex flex-col justify-between overflow-hidden bg-white p-5 shadow-sm transition-all hover:shadow-md"
                    style={{ borderTop: `6px solid ${course.color || "#f2b632"}` }}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span
                            className="tag text-[10px] font-bold uppercase tracking-wider text-white !py-0.5 !px-2 shadow-xs"
                            style={{ backgroundColor: course.color || "#f2b632" }}
                          >
                            {course.category}
                          </span>
                          <h3 className="font-display text-xl sm:text-2xl font-bold text-ink mt-2">
                            {course.title}
                          </h3>
                        </div>

                        {/* Badge Appeal */}
                        <div className="text-right shrink-0">
                          <div className="sketch-sm inline-flex items-center gap-1 bg-crayon-yellow/40 px-2.5 py-1 text-ink font-bold text-sm shadow-xs">
                            <span>⭐</span>
                            <span className="font-display text-base font-extrabold">{course.appealRating}</span>
                            <span className="text-[10px] text-ink-soft">/10</span>
                          </div>
                          <div className="text-[10px] text-ink-soft mt-1">
                            {course.votesCount} {course.votesCount === 1 ? "voto allievi" : "voti allievi"}
                          </div>
                        </div>
                      </div>

                      <p className="font-hand text-base sm:text-lg text-ink-soft mt-2.5">
                        {course.description || "Nessuna descrizione disponibile per questa proposta."}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-soft border-t border-dashed border-ink/15 pt-3">
                        <span>👤 Docente: <strong className="text-ink">{course.instructor}</strong></span>
                        <span>👥 Max {course.maxCapacity} allievi</span>
                        <span>💶 Quota: <strong className="text-ink">€{course.price}</strong></span>
                      </div>
                    </div>

                    {/* Votazione Appeal Interattiva (da 1 a 10) */}
                    <div className="mt-5 rounded-lg border-2 border-dashed border-crayon-teal/30 bg-crayon-teal/10 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-xs uppercase font-bold text-ink">
                          {userVotes[course.id] ? (
                            <span className="text-crayon-teal">
                              ✓ Il tuo voto: <strong>{userVotes[course.id]}/10</strong> ⭐ (clicca per modificare)
                            </span>
                          ) : (
                            "Esprimi il tuo indice di gradimento (1 voto per corso):"
                          )}
                        </span>
                        {isVoting && <span className="text-xs text-crayon-teal font-bold animate-pulse">Salvo…</span>}
                      </div>

                      <div className="mt-2.5 grid grid-cols-10 gap-1 sm:gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
                          const isSelected = userVotes[course.id] === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              disabled={isVoting}
                              onClick={() => handleVoteAppeal(course.id, v)}
                              className={`sketch-sm flex h-8 sm:h-9 items-center justify-center font-display text-xs sm:text-sm font-bold transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 ${
                                isSelected
                                  ? "bg-crayon-teal text-white border-2 border-ink shadow-sm scale-105"
                                  : "bg-white text-ink hover:bg-crayon-yellow"
                              }`}
                              title={isSelected ? `Il tuo voto attuale: ${v}/10` : `Vota ${v} su 10 per questo corso`}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-1.5 flex justify-between text-[10px] text-ink-soft">
                        <span>1 = Poco interessante</span>
                        <span>10 = Lo frequenterei subito!</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: Corsi Attivi della Scuola */
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeCourses.map((course) => (
            <div
              key={course.id}
              className="sketch relative flex flex-col justify-between overflow-hidden bg-white p-5 shadow-sm hover:shadow-md transition-all"
              style={{ borderTop: `6px solid ${course.color || "#e8542f"}` }}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="tag text-[10px] font-bold uppercase tracking-wider text-white !py-0.5 !px-2 shadow-xs"
                    style={{ backgroundColor: course.color || "#e8542f" }}
                  >
                    {course.category}
                  </span>
                  <span className="tag bg-crayon-green text-white text-[10px] font-bold shadow-xs">
                    ✓ Attivo
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold text-ink mt-2.5">
                  {course.title}
                </h3>
                <p className="font-hand text-base text-ink-soft mt-1.5">
                  {course.description}
                </p>

                <div className="mt-4 space-y-1 text-xs text-ink-soft border-t border-dashed border-ink/15 pt-3">
                  <div>👤 Docente: <strong className="text-ink">{course.instructor}</strong></div>
                  <div>👥 Posti aula: <strong className="text-ink">{course.maxCapacity} allievi</strong></div>
                  <div>💶 Quota oraria: <strong className="text-ink">€{course.price}</strong></div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-dashed border-ink/20 flex items-center justify-between">
                <span className="text-[11px] text-ink-soft">Disponibile in Agenda 3D</span>
                <button
                  type="button"
                  onClick={() => handleBookCourse(course.title)}
                  className="btn btn-red !py-1.5 !px-3 text-xs font-bold shadow-xs"
                >
                  Iscriviti a Questo Corso ✎
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale Prenotazione quando cliccato da 'Iscriviti a Questo Corso' */}
      {bookingTarget && (
        <BookingModal
          target={bookingTarget}
          onClose={() => setBookingTarget(null)}
          onCreated={(b) => {
            setBookingTarget(null);
            toast.show(`Iscrizione confermata per ${b.service}! 🎉`, "info");
          }}
          onUpdated={() => setBookingTarget(null)}
          onDeleted={() => setBookingTarget(null)}
        />
      )}
    </div>
  );
}
