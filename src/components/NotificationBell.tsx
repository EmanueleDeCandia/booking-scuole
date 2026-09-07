"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationDTO } from "@/lib/agenda";
import { useToast } from "./Toasts";

const POLL_MS = 20_000;

const kindIcon: Record<string, string> = {
  reminder: "⏰",
  created: "✎",
  cancelled: "✕",
  done: "✓",
  updated: "↻",
};

export function NotificationBell() {
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
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn relative !px-3"
        aria-label="Notifiche"
        title="Notifiche e promemoria"
      >
        <span className="text-lg leading-none">🔔</span>
        {unread > 0 && (
          <span className="font-hand absolute -top-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-ink bg-crayon-red px-1 text-sm text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="sketch wobble-in absolute right-0 z-50 mt-3 w-[340px] max-w-[90vw] p-3">
          <div className="flex items-center justify-between gap-2 border-b-2 border-dashed border-ink pb-2">
            <div className="font-display text-sm uppercase">Promemoria</div>
            <div className="flex gap-2">
              {perm === "default" && (
                <button onClick={askPermission} className="tag bg-crayon-yellow hover:rotate-1">
                  attiva browser
                </button>
              )}
              <button onClick={markAll} className="tag bg-white hover:rotate-1">
                segna lette
              </button>
            </div>
          </div>
          <ul className="scroll-thin mt-2 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {items.length === 0 && (
              <li className="font-hand p-4 text-center text-xl text-ink-soft">Nessuna notifica… ancora ✎</li>
            )}
            {items.map((n) => (
              <li
                key={n.id}
                className={`sketch-sm px-3 py-2 ${n.read ? "bg-white/70 opacity-70" : n.kind === "reminder" ? "bg-crayon-yellow/70" : "bg-white"}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{kindIcon[n.kind] ?? "•"}</span>
                  <div className="min-w-0">
                    <div className="font-display text-[11px] uppercase">{n.title}</div>
                    <div className="font-hand text-base leading-tight">{n.message}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-soft">
                      {new Date(n.createdAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
