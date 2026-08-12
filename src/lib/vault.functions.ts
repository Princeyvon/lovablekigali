import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      client_id: string;
      service_name: string;
      username: string;
      password: string;
      notes?: string;
      change_reason: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { encryptSecret } = await import("./vault-crypto.server");
    const { supabase, userId } = context;
    const encrypted_password = await encryptSecret(data.password);
    const row = {
      client_id: data.client_id,
      service_name: data.service_name,
      username: data.username,
      encrypted_password,
      notes: data.notes ?? null,
      last_rotated: new Date().toISOString().slice(0, 10),
    };
    const res = data.id
      ? await supabase.from("client_credentials").update(row).eq("id", data.id).select("id").single()
      : await supabase.from("client_credentials").insert(row).select("id").single();
    if (res.error) throw new Error(res.error.message);
    await supabase.from("entity_events").insert({
      entity_table: "client_credentials",
      entity_id: res.data.id,
      action: data.id ? "update" : "create",
      change_reason: data.change_reason,
      actor: userId,
    });
    return { id: res.data.id };
  });

export const revealCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { decryptSecret } = await import("./vault-crypto.server");
    const { supabase, userId } = context;
    const { data: cred, error } = await supabase
      .from("client_credentials")
      .select("id, encrypted_password")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    await supabase
      .from("credential_access_log")
      .insert({ credential_id: cred.id, accessed_by: userId, action: "view" });
    return { password: await decryptSecret(cred.encrypted_password) };
  });
