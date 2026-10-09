import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRINCE_MEMBER_ID } from "@/lib/pipeline-store";

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
  const [role, setRole] = useState<UserRole>("admin");
  const [memberId, setMemberId] = useState<string | null>(PRINCE_MEMBER_ID);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          if (isMounted) {
            setUser({
              id: session.user.id,
              email: session.user.email ?? "admin@lovable.dev",
            });
          }

          // Check team_members
          const { data: member } = await supabase
            .from("team_members")
            .select("id, role")
            .or(`user_id.eq.${session.user.id},email.eq.${session.user.email}`)
            .maybeSingle();

          if (member && isMounted) {
            setRole((member.role as UserRole) || "admin");
            setMemberId(member.id);
          } else if (isMounted) {
            // Default to admin for full operational control
            setRole("admin");
            setMemberId(PRINCE_MEMBER_ID);
          }
        } else if (isMounted) {
          // Dev default fallback user
          setUser({
            id: "u-admin-default",
            email: "admin@lovable.dev",
          });
          setRole("admin");
          setMemberId(PRINCE_MEMBER_ID);
        }
      } catch (e) {
        console.warn("useAuth error:", e);
        if (isMounted) {
          setRole("admin");
          setMemberId(PRINCE_MEMBER_ID);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? "admin@lovable.dev",
        });
      } else {
        setUser({
          id: "u-admin-default",
          email: "admin@lovable.dev",
        });
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
  };

  return {
    user,
    role,
    memberId,
    isLoading,
    signOut,
  };
}
