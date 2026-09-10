"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registrato con successo:", reg.scope);
        })
        .catch((err) => {
          console.warn("Errore registrazione PWA Service Worker:", err);
        });
    }
  }, []);

  return null;
}
