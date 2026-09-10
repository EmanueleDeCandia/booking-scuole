"use client";

import React from "react";
import {
  calculateGamificationLevel,
  type GamificationProfile,
  type StudentBadge,
} from "@/lib/agenda";

interface StudentGamificationCardProps {
  student: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
    gamification?: GamificationProfile;
  };
  onRefresh?: () => void;
}

const badgeSymbols: Record<string, string> = {
  palette: "🎨",
  star: "⭐",
  feather: "🪶",
  mask: "🎭",
  medal: "🎖️",
  scroll: "📜",
  ribbon: "🎗️",
};

export function StudentGamificationCard({ student }: StudentGamificationCardProps) {
  const g = student.gamification || {
    danceXp: 12,
    levelRank: 1,
    levelTitle: "Apprendista d'Atelier",
    currentStreak: 1,
    longestStreak: 1,
    eventPunches: 0,
    eventLogs: [],
    badges: [],
  };

  const levelInfo = calculateGamificationLevel(g.danceXp);
  const badges: StudentBadge[] = Array.isArray(g.badges) && g.badges.length > 0 ? g.badges : [];
  const eventPunches = typeof g.eventPunches === "number" ? g.eventPunches : 0;

  return (
    <div className="sketch bg-paper-aged border-2 border-ink p-5 sm:p-7 shadow-lg relative overflow-hidden text-ink">
      {/* Intestazione del Pass d'Artista */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-dashed border-ink/20 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag bg-crayon-yellow border border-ink text-xs font-bold uppercase tracking-wider shadow-xs">
              Grado {levelInfo.rank} · {levelInfo.title}
            </span>
            <span className="font-hand text-sm text-ink-soft">Libretto Didattico d&apos;Artista</span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl mt-1 tracking-tight">
            {student.displayName}
          </h3>
          <p className="font-hand text-base text-ink-soft">{student.email}</p>
        </div>

        {/* Indicatore Costanza Settimanale Naïve */}
        <div className="sketch-sm bg-white border-2 border-ink px-3.5 py-2 text-right shadow-xs">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-xl">🩰</span>
            <span className="font-display text-lg font-bold leading-none">
              {g.currentStreak} {g.currentStreak === 1 ? "Settimana" : "Settimane"}
            </span>
          </div>
          <div className="font-hand text-xs text-ink-soft tracking-wide mt-0.5">
            Costanza di Frequenza in Sala
          </div>
        </div>
      </div>

      {/* Sezione XP & Barra Progressione Gradi */}
      <div className="mt-5 rounded-xl bg-white/80 border-2 border-ink p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between text-xs gap-2 mb-2">
          <span className="font-display uppercase tracking-wider text-xs flex items-center gap-1.5">
            <span>⭐</span>
            <span>Esperienza Artistica:</span>
            <strong className="text-crayon-red text-sm font-bold">{g.danceXp} XP</strong>
          </span>
          <span className="font-hand text-sm text-ink-soft">
            Prossimo Grado a: <strong className="text-ink">{levelInfo.nextLevelXp} XP</strong>
          </span>
        </div>

        {/* Barra di avanzamento a pastello */}
        <div className="w-full bg-paper border border-ink/40 rounded-full h-3.5 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full transition-all duration-700 bg-crayon-teal border-r border-ink/60 shadow-xs"
            style={{ width: `${levelInfo.progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[11px] font-hand text-ink-soft mt-1.5">
          <span>{levelInfo.title}</span>
          <span>{levelInfo.progressPercent}% completato</span>
        </div>
      </div>

      {/* Passaporto Eventi Straordinari (Gare, Concorsi, Trasferte, Scambi) */}
      <div className="mt-5 sketch-sm bg-white p-4 sm:p-5 border-2 border-ink shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏛️</span>
            <div>
              <h4 className="font-display text-sm sm:text-base uppercase tracking-wide">
                Passaporto Eventi Straordinari ({eventPunches} / 10)
              </h4>
              <p className="font-hand text-xs text-ink-soft">
                Timbri speciali per: Gare, Concorsi, Trasferte e Scambi di Allievi
              </p>
            </div>
          </div>
          <span className="tag bg-paper-aged border border-ink text-xs font-bold">
            {eventPunches >= 10 ? "🎉 Masterclass Sbloccata!" : `${10 - eventPunches} eventi al premio`}
          </span>
        </div>

        {/* 10 Caselle Timbro Stile Taccuino Naïve */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mt-3">
          {Array.from({ length: 10 }).map((_, i) => {
            const isPunched = i < eventPunches;
            return (
              <div
                key={i}
                className={`h-11 rounded-lg flex flex-col items-center justify-center border-2 transition-all ${
                  isPunched
                    ? "bg-crayon-yellow/90 border-ink shadow-xs rotate-[-2deg]"
                    : "bg-paper border-dashed border-ink/40 text-ink-soft"
                }`}
                title={
                  isPunched
                    ? `Evento ${i + 1} convalidato dalla Direzione`
                    : `Slot ${i + 1}: Partecipa a un concorso, gara o trasferta`
                }
              >
                {isPunched ? (
                  <>
                    <span className="text-sm font-bold leading-none text-ink">✓</span>
                    <span className="font-hand text-[9px] uppercase font-bold text-ink-soft leading-none mt-0.5">
                      Timbro
                    </span>
                  </>
                ) : (
                  <span className="font-hand text-xs font-bold opacity-60">{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 text-xs font-hand text-ink-soft border-t border-dashed border-ink/20 pt-2 flex items-center gap-1.5">
          <span>🎁</span>
          <span>
            <strong>Premio di Merito:</strong> Al completamento dei 10 timbri straordinari,
            l&apos;Accademia assegna una Masterclass Gratuita di Tecnica e Interpretazione d&apos;Autore.
          </span>
        </div>
      </div>

      {/* Riconoscimenti & Encomi Artistici */}
      <div className="mt-5">
        <h4 className="font-display text-xs sm:text-sm uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <span>🎖️</span>
          <span>Riconoscimenti &amp; Distintivi d&apos;Onore ({badges.length})</span>
        </h4>

        {badges.length === 0 ? (
          <div className="sketch-sm bg-white/70 p-4 text-center font-hand text-sm text-ink-soft border-2 border-dashed border-ink/30">
            Nessun encomio ancora registrato. Partecipa alle lezioni ed eventi per ottenere i distintivi del Maestro!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {badges.map((b) => (
              <div
                key={b.id}
                className="sketch-sm bg-white p-3 border-2 border-ink shadow-xs hover:-rotate-1 transition-transform"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl shrink-0">
                    {badgeSymbols[b.symbol || "feather"] || "🪶"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xs uppercase font-bold truncate text-ink">
                      {b.title}
                    </p>
                    <p className="font-hand text-xs text-ink-soft leading-snug line-clamp-2 mt-0.5">
                      {b.desc}
                    </p>
                    <p className="text-[10px] font-hand text-ink-soft/70 uppercase mt-1">
                      Conferito: {b.earnedAt}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
