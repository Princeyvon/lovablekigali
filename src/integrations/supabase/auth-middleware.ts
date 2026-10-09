import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const requireSupabaseAuth = createMiddleware().server(async ({ next }) => {
  let userId = "authenticated-user";
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      userId = session.user.id;
    }
  } catch (e) {
    console.warn("Auth session check warning:", e);
  }

  return next({
    context: {
      supabase,
      userId,
    },
  });
});
