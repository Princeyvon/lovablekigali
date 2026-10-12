import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "sales" | "dev" | "support";

export interface AuthState {
  user: {
    id: string;
    email: string;
  } | null;
  role: UserRole;
  memberId: string | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [role, setRole] = useState<UserRole>("sales");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadRoleFor(userId: string, email: string) {
      const { data: member } = await supabase
        .from("team_members")
        .select("id, role")
        .or(`user_id.eq.${userId},email.eq.${email}`)
        .maybeSingle();

      if (!isMounted) return;
      if (member) {
        setRole((member.role as UserRole) || "sales");
        setMemberId(member.id);
      } else {
        setRole("sales");
        setMemberId(null);
      }
    }

    async function loadUser() {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (authUser) {
          const email = authUser.email ?? "";
          setUser({ id: authUser.id, email });
          await loadRoleFor(authUser.id, email);
        } else {
          setUser(null);
          setRole("sales");
          setMemberId(null);
        }
      } catch (e) {
        console.warn("useAuth error:", e);
        if (isMounted) {
          setUser(null);
          setRole("sales");
          setMemberId(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (!isMounted) return;
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? "",
        });
        void loadRoleFor(session.user.id, session.user.email ?? "");
      } else {
        setUser(null);
        setRole("sales");
        setMemberId(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    setUser(null);
    setRole("sales");
    setMemberId(null);
  };

  return {
    user,
    role,
    memberId,
    isLoading,
    signOut,
  };
}
