"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, googleProvider, isLiveFirebaseConfigured } from "../lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut
} from "firebase/auth";

const AuthContext = createContext({
  user: null,
  isAdmin: false,
  loading: true,
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {}
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Configure whitelisted admin emails (Reads from .env.local or defaults to standard fallback emails)
  const ADMIN_EMAILS = [
    process.env.NEXT_PUBLIC_ADMIN_EMAIL_1?.toLowerCase() || "admin@conciergebooks.ng",
    process.env.NEXT_PUBLIC_ADMIN_EMAIL_2?.toLowerCase() || "admin2@conciergebooks.ng"
  ].filter(Boolean);

  useEffect(() => {
    if (isLiveFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email.split("@")[0],
            photoURL: firebaseUser.photoURL
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Authentication is unavailable until a real Firebase project is configured.
      setUser(null);
      setLoading(false);
    }
  }, []);

  // Strict exact-match verification against authorized Firebase user emails.
  const isAdmin = Boolean(
    user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  );

  const loginWithEmail = async (email, password) => {
    if (!isLiveFirebaseConfigured || !auth) {
      throw new Error("Firebase authentication is not configured for this environment.");
    }
    const res = await signInWithEmailAndPassword(auth, email, password);
    return res.user;
  };

  const signupWithEmail = async (email, password, displayName) => {
    if (!isLiveFirebaseConfigured || !auth) {
      throw new Error("Firebase authentication is not configured for this environment.");
    }
    const res = await createUserWithEmailAndPassword(auth, email, password);
    return res.user;
  };

  const loginWithGoogle = async () => {
    if (!isLiveFirebaseConfigured || !auth) {
      throw new Error("Firebase authentication is not configured for this environment.");
    }
    const res = await signInWithPopup(auth, googleProvider);
    return res.user;
  };

  const logout = async () => {
    if (isLiveFirebaseConfigured && auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
