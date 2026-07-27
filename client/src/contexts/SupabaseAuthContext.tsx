import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Return the boolean directly so we can wait for it
  const checkAdminStatus = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Admin check error:", error.message);
        return false;
      }
      return !!data;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // onAuthStateChange handles the initial load automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true); // Keep or set loading state while validating
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          const adminResult = await checkAdminStatus(currentUser.id);
          setIsAdmin(adminResult);
        } else {
          setIsAdmin(false);
        }
        
        // Only stop loading once ALL data (user + admin status) is resolved
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
  };

  const signOut = async () => {
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, error, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  }
  return context;
}