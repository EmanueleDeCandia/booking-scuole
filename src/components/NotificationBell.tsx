"use client";

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import type { NotificationDTO } from "@/lib/agenda";
import { useToast } from "./Toasts";

const POLL_MS = 40_000;

const kindIcon: Record<string, string> = {
  reminder: "⏰",
  created: "✎",
  cancelled: "✕",
  done: "✓",
  updated: "↻",
};

interface NotificationContextType {
  items: NotificationDTO[];
  unread: number;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  perm: NotificationPermission | "unsupported";
  askPermission: () => Promise<void>;
  markAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const seenRef = useRef<Set<number> | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: NotificationDTO[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);

      // Notifica nuovi promemoria (toast + Notification API)
      if (seenRef.current === null) {
        seenRef.current = new Set(data.items.map((i) => i.id));
      } else {
        for (const n of data.items) {
          if (!seenRef.current.has(n.id)) {
            seenRef.current.add(n.id);
            if (n.kind === "reminder") {
              toast.push({ title: n.title, message: n.message, tone: "red" });
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                try {
                  new Notification(n.title, { body: n.message });
                } catch {
                  /* ignore */
                }
              }
            }
          }
        }
      }
    } catch {
      /* offline */
    }
  }, [toast]);

  useEffect(() => {
    if (typeof Notification === "undefined") setPerm("unsupported");
    else setPerm(Notification.permission);
    load();
    const t = setInterval(load, POLL_MS);
    const onRefresh = () => load();
    window.addEventListener("bookings:changed", onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("bookings:changed", onRefresh);
    };
  }, [load]);

  const markAll = async () => {
    await fetch("/api/notifications", { method: "PATCH", body: JSON.stringify({}) });
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") toast.push({ title: "Promemoria attivi", message: "Riceverai le notifiche del browser.", tone: "teal" });
  };

  return (
    <NotificationContext.Provider
      value={{
        items,
        unread,
        open,
        setOpen,
        perm,
        askPermission,
        markAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}

/**
 * Pulsante campanella da inserire nell'header (desktop e mobile).
 * Cliccandolo apre/chiude la sezione Notifiche a tutta larghezza.
 */
export function NotificationBell() {
  const { unread, open, setOpen } = useNotifications();

  return (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className={`btn relative !px-2.5 !py-1.5 sm:!px-3 sm:!py-2 transition-all ${
        open ? "btn-ink border-2 border-ink" : ""
      }`}
      aria-label="Notifiche e promemoria"
      title="Mostra notifiche e promemoria"
    >
      <span className="text-base sm:text-lg leading-none">🔔</span>
      {unread > 0 && (
        <span className="font-hand absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-crayon-red px-1 text-xs text-white">
          {unread}
        </span>
      )}
    </button>
  );
}

/**
 * Sezione a tutta larghezza che compare direttamente sotto l'header,
 * spingendo verso il basso il resto della pagina in modo simmetrico e pulito.
 */
export function NotificationPanel() {
  const { items, unread, open, setOpen, perm, askPermission, markAll } = useNotifications();

  if (!open) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 pb-5 sm:px-8 wobble-in transition-all">
      <div className="sketch bg-paper-aged border-2 border-ink p-3.5 sm:p-5 shadow-xl w-full">
        {/* Intestazione della sezione Notifiche */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-ink/30 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="sketch-sm grid h-9 w-9 sm:h-10 sm:w-10 place-items-center bg-crayon-yellow text-xl sm:text-2xl">
              🔔
            </span>
            <div>
              <div className="font-display text-base sm:text-xl font-bold uppercase tracking-wide">
                Notifiche &amp; Promemoria
              </div>
              <div className="font-hand text-sm sm:text-base text-ink-soft">
                {unread > 0 ? (
                  <span className="text-crayon-red font-bold">{unread} non lette</span>
                ) : (
                  "Tutti i promemoria sono stati letti"
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {perm === "default" && (
              <button
                type="button"
                onClick={askPermission}
                className="tag !text-xs !py-1 !px-2.5 bg-crayon-yellow hover:scale-105 font-bold shadow-xs cursor-pointer"
              >
                Attiva Push Browser
              </button>
            )}
            {items.length > 0 && unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="tag !text-xs !py-1 !px-2.5 bg-white hover:scale-105 border border-ink/30 font-semibold cursor-pointer"
              >
                Segna tutte lette
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn !px-3 !py-1 text-xs sm:text-sm font-bold border-2 border-ink hover:bg-crayon-red hover:text-white"
              aria-label="Chiudi notifiche"
            >
              ✕ Chiudi
            </button>
          </div>
        </div>

        {/* Lista notifiche a tutta larghezza, responsiva a griglia */}
        <div className="mt-4 max-h-[420px] overflow-y-auto pr-1 scroll-thin">
          {items.length === 0 ? (
            <div className="font-hand p-8 text-center text-xl sm:text-2xl text-ink-soft">
              Nessuna notifica… ancora ✎
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`sketch-sm p-3.5 border-2 border-ink transition-all ${
                    n.read
                      ? "bg-white/70 opacity-75"
                      : n.kind === "reminder"
                      ? "bg-crayon-yellow/80 border-crayon-red shadow-sm"
                      : "bg-white shadow-xs"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl sm:text-2xl shrink-0 mt-0.5">
                      {kindIcon[n.kind] ?? "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-xs uppercase font-bold tracking-wider truncate text-ink">
                        {n.title}
                      </div>
                      <div className="font-hand text-base sm:text-lg leading-tight mt-1 break-words text-ink">
                        {n.message}
                      </div>
                      <div className="mt-2 text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-ink-soft">
                        {new Date(n.createdAt).toLocaleString("it-IT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
