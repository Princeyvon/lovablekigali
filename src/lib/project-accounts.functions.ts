import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PLATFORMS = [
  "Lovable",
  "Google AI Studio",
  "Manus",
  "GitHub",
  "Supabase",
  "Vercel",
  "Other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export type ProjectAccountInput = {
  id?: string;
  project_id: string;
  platform: string;
  email?: string;
  username?: string;
  url?: string;
  password?: string;
  notes?: string;
  lovable_account_id?: string | null;
};

/** Create or update a platform account attached to a project. */
export const saveProjectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProjectAccountInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row: Record<string, unknown> = {
      project_id: data.project_id,
      platform: data.platform,
      email: data.email || null,
      username: data.username || null,
      url: data.url || null,
      notes: data.notes || null,
      lovable_account_id: data.lovable_account_id || null,
    };
    if (data.password) {
      const { encryptSecret } = await import("./vault-crypto.server");
      row.encrypted_password = await encryptSecret(data.password);
    }
    const res = data.id
      ? await supabase.from("project_accounts").update(row).eq("id", data.id).select("id").single()
      : await supabase
          .from("project_accounts")
          .insert({ ...row, created_by: userId })
          .select("id")
          .single();
    if (res.error) throw new Error(res.error.message);
    return { id: res.data.id };
  });

/** Decrypt one stored platform password. */
export const revealProjectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { decryptSecret } = await import("./vault-crypto.server");
    const { data: row, error } = await context.supabase
      .from("project_accounts")
      .select("id, encrypted_password, lovable_account_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    let payload = row.encrypted_password;
    if (!payload && row.lovable_account_id) {
      const linked = await context.supabase
        .from("lovable_accounts")
        .select("encrypted_password")
        .eq("id", row.lovable_account_id)
        .maybeSingle();
      payload = linked.data?.encrypted_password ?? null;
    }
    return { password: payload ? await decryptSecret(payload) : "" };
  });

export const deleteProjectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("project_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
