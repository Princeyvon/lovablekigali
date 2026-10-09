import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptSecret, decryptSecret } from "./vault-crypto.server";

export const revealCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("client_credentials")
      .select("id, client_id, service_name, encrypted_password")
      .eq("id", data.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!row) {
      throw new Error("Credential not found");
    }

    const decrypted = row.encrypted_password ? await decryptSecret(row.encrypted_password) : "";

    try {
      await supabase.from("credential_access_log").insert({
        credential_id: row.id,
        accessed_by: userId,
      });
    } catch {
      // Non-critical audit log
    }

    return { password: decrypted };
  });

export const saveCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      client_id: string;
      service_name: string;
      username?: string;
      password?: string;
      notes?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const encrypted_password = data.password ? await encryptSecret(data.password) : undefined;

    const payload: Record<string, unknown> = {
      client_id: data.client_id,
      service_name: data.service_name,
      username: data.username || null,
      notes: data.notes || null,
      last_rotated: new Date().toISOString().slice(0, 10),
    };

    if (encrypted_password !== undefined) {
      payload.encrypted_password = encrypted_password;
    }

    if (data.id) {
      const { error } = await supabase.from("client_credentials").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("client_credentials").insert(payload);
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });
