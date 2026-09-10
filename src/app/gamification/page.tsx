"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";

export default function GamificationPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user?.role === "manager") {
        router.replace("/profilo#gamification-manager");
      } else {
        router.replace("/profilo#gamification");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="mx-auto max-w-4xl p-12 text-center">
      <div className="font-hand text-2xl text-ink animate-pulse">
        Caricamento Percorso Artistico &amp; Gamification… 🏅
      </div>
    </div>
  );
}
