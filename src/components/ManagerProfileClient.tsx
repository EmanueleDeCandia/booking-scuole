"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "./auth/AuthContext";
import { useToast } from "./Toasts";
import type { CourseDTO } from "@/lib/courses-service";
import type { UserDTO } from "@/lib/agenda";
import { StudentGamificationCard } from "./StudentGamificationCard";

type MetricsData = {
  totalCourses: number;
  activeCourses: number | CourseDTO[];
  coursesCount: number;
  upcomingCourses: number | CourseDTO[];
  totalEnrolledStudents: number;
  totalStudents?: number;
  studentsPerCourse: { title: string; count: number; enrolledCount?: number; color?: string; instructor?: string }[];
  totalAttendances: number;
  totalOverallPresences?: number;
  monthAttendances: number;
  totalMonthPresences?: number;
  attendancesPerCourse: { service: string; title?: string; count: number; totalPresences?: number; thisMonthPresences?: number; color?: string }[];
  avgAppealScore: number;
  upcomingWithAppeal?: CourseDTO[];
};

export function ManagerProfileClient() {
  const { user, refreshProfile, signOut, loading: authLoading } = useAuth();
  const toast = useToast();

  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [courses, setCourses] = useState<CourseDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Modale e Form Creazione Corso
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newInstructor, setNewInstructor] = useState("");
  const [newCategory, setNewCategory] = useState("Musica");
  const [newPrice, setNewPrice] = useState("75");
  const [newCapacity, setNewCapacity] = useState(12);
  const [newColor, setNewColor] = useState("#2f7bbf");
  const [newStatus, setNewStatus] = useState<"active" | "upcoming">("active");
  const [newDescription, setNewDescription] = useState("");

  // Modifica Dati Personali / Scuola
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Caricamento Foto Profilo
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stato voto utente per corso
  const [votingCourseId, setVotingCourseId] = useState<number | null>(null);

  // Gamification: Gestione Registro Didattico Allievi, Timbri ed Encomi
  const [studentsList, setStudentsList] = useState<UserDTO[]>([]);
  const [selectedStudentForPunch, setSelectedStudentForPunch] = useState<UserDTO | null>(null);
  const [selectedStudentForHonor, setSelectedStudentForHonor] = useState<UserDTO | null>(null);
  const [previewStudentGamification, setPreviewStudentGamification] = useState<UserDTO | null>(null);
  const [eventNameInput, setEventNameInput] = useState("Concorso Coreografico d'Autore");
  const [honorTitleInput, setHonorTitleInput] = useState("Dedizione e Virtuosismo d'Atelier");
  const [honorDescInput, setHonorDescInput] = useState("Perfezionamento tecnico ed interpretazione impeccabile.");
  const [honorSymbolInput, setHonorSymbolInput] = useState<string>("medal");
  const [submittingGamification, setSubmittingGamification] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [resMetrics, resCourses, resGamification] = await Promise.all([
        fetch("/api/courses?mode=metrics", { cache: "no-store" }),
        fetch("/api/courses", { cache: "no-store" }),
        fetch("/api/gamification", { cache: "no-store" }),
      ]);

      if (resMetrics.ok) {
        const m = await resMetrics.json();
        setMetrics(m);
      }
      if (resCourses.ok) {
        const c = await resCourses.json();
        setCourses(c.courses || []);
      }
      if (resGamification.ok) {
        const g = await resGamification.json();
        setStudentsList(g.students || []);
      }
    } catch (e) {
      console.error("Errore caricamento dati gestore:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      setDisplayName(user.displayName || "");
      setPhone(user.phone || "");
      setNotes(user.notes || "");
      loadAll();
    }
  }, [authLoading, user, loadAll]);

  // Caricamento Foto
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore caricamento foto");

      toast.show("Foto profilo aggiornata con successo! 📸", "info");
      await refreshProfile();
    } catch (err: any) {
      toast.show(err.message || "Impossibile caricare la foto", "error");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Salvataggio Profilo
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          displayName,
          phone,
          notes,
        }),
      });
      if (!res.ok) throw new Error("Errore aggiornamento dati");
      toast.show("Dati scuola / gestore salvati!", "info");
      setIsEditingProfile(false);
      await refreshProfile();
    } catch (err: any) {
      toast.show(err.message || "Errore durante il salvataggio", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // Creazione Nuovo Corso
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.show("Inserisci il titolo del corso", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          instructor: newInstructor.trim() || (user?.displayName ?? "Direzione Didattica"),
          category: newCategory,
          color: newColor,
          maxCapacity: Number(newCapacity) || 10,
          price: newPrice ? Number(newPrice) : null,
          status: newStatus,
          description: newDescription.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore creazione corso");

      toast.show(
        newStatus === "active"
          ? "🎉 Corso attivato con successo nel catalogo!"
          : "📋 Proposta inserita nei Corsi in Programma per il sondaggio!",
        "info"
      );
      setShowCreateModal(false);
      setNewTitle("");
      setNewInstructor("");
      setNewDescription("");
      await loadAll();
    } catch (err: any) {
      toast.show(err.message || "Errore durante la creazione", "error");
    } finally {
      setCreating(false);
    }
  };

  // Votazione Appeal per corso in programma
  const handleVoteAppeal = async (courseId: number, rating: number) => {
    if (!user) return;
    setVotingCourseId(courseId);
    try {
      const res = await fetch("/api/courses/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          rating,
          userId: user.id,
        }),
      });
      const data = await res.json();
      if (data.isUpdate) {
        toast.show(`🔄 Valutazione aggiornata a ${rating}/10!`, "info");
      } else {
        toast.show(`⭐ Valutazione registrata: ${rating}/10!`, "info");
      }
      await loadAll();
    } catch (err: any) {
      toast.show(err.message || "Errore voto appeal", "error");
    } finally {
      setVotingCourseId(null);
    }
  };

  const handleConfirmEventPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForPunch) return;
    setSubmittingGamification(true);
    try {
      const res = await fetch("/api/gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedStudentForPunch.id,
          action: "add_event_punch",
          eventName: eventNameInput,
        }),
      });
      if (res.ok) {
        toast.show(`🎟️ Timbro per "${eventNameInput}" assegnato a ${selectedStudentForPunch.displayName}!`, "info");
        setSelectedStudentForPunch(null);
        await loadAll();
      }
    } catch (err: any) {
      toast.show(err.message || "Errore assegnazione timbro", "error");
    } finally {
      setSubmittingGamification(false);
    }
  };

  const handleConfirmHonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForHonor) return;
    setSubmittingGamification(true);
    try {
      const res = await fetch("/api/gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedStudentForHonor.id,
          action: "award_honor",
          honorTitle: honorTitleInput,
          honorDesc: honorDescInput,
          honorSymbol: honorSymbolInput,
        }),
      });
      if (res.ok) {
        toast.show(`🎖️ Encomio "${honorTitleInput}" conferito con successo a ${selectedStudentForHonor.displayName}!`, "info");
        setSelectedStudentForHonor(null);
        await loadAll();
      }
    } catch (err: any) {
      toast.show(err.message || "Errore conferimento encomio", "error");
    } finally {
      setSubmittingGamification(false);
    }
  };

  const activeCoursesList = courses.filter((c) => c.status === "active");
  const upcomingCoursesList = courses.filter((c) => c.status === "upcoming");

  return (
    <div className="min-h-screen bg-[#faf6ee] p-2.5 sm:p-6 text-ink">
      <div className="mx-auto w-full max-w-7xl">
        {/* Intestazione e Profilo Gestore */}
        <div className="sketch bg-[#fffdfa] p-4 sm:p-6 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border-b-2 border-dashed border-ink/20 pb-5">
            <div className="flex items-center gap-4">
              {/* Foto Profilo con caricamento rapido */}
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-ink overflow-hidden bg-crayon-yellow/20 flex items-center justify-center shadow-xs">
                  {user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt={user.displayName || "Gestore"} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-2xl font-bold text-ink">
                      {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : "GE"}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  {uploadingPhoto ? "Carico…" : "Cambia 📷"}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl uppercase font-extrabold tracking-tight">
                    {user?.displayName || "Elena (Gestore Didattico)"}
                  </h1>
                  <span className="tag bg-crayon-yellow text-ink font-bold text-xs uppercase shadow-xs">
                    👑 Direzione / Gestore
                  </span>
                  <span className="tag bg-crayon-teal text-white font-bold text-xs uppercase shadow-xs">
                    🏫 booking-scuole
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
                  <span>✉️ {user?.email || "gestore@scuola.it"}</span>
                  {user?.phone && <span>📞 {user.phone}</span>}
                  <span>📍 Sede Centrale & Aule Studio</span>
                </div>
                {user?.notes && (
                  <div className="font-hand mt-1.5 text-base text-crayon-teal">
                    &ldquo;{user.notes}&rdquo;
                  </div>
                )}
              </div>
            </div>

            {/* Azioni Principali della Direzione */}
            <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
              <button
                type="button"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="btn !py-2 !px-3.5 text-xs font-semibold"
              >
                ✏️ {isEditingProfile ? "Chiudi Modifica" : "Modifica Dati"}
              </button>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn btn-red !py-2 !px-4 text-xs font-bold shadow-sm"
              >
                ✨ + Crea Nuovo Corso
              </button>

              <Link href="/" className="btn btn-yellow !py-2 !px-3.5 text-xs font-semibold">
                📅 Agenda 3D
              </Link>

              <button
                type="button"
                onClick={() => signOut()}
                className="btn !py-2 !px-3 text-xs text-crayon-red border-crayon-red/50 hover:bg-crayon-red hover:text-white"
                title="Esci dall'account"
              >
                🚪 Esci
              </button>
            </div>
          </div>

          {/* Form a comparsa per modificare dati personali */}
          {isEditingProfile && (
            <form onSubmit={handleSaveProfile} className="mt-4 p-4 rounded-lg bg-[#fff7d6] border-2 border-dashed border-ink/30 animate-in fade-in">
              <div className="font-display text-sm uppercase font-bold text-ink mb-3">
                Modifica Scheda Direzione / Gestore
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-ink-soft">Nome Scuola o Gestore</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="naive mt-1 !py-1 text-sm font-medium"
                    placeholder="Nome e cognome"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-ink-soft">Telefono di Contatto</span>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="naive mt-1 !py-1 text-sm font-medium"
                    placeholder="+39 340 1234567"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold uppercase text-ink-soft">Motto o Note Istituzionali</span>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="naive font-hand mt-1 !py-1 text-base"
                    placeholder="Breve presentazione visibile nei dettagli..."
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="btn !py-1.5 !px-3 text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn btn-teal !py-1.5 !px-4 text-xs font-bold text-white"
                >
                  {savingProfile ? "Salvataggio…" : "Salva Modifiche"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 4 CARD DELLA CONSOLE GESTORE DIDATTICA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1: Corsi Totali Gestiti */}
          <div className="sketch bg-[#fff9e6] p-4 flex flex-col justify-between border-t-4 border-t-crayon-yellow">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-display text-xs uppercase font-bold text-ink-soft">
                  1 · Corsi Totali Gestiti
                </span>
                <span className="text-lg">📚</span>
              </div>
              <div className="mt-2 font-display text-3xl sm:text-4xl font-black text-ink">
                {metrics ? (Array.isArray(metrics.activeCourses) ? metrics.activeCourses.length : metrics.coursesCount ?? metrics.activeCourses) : "…"}
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Corsi attivi e fruibili nell&apos;agenda didattica della scuola.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-dashed border-ink/20 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-soft">
                Totale a catalogo: {metrics?.totalCourses ?? 0}
              </span>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="text-xs font-bold text-crayon-blue hover:underline"
              >
                + Aggiungi
              </button>
            </div>
          </div>

          {/* Card 2: Studenti Iscritti per Corso */}
          <div className="sketch bg-[#e6f4f8] p-4 flex flex-col justify-between border-t-4 border-t-crayon-teal">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-display text-xs uppercase font-bold text-ink-soft">
                  2 · Studenti Iscritti per Corso
                </span>
                <span className="text-lg">👥</span>
              </div>
              <div className="mt-2 font-display text-3xl sm:text-4xl font-black text-crayon-teal">
                {metrics ? metrics.totalEnrolledStudents : "…"}
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Allievi iscritti ai percorsi formativi attivi.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-dashed border-ink/20">
              <div className="flex flex-wrap gap-1">
                {metrics && metrics.studentsPerCourse.length > 0 ? (
                  metrics.studentsPerCourse.slice(0, 3).map((spc, idx) => (
                    <span
                      key={idx}
                      className="tag bg-white text-ink text-[10px] font-semibold !py-0.5 !px-1.5"
                    >
                      {spc.title}: {spc.count ?? spc.enrolledCount}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-ink-soft">Nessuna iscrizione attiva</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Presenze Studenti per Corso */}
          <div className="sketch bg-[#ebf7ec] p-4 flex flex-col justify-between border-t-4 border-t-crayon-green">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-display text-xs uppercase font-bold text-ink-soft">
                  3 · Presenze Studenti per Corso
                </span>
                <span className="text-lg">✅</span>
              </div>
              <div className="mt-2 font-display text-3xl sm:text-4xl font-black text-crayon-green">
                {metrics ? metrics.totalAttendances : "…"}
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Lezioni frequentate con successo (questo mese: <strong>{metrics?.monthAttendances ?? 0}</strong>).
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-dashed border-ink/20">
              <div className="flex flex-wrap gap-1">
                {metrics && metrics.attendancesPerCourse.length > 0 ? (
                  metrics.attendancesPerCourse.slice(0, 3).map((apc, idx) => (
                    <span
                      key={idx}
                      className="tag bg-white text-crayon-green text-[10px] font-semibold !py-0.5 !px-1.5"
                    >
                      {apc.service || apc.title}: {apc.count ?? apc.totalPresences} ✓
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-ink-soft">Nessuna presenza archiviata</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Nuovi Corsi in Programma (Appeal) */}
          <div className="sketch bg-[#fdeeee] p-4 flex flex-col justify-between border-t-4 border-t-crayon-red">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-display text-xs uppercase font-bold text-ink-soft">
                  4 · Corsi in Programma & Appeal
                </span>
                <span className="text-lg">⭐</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl sm:text-4xl font-black text-crayon-red">
                  {metrics?.avgAppealScore ? metrics.avgAppealScore.toFixed(1) : "—"}
                </span>
                <span className="text-sm font-bold text-ink-soft">/ 10</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Media Appeal Score calcolata sui <strong>{Array.isArray(metrics?.upcomingCourses) ? metrics.upcomingCourses.length : (metrics?.upcomingCourses ?? 0)}</strong> corsi in proposta.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-dashed border-ink/20 flex items-center justify-between">
              <span className="tag bg-crayon-red text-white text-[10px] font-bold !py-0.5 !px-2">
                Sondaggio Studenti 1-10
              </span>
              <a href="#nuovi-corsi-appeal" className="text-xs font-bold text-crayon-red hover:underline">
                Vedi voti ↓
              </a>
            </div>
          </div>
        </div>

        {/* SEZIONE 1: CATALOGO DEI CORSI ATTIVI */}
        <div className="sketch bg-[#fffdfa] p-5 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-dashed border-ink/20 pb-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl uppercase font-bold text-ink">
                📚 Catalogo Corsi Didattici Attivi
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Corsi attualmente fruibili dagli allievi con docenti assegnati e capienza massima.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewStatus("active");
                setShowCreateModal(true);
              }}
              className="btn btn-teal !py-1.5 !px-3.5 text-xs font-bold text-white shadow-xs"
            >
              + Nuovo Corso Attivo
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCoursesList.map((c) => (
              <div
                key={c.id}
                className="relative rounded-lg border-2 border-ink/30 bg-white p-4 shadow-xs transition-transform hover:-translate-y-0.5"
                style={{ borderLeft: `6px solid ${c.color}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="tag bg-crayon-yellow/40 text-ink text-[10px] font-bold uppercase !py-0 !px-1.5">
                      {c.category}
                    </span>
                    <h3 className="font-display text-base uppercase font-bold text-ink mt-1">
                      {c.title}
                    </h3>
                  </div>
                  {c.price && (
                    <span className="tag bg-crayon-teal text-white text-xs font-bold !py-0.5 !px-2 shadow-xs">
                      € {c.price} / mese
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-xs text-ink-soft">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-ink">Docente:</span> {c.instructor}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-ink">Capienza aula:</span> fino a {c.maxCapacity} allievi
                  </div>
                  {c.description && (
                    <p className="font-hand text-sm text-ink-soft/90 pt-1">
                      {c.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SEZIONE 2: NUOVI CORSI IN PROGRAMMA (APPEAL SCORE 1-10) */}
        <div id="nuovi-corsi-appeal" className="sketch bg-[#fffdfa] p-5 sm:p-6 mb-8 border-t-4 border-t-crayon-red">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-dashed border-ink/20 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl sm:text-2xl uppercase font-bold text-ink">
                  ⭐ Nuovi Corsi in Programma & Sondaggio Appeal
                </h2>
                <span className="tag bg-crayon-red text-white text-[11px] font-bold shadow-xs">
                  Valutazione da 1 a 10
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                Proposte di nuovi corsi da lanciare. Gli studenti e la direzione possono votare da 1 a 10 per misurare l&apos;interesse e determinare la priorità di attivazione.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewStatus("upcoming");
                setShowCreateModal(true);
              }}
              className="btn btn-red !py-1.5 !px-3.5 text-xs font-bold shadow-xs"
            >
              + Proponi Nuovo Corso
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {upcomingCoursesList.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-ink/20 p-8 text-center text-sm text-ink-soft">
                Nessun corso attualmente in programma. Clicca su &quot;+ Proponi Nuovo Corso&quot; per inserire una proposta di sondaggio.
              </div>
            ) : (
              upcomingCoursesList.map((course) => {
                const avg = course.appealRating ?? (course.votesCount > 0 ? course.votesSum / course.votesCount : 0);
                return (
                  <div
                    key={course.id}
                    className="rounded-lg border-2 border-ink/20 bg-[#fffdf5] p-4 sm:p-5 shadow-xs"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-dashed border-ink/20 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full border border-ink"
                            style={{ background: course.color }}
                          />
                          <span className="tag bg-crayon-yellow text-ink text-[10px] font-bold uppercase !py-0 !px-1.5">
                            {course.category}
                          </span>
                          <span className="tag bg-crayon-red/20 text-crayon-red text-[10px] font-bold uppercase !py-0 !px-1.5">
                            In Proposta
                          </span>
                        </div>
                        <h3 className="font-display text-lg uppercase font-bold text-ink mt-1">
                          {course.title}
                        </h3>
                        <p className="text-xs text-ink-soft">
                          Docente proposto: <strong>{course.instructor}</strong> · Quota prevista: € {course.price ?? "N/D"} / mese · Obiettivo: {course.maxCapacity} iscritti
                        </p>
                        {course.description && (
                          <p className="font-hand text-sm text-ink-soft/90 mt-1">
                            &ldquo;{course.description}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Display Appeal Score */}
                      <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-lg border border-ink/20 shadow-xs self-start md:self-auto">
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-ink-soft">Appeal Score</div>
                          <div className="font-display text-2xl font-black text-crayon-red">
                            {avg > 0 ? avg.toFixed(1) : "—"}
                            <span className="text-xs text-ink-soft font-normal"> / 10</span>
                          </div>
                        </div>
                        <div className="border-l border-ink/20 pl-3 text-xs text-ink-soft">
                          <span className="font-bold text-ink">{course.votesCount}</span> {course.votesCount === 1 ? "voto" : "voti"}
                        </div>
                      </div>
                    </div>

                    {/* SELETTORE RATING DA 1 A 10 */}
                    <div className="mt-3.5 pt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <span className="font-display text-xs uppercase font-bold text-ink flex items-center gap-1">
                          📊 Esprimi Appeal per questo corso (da 1 a 10):
                        </span>
                        <span className="text-[11px] text-ink-soft">
                          1 = Poco interessante · 10 = Imperdibile / Massima priorità
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => {
                          const isHigh = rating >= 8;
                          const isMid = rating >= 5 && rating < 8;
                          return (
                            <button
                              key={rating}
                              type="button"
                              disabled={votingCourseId === course.id}
                              onClick={() => handleVoteAppeal(course.id, rating)}
                              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-md border-2 border-ink font-display text-xs font-bold transition-all shadow-xs hover:scale-105 active:scale-95 ${
                                isHigh
                                  ? "bg-crayon-green text-white hover:bg-crayon-green/90"
                                  : isMid
                                  ? "bg-crayon-yellow text-ink hover:bg-crayon-yellow/90"
                                  : "bg-white text-ink hover:bg-crayon-red/20"
                              }`}
                              title={`Vota ${rating} su 10`}
                            >
                              {rating}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SEZIONE 3: REGISTRO DIDATTICO & GAMIFICATION ALLIEVI */}
        <div id="gamification-manager" className="sketch bg-[#fffdfa] p-4 sm:p-6 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-dashed border-ink/20 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="tag bg-crayon-yellow border border-ink text-xs font-bold uppercase shadow-xs">
                  Console Direzione
                </span>
                <span className="font-hand text-sm text-ink-soft">Registro di Merito &amp; Gamification</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl uppercase tracking-tight text-ink mt-1 flex items-center gap-2">
                <span>🏅</span> Registro Didattico &amp; Gamification Allievi
              </h2>
              <p className="font-hand text-sm text-ink-soft mt-0.5">
                Monitora la crescita artistica degli allievi ({studentsList.length}), convalida la presenza a eventi straordinari (concorsi, gare, trasferte) e conferisci encomi.
              </p>
            </div>
          </div>

          {/* Regolamento Didattico Naïve */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-crayon-teal/15 p-3 border border-ink/20 text-xs">
              <span className="font-display font-bold uppercase tracking-wider text-[11px] block text-ink mb-1">
                ⭐ Avanzamento &amp; Presenze
              </span>
              <p className="font-hand text-ink-soft">
                <strong>+6 XP</strong> per ogni corso prenotato. <strong>+10 XP</strong> alla convalidata presenza in sala. La frequenza costante sblocca i Gradi d&apos;Atelier.
              </p>
            </div>
            <div className="rounded-lg bg-crayon-yellow/20 p-3 border border-ink/20 text-xs">
              <span className="font-display font-bold uppercase tracking-wider text-[11px] block text-ink mb-1">
                🏛️ Passaporto Eventi Straordinari
              </span>
              <p className="font-hand text-ink-soft">
                Timbri riservati esclusivamente a: <strong>Concorsi, Gare, Trasferte, Scambi Allievi</strong>. Ciascun timbro accredita <strong>+5 XP</strong>. 10 timbri = Masterclass premio.
              </p>
            </div>
            <div className="rounded-lg bg-crayon-red/10 p-3 border border-ink/20 text-xs">
              <span className="font-display font-bold uppercase tracking-wider text-[11px] block text-ink mb-1">
                🎖️ Encomi d&apos;Onore
              </span>
              <p className="font-hand text-ink-soft">
                Distintivo artistico conferito direttamente dalla Direzione per merito, interpretazione e dedizione: accredita <strong>+15 XP</strong> e compare nel libretto.
              </p>
            </div>
          </div>

          {/* Elenco Allievi Iscritti */}
          <div className="mt-6 space-y-3">
            {studentsList.length === 0 ? (
              <div className="p-8 text-center font-hand text-lg text-ink-soft border-2 border-dashed border-ink/20 rounded-lg">
                Nessun allievo ancora registrato per la gamification.
              </div>
            ) : (
              studentsList.map((st) => {
                const g = st.gamification;
                const xp = g?.danceXp || 12;
                const rank = g?.levelRank || 1;
                const title = g?.levelTitle || "Apprendista d'Atelier";
                const streak = g?.currentStreak || 1;
                const punches = g?.eventPunches || 0;
                const badgesCount = g?.badges?.length || 0;

                return (
                  <div
                    key={st.id}
                    className="sketch-sm bg-white p-3.5 sm:p-4 border-2 border-ink flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs hover:border-crayon-blue transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-full border-2 border-ink overflow-hidden bg-crayon-yellow/20 flex items-center justify-center shrink-0">
                        {st.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={st.avatarUrl} alt={st.displayName} className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-display text-base font-bold text-ink">
                            {st.displayName ? st.displayName.slice(0, 2).toUpperCase() : "AL"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-base uppercase font-bold text-ink truncate">
                            {st.displayName}
                          </h4>
                          <span className="tag bg-crayon-yellow border border-ink text-[10px] font-bold">
                            Grado {rank} · {title}
                          </span>
                        </div>
                        <p className="font-hand text-xs text-ink-soft truncate">{st.email}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-hand text-ink-soft mt-1">
                          <span className="text-crayon-red font-bold">⭐ {xp} XP</span>
                          <span>🩰 Costanza: {streak} {streak === 1 ? "sett." : "sett."}</span>
                          <span>🏛️ Timbri Eventi: {punches}/10</span>
                          <span>🎖️ Encomi: {badgesCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewStudentGamification(st)}
                        className="btn !py-1.5 !px-3 text-xs font-bold border border-ink bg-paper hover:bg-paper-aged"
                        title="Visualizza il pass e libretto completo dell'allievo"
                      >
                        📖 Libretto
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForPunch(st);
                          setEventNameInput("Concorso Coreografico d'Autore");
                        }}
                        className="btn btn-yellow !py-1.5 !px-3 text-xs font-bold"
                        title="Assegna timbro per evento straordinario (gara, concorso, trasferta)"
                      >
                        🏛️ Assegna Timbro (+5 XP)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForHonor(st);
                          setHonorTitleInput("Dedizione e Virtuosismo d'Atelier");
                          setHonorDescInput("Riconoscimento al merito tecnico ed espressivo.");
                        }}
                        className="btn btn-teal !py-1.5 !px-3 text-xs font-bold text-white"
                        title="Conferisci encomio artistico speciale"
                      >
                        🎖️ Encomio (+15 XP)
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MODALE CREAZIONE CORSO */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-ink/40 p-3 sm:p-4 backdrop-blur-[2px]"
            onClick={() => setShowCreateModal(false)}
          >
            <form
              onSubmit={handleCreateCourse}
              onClick={(e) => e.stopPropagation()}
              className="sketch wobble-in relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#fff7d6] p-5 sm:p-6"
              style={{ transform: "rotate(-0.4deg)" }}
            >
              <div
                className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-[-2deg] bg-crayon-red/70"
                style={{ clipPath: "polygon(2% 0, 100% 4%, 98% 100%, 0 96%)" }}
              />

              <div className="flex items-start justify-between border-b-2 border-dashed border-ink/20 pb-3">
                <div>
                  <h3 className="font-display text-lg uppercase font-bold text-ink">
                    ✨ Configura & Crea Corso
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Inserisci i dati del corso nel catalogo didattico della scuola.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn !px-2.5 !py-0.5 text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="font-display text-[10px] uppercase tracking-wider text-ink font-bold">
                    Titolo del Corso *
                  </span>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="es. Masterclass di Chitarra Elettrica"
                    className="naive mt-0.5 !py-1 text-sm font-medium"
                    autoFocus
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="font-display text-[10px] uppercase tracking-wider text-ink font-bold">
                      Docente / Maestro
                    </span>
                    <input
                      type="text"
                      value={newInstructor}
                      onChange={(e) => setNewInstructor(e.target.value)}
                      placeholder="es. M° Mario Rossi"
                      className="naive mt-0.5 !py-1 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="font-display text-[10px] uppercase tracking-wider text-ink font-bold">
                      Categoria / Disciplina
                    </span>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="naive mt-0.5 !py-1 text-sm"
                    >
                      <option value="Musica">Musica</option>
                      <option value="Canto">Canto</option>
                      <option value="Teatro">Teatro</option>
                      <option value="Danza">Danza</option>
                      <option value="Arte">Arte & Disegno</option>
                      <option value="Lingue">Lingue</option>
                      <option value="Fotografia">Fotografia</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="font-display text-[10px] uppercase tracking-wider text-ink font-bold">
                      Quota (€ / mese)
                    </span>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="es. 75"
                      className="naive mt-0.5 !py-1 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="font-display text-[10px] uppercase tracking-wider text-ink font-bold">
                      Capienza Max Allievi
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(Number(e.target.value))}
                      className="naive mt-0.5 !py-1 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="font-display text-[10px] uppercase tracking-wider text-ink font-bold">
                      Colore Badge
                    </span>
                    <div className="mt-0.5 flex items-center gap-2">
                      <input
                        type="color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-ink p-0"
                      />
                      <span className="text-xs text-ink-soft">{newColor}</span>
                    </div>
                  </label>
                </div>

                {/* Selezione Stato: Attivo vs In Programma */}
                <div>
                  <span className="font-display text-[10px] uppercase tracking-wider text-ink font-bold">
                    Tipologia & Stato del Corso *
                  </span>
                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border-2 p-2.5 transition-colors ${
                        newStatus === "active"
                          ? "border-crayon-teal bg-crayon-teal/10"
                          : "border-ink/20 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={newStatus === "active"}
                        onChange={() => setNewStatus("active")}
                        className="mt-0.5"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-ink">Corso Attivo</div>
                        <div className="text-ink-soft text-[11px]">
                          Subito disponibile nel registro per le prenotazioni.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border-2 p-2.5 transition-colors ${
                        newStatus === "upcoming"
                          ? "border-crayon-red bg-crayon-red/10"
                          : "border-ink/20 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={newStatus === "upcoming"}
                        onChange={() => setNewStatus("upcoming")}
                        className="mt-0.5"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-ink">In Programma (Proposta)</div>
                        <div className="text-ink-soft text-[11px]">
                          Sondaggio di interesse con rating Appeal 1-10.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <label className="block">
                  <span className="font-display text-[10px] uppercase tracking-wider text-ink font-bold">
                    Descrizione Didattica / Obiettivi
                  </span>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Sintesi del programma, prerequisiti o orari indicativi..."
                    className="naive font-hand mt-0.5 !py-1 text-base"
                  />
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t-2 border-dashed border-ink/20 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn !py-1.5 !px-3 text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-red !py-1.5 !px-4 text-xs font-bold shadow-sm"
                >
                  {creating ? "Creazione in corso…" : "💾 Salva e Pubblica Corso"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODALE ASSEGNAZIONE TIMBRO EVENTO STRAORDINARIO */}
        {selectedStudentForPunch && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-ink/40 p-3 sm:p-4 backdrop-blur-[2px]"
            onClick={() => setSelectedStudentForPunch(null)}
          >
            <form
              onSubmit={handleConfirmEventPunch}
              onClick={(e) => e.stopPropagation()}
              className="sketch wobble-in relative w-full max-w-md bg-[#fffdfa] p-5 sm:p-6"
            >
              <div className="flex items-start justify-between border-b-2 border-dashed border-ink/20 pb-3">
                <div>
                  <h3 className="font-display text-base uppercase font-bold text-ink flex items-center gap-1.5">
                    <span>🏛️</span> Assegna Timbro Evento Straordinario
                  </h3>
                  <p className="font-hand text-sm text-ink-soft">
                    Allievo: <strong>{selectedStudentForPunch.displayName}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentForPunch(null)}
                  className="font-bold text-ink hover:text-crayon-red"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="font-display text-[11px] uppercase tracking-wide block mb-1 font-bold">
                    Nome Evento / Tipologia *
                  </label>
                  <input
                    type="text"
                    required
                    value={eventNameInput}
                    onChange={(e) => setEventNameInput(e.target.value)}
                    placeholder="es. Concorso Coreografico d'Autore, Gara Regionale, Trasferta Teatro, Scambio Allievi"
                    className="w-full rounded border-2 border-ink bg-paper px-3 py-2 text-xs font-medium outline-none focus:border-crayon-blue"
                  />
                </div>

                <div className="rounded bg-crayon-yellow/20 p-2.5 border border-ink/20 font-hand text-xs text-ink-soft">
                  💡 <strong>Regolamento Scuola:</strong> I timbri del passaporto sono riservati agli
                  eventi extra didattici (gare, concorsi, trasferte, scambi di allievi).
                  L&apos;assegnazione accredita automaticamente <strong>+5 XP</strong> all&apos;allievo.
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t-2 border-dashed border-ink/20 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForPunch(null)}
                  className="btn !py-1.5 !px-3 text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submittingGamification}
                  className="btn btn-yellow !py-1.5 !px-4 text-xs font-bold shadow-sm"
                >
                  {submittingGamification ? "Assegnazione…" : "✓ Conferma Timbro (+5 XP)"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODALE CONFERIMENTO ENCOMIO ARTISTICO */}
        {selectedStudentForHonor && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-ink/40 p-3 sm:p-4 backdrop-blur-[2px]"
            onClick={() => setSelectedStudentForHonor(null)}
          >
            <form
              onSubmit={handleConfirmHonor}
              onClick={(e) => e.stopPropagation()}
              className="sketch wobble-in relative w-full max-w-md bg-[#fffdfa] p-5 sm:p-6"
            >
              <div className="flex items-start justify-between border-b-2 border-dashed border-ink/20 pb-3">
                <div>
                  <h3 className="font-display text-base uppercase font-bold text-ink flex items-center gap-1.5">
                    <span>🎖️</span> Conferisci Encomio d&apos;Onore
                  </h3>
                  <p className="font-hand text-sm text-ink-soft">
                    Allievo: <strong>{selectedStudentForHonor.displayName}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentForHonor(null)}
                  className="font-bold text-ink hover:text-crayon-red"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="font-display text-[11px] uppercase tracking-wide block mb-1 font-bold">
                    Titolo del Riconoscimento *
                  </label>
                  <input
                    type="text"
                    required
                    value={honorTitleInput}
                    onChange={(e) => setHonorTitleInput(e.target.value)}
                    placeholder="es. Virtuosismo Grand Jeté, Dedizione d'Atelier"
                    className="w-full rounded border-2 border-ink bg-paper px-3 py-2 text-xs font-medium outline-none focus:border-crayon-blue"
                  />
                </div>

                <div>
                  <label className="font-display text-[11px] uppercase tracking-wide block mb-1 font-bold">
                    Motivazione Artistica del Maestro / Direzione
                  </label>
                  <textarea
                    rows={2}
                    value={honorDescInput}
                    onChange={(e) => setHonorDescInput(e.target.value)}
                    placeholder="Motivazione del merito e dell'espressione coreutica..."
                    className="w-full rounded border-2 border-ink bg-paper px-3 py-2 text-xs font-medium outline-none focus:border-crayon-blue"
                  />
                </div>

                <div>
                  <label className="font-display text-[11px] uppercase tracking-wide block mb-1 font-bold">
                    Simbolo del Distintivo
                  </label>
                  <select
                    value={honorSymbolInput}
                    onChange={(e) => setHonorSymbolInput(e.target.value)}
                    className="w-full rounded border-2 border-ink bg-paper px-3 py-2 text-xs font-medium outline-none"
                  >
                    <option value="medal">🎖️ Medaglia di Merito</option>
                    <option value="scroll">📜 Pergamena Accademica</option>
                    <option value="star">⭐ Stella di Sala</option>
                    <option value="feather">🪶 Penna d&apos;Atelier</option>
                    <option value="mask">🎭 Maschera Scenica</option>
                  </select>
                </div>

                <div className="rounded bg-crayon-teal/20 p-2.5 border border-ink/20 font-hand text-xs text-ink-soft">
                  ✨ Il conferimento accredita un bonus speciale di <strong>+15 XP</strong> e compare
                  immediatamente nel libretto didattico dell&apos;allievo.
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t-2 border-dashed border-ink/20 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForHonor(null)}
                  className="btn !py-1.5 !px-3 text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submittingGamification}
                  className="btn btn-teal !py-1.5 !px-4 text-xs font-bold text-white shadow-sm"
                >
                  {submittingGamification ? "Conferimento…" : "🎖️ Assegna Encomio (+15 XP)"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODALE ANTEPRIMA LIBRETTO ALLIEVO */}
        {previewStudentGamification && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-ink/50 p-3 sm:p-6 backdrop-blur-[2px] overflow-y-auto"
            onClick={() => setPreviewStudentGamification(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl my-auto"
            >
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => setPreviewStudentGamification(null)}
                  className="btn btn-ink text-xs font-bold shadow-sketch"
                >
                  ✕ Chiudi Libretto
                </button>
              </div>
              <StudentGamificationCard
                student={previewStudentGamification}
                onRefresh={loadAll}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
