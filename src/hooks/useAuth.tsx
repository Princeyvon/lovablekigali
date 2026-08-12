import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "sales" | "dev" | "support";

type AuthState = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  memberId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  role: null,
  memberId: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setRole(null);
        setMemberId(null);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      const { data: bootstrapped } = await supabase.rpc("bootstrap_me");
      const { data: memberRow } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setRole((bootstrapped as AppRole | null) ?? "sales");
      setMemberId(memberRow?.id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    role,
    memberId,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
