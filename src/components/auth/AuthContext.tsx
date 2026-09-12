"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile as fbUpdateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import type { UserDTO } from "@/lib/agenda";

type AuthContextType = {
  user: UserDTO | null;
  firebaseUser: FirebaseUser | null;
  role: "user" | "manager";
  loading: boolean;
  isFirebaseReady: boolean;
  signIn: (email: string, pass: string) => Promise<UserDTO | null>;
  signUp: (email: string, pass: string, name: string, phone?: string, role?: "user" | "manager") => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateCurrentUser: (patch: Partial<UserDTO>) => void;
  loginAsDemo: (role: "user" | "manager", managerPassword?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const updateCurrentUser = (patch: Partial<UserDTO>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : null));
  };

  const syncUserWithBackend = async (
    fbU: FirebaseUser | { uid: string; email: string; displayName?: string },
    extra?: { phone?: string; role?: "user" | "manager"; avatarUrl?: string; managerKey?: string }
  ) => {
    try {
      let idToken: string | undefined;
      if ("getIdToken" in fbU && typeof fbU.getIdToken === "function") {
        idToken = await fbU.getIdToken();
      }

      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          uid: fbU.uid,
          email: fbU.email,
          displayName: fbU.displayName || extra?.phone || fbU.email?.split("@")[0],
          phone: extra?.phone,
          avatarUrl: extra?.avatarUrl,
          role: extra?.role,
          managerKey: extra?.managerKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore sincronizzazione backend");
      }

      setUser(data.user);
      return data.user;
    } catch (e: any) {
      console.error("Errore sincronizzazione backend:", e);
      throw e;
    }
  };

  const refreshProfile = async () => {
    try {
      const res = await fetch("/api/auth/sync");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      }
    } catch (e) {
      console.error("Errore refreshProfile:", e);
    }
  };

  useEffect(() => {
    // 1. Controlla prima se c'è già una sessione attiva da cookie
    refreshProfile().finally(() => {
      // 2. Se Firebase è configurato, ascolta il cambio di stato
      if (isFirebaseConfigured && auth) {
        const unsubscribe = onAuthStateChanged(auth, async (fbU) => {
          setFirebaseUser(fbU);
          if (fbU && fbU.email) {
            await syncUserWithBackend(fbU);
          }
          setLoading(false);
        });
        return () => unsubscribe();
      } else {
        setLoading(false);
      }
    });
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();

      // 1. Controlla prima se l'utente esiste nel database della scuola
      const checkRes = await fetch(`/api/auth/sync?email=${encodeURIComponent(cleanEmail)}`);
      const checkData = checkRes.ok ? await checkRes.json() : null;

      if (!checkData?.user) {
        throw new Error("Nessun account trovato con questa email. Clicca su 'Iscriviti ora' per creare il profilo.");
      }

      // 2. Se Firebase Auth è attivo e supportato, proviamo l'accesso
      if (isFirebaseConfigured && auth) {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
          return await syncUserWithBackend(cred.user);
        } catch (fbErr: any) {
          console.warn("Firebase Auth signIn fallback to database session:", fbErr?.code || fbErr?.message);
        }
      }

      // 3. Accesso garantito per l'utente verificato nel database della scuola!
      return await syncUserWithBackend(
        { uid: checkData.user.id, email: cleanEmail, displayName: checkData.user.displayName },
        { role: checkData.user.role, phone: checkData.user.phone }
      );
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    pass: string,
    displayName: string,
    phone?: string,
    role: "user" | "manager" = "user"
  ) => {
    setLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();

      // 1. Verifica preliminare: rifiuta se l'email esiste già nel database
      const checkRes = await fetch(`/api/auth/sync?email=${encodeURIComponent(cleanEmail)}`);
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData?.user) {
          throw new Error("Un account con questa email è già registrato. Effettua l'accesso.");
        }
      }

      // 2. Se Firebase Auth è disponibile, tenta la registrazione anche su Firebase Auth
      if (isFirebaseConfigured && auth) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
          if (displayName) {
            await fbUpdateProfile(cred.user, { displayName });
          }
          await syncUserWithBackend(cred.user, { phone, role });
          return;
        } catch (fbErr: any) {
          console.warn("Firebase Auth signUp note (using database storage):", fbErr?.code || fbErr?.message);
          if (fbErr?.code === "auth/email-already-in-use") {
            throw new Error("Un account con questa email è già registrato. Effettua il login.");
          }
        }
      }

      // 3. Registrazione nel database Firestore
      const mockUid = `user-${cleanEmail.replace(/[^a-z0-9]/g, "-")}`;
      await syncUserWithBackend(
        { uid: mockUid, email: cleanEmail, displayName },
        { phone, role }
      );
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error("Firebase non è ancora configurato con le credenziali API.");
    }
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await syncUserWithBackend(cred.user);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        await fbSignOut(auth);
      }
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setFirebaseUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemo = async (targetRole: "user" | "manager", managerPassword?: string) => {
    setLoading(true);
    try {
      const mockEmail = targetRole === "manager" ? "gestore@scuola.it" : "allievo.danza@esempio.it";
      const mockName = targetRole === "manager" ? "Elena (Gestore Didattico)" : "Elena Rossi (Allieva)";
      const mockUid = targetRole === "manager" ? "manager-demo-01" : "student-demo-01";
      const mockPhone = targetRole === "manager" ? "+39 340 1234567" : "+39 340 9876543";

      await syncUserWithBackend(
        { uid: mockUid, email: mockEmail, displayName: mockName },
        { role: targetRole, phone: mockPhone, managerKey: managerPassword }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role: user?.role ?? "user",
        loading,
        isFirebaseReady: isFirebaseConfigured,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
        updateCurrentUser,
        loginAsDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
