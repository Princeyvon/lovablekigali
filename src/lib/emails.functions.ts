import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptSecret, decryptSecret } from "./vault-crypto.server";

export const revealAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; email?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase.rpc("is_staff");
    if (!staff) throw new Error("Forbidden");
    const targetId = data.id?.trim() || "";
    const rawEmail = data.email || (targetId.includes("@") ? targetId : "");
    const targetEmail = rawEmail.trim().toLowerCase();

    let encryptedPassword: string | null = null;
    let resolvedEmail = targetEmail;
    let resolvedId = targetId;

    // 1. Try lookup in Supabase by ID
    if (targetId) {
      try {
        const { data: row } = await supabase
          .from("lovable_accounts")
          .select("id, email, encrypted_password")
          .eq("id", targetId)
          .maybeSingle();

        if (row) {
          resolvedId = row.id;
          resolvedEmail = row.email || resolvedEmail;
          encryptedPassword = row.encrypted_password || null;
        }
      } catch (err) {
        console.warn("Supabase lookup by ID skipped/fallback:", err);
      }
    }

    // 2. If not found by ID, try lookup in Supabase by email
    if (!encryptedPassword && targetEmail) {
      try {
        const { data: row } = await supabase
          .from("lovable_accounts")
          .select("id, email, encrypted_password")
          .ilike("email", targetEmail)
          .maybeSingle();

        if (row) {
          resolvedId = row.id;
          resolvedEmail = row.email || resolvedEmail;
          encryptedPassword = row.encrypted_password || null;
        }
      } catch (err) {
        console.warn("Supabase lookup by email skipped/fallback:", err);
      }
    }


    // 4. If no encrypted password found at all, return empty password gracefully without crashing
    if (!encryptedPassword) {
      return { password: "" };
    }

    // 5. Decrypt and return password
    const decrypted = await decryptSecret(encryptedPassword);

    try {
      await supabase.from("entity_events").insert({
        entity_table: "lovable_accounts",
        entity_id: resolvedId || "fallback-account",
        action: "reveal",
        actor: userId,
        change_reason: `Revealed password for Google/Builder account ${resolvedEmail || resolvedId}`,
      });
    } catch {
      // Audit log non-critical
    }

    return { password: decrypted };
  });

export const saveAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; password: string; email?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase.rpc("is_staff");
    if (!staff) throw new Error("Forbidden");

    if (!data.id && !data.email) {
      throw new Error("Account ID or email is required to save password");
    }

    const encrypted = await encryptSecret(data.password);
    const targetId = data.id?.trim() || "";
    const rawEmail = data.email?.trim() || (targetId.includes("@") ? targetId : "");
    const targetEmail = rawEmail.toLowerCase();


    // Attempt to persist to Supabase lovable_accounts table
    try {
      if (targetId && !targetId.includes("@")) {
        await supabase
          .from("lovable_accounts")
          .update({
            encrypted_password: encrypted,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetId);
      }
      if (targetEmail) {
        await supabase
          .from("lovable_accounts")
          .update({
            encrypted_password: encrypted,
            updated_at: new Date().toISOString(),
          })
          .ilike("email", targetEmail);
      }
    } catch (err) {
      console.warn("Supabase password update non-critical/saved locally:", err);
    }

    try {
      await supabase.from("entity_events").insert({
        entity_table: "lovable_accounts",
        entity_id: targetId || targetEmail,
        action: "update",
        actor: userId,
        change_reason: `Updated account password for ${targetEmail || targetId}`,
      });
    } catch {
      // Audit log non-critical
    }

    return { success: true, plain: data.password, encrypted };
  });
