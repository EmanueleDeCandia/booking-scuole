"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; title: string; message?: string; tone?: "red" | "teal" | "yellow" | "ink" };

type ToastCtx = {
  push: (t: Omit<Toast, "id">) => void;
  show: (title: string, tone?: "red" | "teal" | "yellow" | "ink" | "info" | "error") => void;
};

const Ctx = createContext<ToastCtx>({ push: () => {}, show: () => {} });

export function useToast() {
  return useContext(Ctx);
}

const toneBg: Record<NonNullable<Toast["tone"]>, string> = {
  red: "bg-crayon-red text-white",
  teal: "bg-crayon-teal text-ink",
  yellow: "bg-crayon-yellow text-ink",
  ink: "bg-ink text-white",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const show = useCallback((title: string, tone?: "red" | "teal" | "yellow" | "ink" | "info" | "error") => {
    const mappedTone: Toast["tone"] = tone === "info" ? "teal" : tone === "error" ? "red" : (tone as any) ?? "yellow";
    push({ title, tone: mappedTone });
  }, [push]);

  const value = useMemo(() => ({ push, show }), [push, show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[320px] max-w-[92vw] flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto sketch-sm px-4 py-3 ${toneBg[t.tone ?? "yellow"]}`}
            style={{ transform: "rotate(-1deg)" }}
          >
            <div className="font-display text-sm uppercase">{t.title}</div>
            {t.message && <div className="font-hand mt-1 text-lg leading-tight">{t.message}</div>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
