import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Store a Lovable account password encrypted at rest. */
export const saveAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    const { encryptSecret } = await import("./vault-crypto.server");
    const encrypted_password = await encryptSecret(data.password);
    const { error } = await context.supabase
      .from("lovable_accounts")
      .update({ encrypted_password })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revealAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { decryptSecret } = await import("./vault-crypto.server");
    const { data: row, error } = await context.supabase
      .from("lovable_accounts")
      .select("id, encrypted_password")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { password: row.encrypted_password ? await decryptSecret(row.encrypted_password) : "" };
  });
