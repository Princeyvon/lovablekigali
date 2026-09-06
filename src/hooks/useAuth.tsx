import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { canAccess } from "@/lib/access";

export type AppRole = "admin" | "sales" | "dev" | "support";

type AuthState = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  memberId: string | null;
  loading: boolean;
  active: boolean;
  denied: Set<string>;
  can: (pageKey: string) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  role: null,
  memberId: null,
  loading: true,
  active: true,
  denied: new Set<string>(),
  can: () => true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [denied, setDenied] = useState<Set<string>>(new Set());
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
      const meta = session.user.user_metadata ?? {};
      if (meta['username'] || meta['full_name']) {
        await supabase
          .from("profiles")
          .update({ username: meta['username'] ?? null, full_name: meta['full_name'] ?? null })
          .eq("id", session.user.id)
          .is("username", null);
      }
      const { data: bootstrapped } = await supabase.rpc("bootstrap_me");

      const { data: memberRow } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", session.user.id)
        .maybeSingle();
      const { data: accessRows } = await supabase
        .from("user_page_access")
        .select("page_key, allowed")
        .eq("user_id", session.user.id);
      if (cancelled) return;
      setRole((bootstrapped as AppRole | null) ?? "sales");
      setMemberId(memberRow?.id ?? null);
      setActive(profileRow?.is_active ?? true);
      setDenied(new Set((accessRows ?? []).filter((r) => !r.allowed).map((r) => r.page_key)));
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
    active,
    denied,
    can: (pageKey: string) => canAccess(pageKey, role, denied),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
