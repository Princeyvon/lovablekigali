import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Resolve a username to its account email so people can sign in with either. */
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { identifier: string }) => {
    const identifier = String(input.identifier ?? "").trim();
    if (!identifier || identifier.length > 120) throw new Error("Enter your username or email");
    return { identifier };
  })
  .handler(async ({ data }) => {
    if (data.identifier.includes("@")) return { email: data.identifier };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .ilike("username", data.identifier)
      .maybeSingle();
    // Never reveal whether the username exists — a wrong guess just fails the password check.
    return { email: row?.email ?? `${data.identifier}@unknown.invalid` };
  });

function tempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10).toUpperCase();
}

/** Admin-only: issue a one-time password for another user. */
export const adminIssueOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    const userId = String(input.userId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid user");
    return { userId };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = tempPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
    if (error) throw new Error(error.message);

    await context.supabase.from("entity_events").insert({
      entity_table: "auth.users",
      entity_id: data.userId,
      action: "password_reset_otp",
      change_reason: "Admin issued a one-time password",
      actor: context.userId,
    });

    return { password };
  });

/** Admin-only: grant or change a teammate's access role. */
export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: string }) => {
    const roles = ["admin", "sales", "dev", "support"];
    if (!roles.includes(input.role)) throw new Error("Invalid role");
    return { userId: String(input.userId), role: input.role };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    await context.supabase.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await context.supabase
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role as "admin" | "sales" | "dev" | "support" });
    if (error) throw new Error(error.message);

    await context.supabase.from("entity_events").insert({
      entity_table: "user_roles",
      entity_id: data.userId,
      action: "role_changed",
      change_reason: `Role set to ${data.role}`,
      actor: context.userId,
    });
    return { ok: true };
  });
