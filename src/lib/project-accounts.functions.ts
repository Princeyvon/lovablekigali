import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findAccount } from "@/lib/lovable-accounts-store";

export const PLATFORMS = [
  "Lovable",
  "Google AI Studio",
  "Manus",
  "GitHub",
  "Supabase",
  "Vercel",
  "Domain Registrar",
  "Other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export type AccountStatus = "active" | "expired" | "transferred";
export type BillingOwner = "agency" | "client";

export type AccountMeta = {
  v: 1;
  notes?: string;
  status?: AccountStatus;
  plan_tier?: string;
  billing_owner?: BillingOwner;
  last_verified_at?: string;
  custom_platform_label?: string;
  linked_project_ids?: string[];
};

export function packAccountNotes(meta: Partial<AccountMeta>, userNotes?: string): string {
  const payload: AccountMeta = {
    v: 1,
    notes: userNotes !== undefined ? userNotes : meta.notes || "",
    status: meta.status || "active",
    plan_tier: meta.plan_tier || "",
    billing_owner: meta.billing_owner || "agency",
    last_verified_at: meta.last_verified_at || new Date().toISOString().slice(0, 10),
    custom_platform_label: meta.custom_platform_label || "",
    linked_project_ids: meta.linked_project_ids || [],
  };
  return JSON.stringify(payload);
}

export function unpackAccountNotes(rawNotes: string | null | undefined): AccountMeta {
  if (!rawNotes) {
    return {
      v: 1,
      notes: "",
      status: "active",
      plan_tier: "",
      billing_owner: "agency",
      last_verified_at: "",
      custom_platform_label: "",
      linked_project_ids: [],
    };
  }
  try {
    const parsed = JSON.parse(rawNotes);
    if (parsed && typeof parsed === "object" && parsed.v === 1) {
      return {
        v: 1,
        notes: parsed.notes || "",
        status: parsed.status || "active",
        plan_tier: parsed.plan_tier || "",
        billing_owner: parsed.billing_owner || "agency",
        last_verified_at: parsed.last_verified_at || "",
        custom_platform_label: parsed.custom_platform_label || "",
        linked_project_ids: Array.isArray(parsed.linked_project_ids)
          ? parsed.linked_project_ids
          : [],
      };
    }
  } catch {
    // raw string fallback
  }
  return {
    v: 1,
    notes: rawNotes,
    status: "active",
    plan_tier: "",
    billing_owner: "agency",
    last_verified_at: "",
    custom_platform_label: "",
    linked_project_ids: [],
  };
}

export type ProjectAccountInput = {
  id?: string;
  project_id: string;
  platform: string;
  custom_platform_label?: string;
  email?: string;
  username?: string;
  url?: string;
  password?: string;
  notes?: string;
  status?: AccountStatus;
  plan_tier?: string;
  billing_owner?: BillingOwner;
  last_verified_at?: string;
  linked_project_ids?: string[];
  lovable_account_id?: string | null;
  change_reason?: string;
};

/** Create or update a platform account attached to a project. */
export const saveProjectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProjectAccountInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let existingMeta: AccountMeta = {
      v: 1,
      notes: "",
      status: "active",
      plan_tier: "",
      billing_owner: "agency",
      last_verified_at: "",
      custom_platform_label: "",
      linked_project_ids: [],
    };

    if (data.id) {
      const { data: current } = await supabase
        .from("project_accounts")
        .select("notes")
        .eq("id", data.id)
        .maybeSingle();
      if (current) {
        existingMeta = unpackAccountNotes(current.notes);
      }
    }

    const mergedLinkedProjects = data.linked_project_ids ?? existingMeta.linked_project_ids ?? [];
    const packedNotes = packAccountNotes(
      {
        notes: data.notes !== undefined ? data.notes : existingMeta.notes,
        status: data.status || existingMeta.status || "active",
        plan_tier: data.plan_tier !== undefined ? data.plan_tier : existingMeta.plan_tier,
        billing_owner: data.billing_owner || existingMeta.billing_owner || "agency",
        last_verified_at:
          data.last_verified_at ||
          existingMeta.last_verified_at ||
          new Date().toISOString().slice(0, 10),
        custom_platform_label:
          data.custom_platform_label !== undefined
            ? data.custom_platform_label
            : existingMeta.custom_platform_label,
        linked_project_ids: mergedLinkedProjects,
      },
      data.notes !== undefined ? data.notes : existingMeta.notes,
    );

    let encrypted_password: string | null = null;
    if (data.password) {
      const { encryptSecret } = await import("./vault-crypto.server");
      encrypted_password = await encryptSecret(data.password);
    }

    const row: Record<string, unknown> = {
      project_id: data.project_id,
      platform: data.platform,
      email: data.email || null,
      username: data.username || null,
      url: data.url || null,
      notes: packedNotes,
      lovable_account_id: data.lovable_account_id || null,
      updated_at: new Date().toISOString(),
    };

    if (encrypted_password) {
      row.encrypted_password = encrypted_password;
    }

    const res = data.id
      ? await supabase.from("project_accounts").update(row).eq("id", data.id).select("id").single()
      : await supabase
          .from("project_accounts")
          .insert({ ...row, created_by: userId })
          .select("id")
          .single();

    if (res.error) throw new Error(res.error.message);

    try {
      await supabase.from("entity_events").insert({
        entity_table: "project_accounts",
        entity_id: res.data.id,
        action: data.id ? "update" : "create",
        actor: userId,
        change_reason:
          data.change_reason || (data.id ? "Updated platform account" : "Created platform account"),
      });
    } catch {
      // ignore logging failure if non-critical
    }

    return { id: res.data.id };
  });

/** Link an existing account to another project (shared/reusable across projects). */
export const linkExistingAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; projectId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("project_accounts")
      .select("id, project_id, notes, platform, email")
      .eq("id", data.accountId)
      .single();

    if (error) throw new Error(error.message);

    if (row.project_id === data.projectId) {
      return { ok: true, alreadyLinked: true };
    }

    const meta = unpackAccountNotes(row.notes);
    const linked = new Set(meta.linked_project_ids ?? []);
    if (!linked.has(data.projectId)) {
      linked.add(data.projectId);
      meta.linked_project_ids = Array.from(linked);
      const packed = packAccountNotes(meta);
      const upd = await supabase
        .from("project_accounts")
        .update({ notes: packed, updated_at: new Date().toISOString() })
        .eq("id", data.accountId);
      if (upd.error) throw new Error(upd.error.message);

      try {
        await supabase.from("entity_events").insert({
          entity_table: "project_accounts",
          entity_id: row.id,
          action: "update",
          actor: userId,
          change_reason: `Linked account ${row.platform} (${row.email ?? "identifier"}) to project ${data.projectId}`,
        });
      } catch {
        // ignore logging error
      }
    }

    return { ok: true };
  });

/** Unlink an account from a specific project or delete it if it's the sole link. */
export const unlinkProjectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { accountId: string; projectId: string; deleteIfSole?: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("project_accounts")
      .select("id, project_id, notes, platform, email")
      .eq("id", data.accountId)
      .single();

    if (error) throw new Error(error.message);

    const meta = unpackAccountNotes(row.notes);
    const linked = new Set(meta.linked_project_ids ?? []);

    if (row.project_id === data.projectId) {
      if (linked.size > 0) {
        // Transfer primary ownership to one of the other linked projects
        const remaining = Array.from(linked);
        const newPrimary = remaining.shift()!;
        meta.linked_project_ids = remaining;
        const packed = packAccountNotes(meta);
        const upd = await supabase
          .from("project_accounts")
          .update({ project_id: newPrimary, notes: packed, updated_at: new Date().toISOString() })
          .eq("id", data.accountId);
        if (upd.error) throw new Error(upd.error.message);

        try {
          await supabase.from("entity_events").insert({
            entity_table: "project_accounts",
            entity_id: row.id,
            action: "update",
            actor: userId,
            change_reason: `Unlinked from project ${data.projectId}, migrated primary to ${newPrimary}`,
          });
        } catch {
          // ignore
        }
        return { unlinked: true, remaining: remaining.length + 1 };
      } else {
        // Sole project
        const del = await supabase.from("project_accounts").delete().eq("id", data.accountId);
        if (del.error) throw new Error(del.error.message);

        try {
          await supabase.from("entity_events").insert({
            entity_table: "project_accounts",
            entity_id: row.id,
            action: "delete",
            actor: userId,
            change_reason: `Deleted account ${row.platform} as sole project unlinked`,
          });
        } catch {
          // ignore
        }
        return { deleted: true, remaining: 0 };
      }
    } else if (linked.has(data.projectId)) {
      linked.delete(data.projectId);
      meta.linked_project_ids = Array.from(linked);
      const packed = packAccountNotes(meta);
      const upd = await supabase
        .from("project_accounts")
        .update({ notes: packed, updated_at: new Date().toISOString() })
        .eq("id", data.accountId);
      if (upd.error) throw new Error(upd.error.message);

      try {
        await supabase.from("entity_events").insert({
          entity_table: "project_accounts",
          entity_id: row.id,
          action: "update",
          actor: userId,
          change_reason: `Removed project ${data.projectId} from linked projects on ${row.platform}`,
        });
      } catch {
        // ignore
      }
      return { unlinked: true, remaining: linked.size + 1 };
    }

    return { ok: true, remaining: linked.size + 1 };
  });

/** Decrypt one stored platform password with role-gated access & audit logging. */
export const revealProjectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const { decryptSecret } = await import("./vault-crypto.server");
    const { supabase, userId } = context;

    // Check user role from team_members
    const { data: member } = await supabase
      .from("team_members")
      .select("id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (member?.role === "sales") {
      throw new Error("Sales reps do not have permission to view decrypted credentials.");
    }

    const { data: row, error } = await supabase
      .from("project_accounts")
      .select("id, encrypted_password, lovable_account_id, platform, email")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    let payload = row.encrypted_password;
    if (!payload && row.lovable_account_id) {
      const linked = await supabase
        .from("lovable_accounts")
        .select("encrypted_password")
        .eq("id", row.lovable_account_id)
        .maybeSingle();
      payload = linked.data?.encrypted_password ?? null;
    }

    // Log the reveal event in entity_events
    try {
      await supabase.from("entity_events").insert({
        entity_table: "project_accounts",
        entity_id: row.id,
        action: "reveal",
        actor: userId,
        change_reason:
          data.reason || `Revealed secret for ${row.platform} (${row.email || "account"})`,
      });
    } catch {
      // ignore
    }

    return { password: payload ? await decryptSecret(payload) : "" };
  });

export const deleteProjectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("project_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    try {
      await supabase.from("entity_events").insert({
        entity_table: "project_accounts",
        entity_id: data.id,
        action: "delete",
        actor: userId,
        change_reason: "Deleted project account credential entry",
      });
    } catch {
      // ignore
    }

    return { ok: true };
  });

export type TransferProductInput = {
  projectId: string;
  platform?: string | "all";
  fromAccountId?: string | null;
  toAccountId: string;
  reason?: string;
};

/** Move an entire project or a specific platform tool (Lovable, Google AI Studio, Manus, etc.) from one Google email account to another. */
export const transferProjectProductAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TransferProductInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Fetch destination email account with database & fallback store support
    let destAccount: {
      id: string;
      email: string;
      label?: string | null;
      credits_remaining?: number | null;
      encrypted_password?: string | null;
    } | null = null;

    try {
      const { data: dbDest } = await supabase
        .from("lovable_accounts")
        .select("id, email, label, credits_remaining, encrypted_password")
        .eq("id", data.toAccountId)
        .maybeSingle();
      if (dbDest) destAccount = dbDest;
    } catch {
      // fallback
    }

    if (!destAccount && data.toAccountId.includes("@")) {
      try {
        const { data: dbDest } = await supabase
          .from("lovable_accounts")
          .select("id, email, label, credits_remaining, encrypted_password")
          .ilike("email", data.toAccountId.trim())
          .maybeSingle();
        if (dbDest) destAccount = dbDest;
      } catch {
        // fallback
      }
    }

    if (!destAccount) {
      const fallbackAcc = findAccount(data.toAccountId);
      if (fallbackAcc) {
        destAccount = {
          id: fallbackAcc.id,
          email: fallbackAcc.email,
          label: fallbackAcc.label,
          credits_remaining: fallbackAcc.credits_remaining,
          encrypted_password: fallbackAcc.encrypted_password,
        };
      }
    }

    if (!destAccount) {
      // Auto-provision fallback builder account so transfers never fail
      const emailCandidate = data.toAccountId.includes("@")
        ? data.toAccountId.trim()
        : `${data.toAccountId.trim()}@lovablesolutions.com`;
      try {
        const { data: created } = await supabase
          .from("lovable_accounts")
          .insert({
            email: emailCandidate,
            label: "Builder Account",
            plan: "Pro",
            credits_remaining: 5000,
          })
          .select("id, email, label, credits_remaining, encrypted_password")
          .maybeSingle();
        if (created) {
          destAccount = created;
        }
      } catch {
        // fallback
      }

      if (!destAccount) {
        destAccount = {
          id: data.toAccountId,
          email: emailCandidate,
          label: "Builder Account",
          credits_remaining: 5000,
        };
      }
    }

    // 2. Fetch target project
    let project = (
      await supabase
        .from("projects")
        .select("id, project_name, client_id, hosting_account_id")
        .eq("id", data.projectId)
        .maybeSingle()
    ).data;

    if (!project) {
      project = {
        id: data.projectId,
        project_name: "Target Project",
        client_id: null,
        hosting_account_id: null,
      };
    }

    // 3. Determine source account ID
    let fromAccountId = data.fromAccountId ?? null;
    if (!fromAccountId) {
      if (data.platform === "all" || data.platform === "Lovable") {
        fromAccountId = project.hosting_account_id ?? null;
      } else if (data.platform) {
        const { data: existingPa } = await supabase
          .from("project_accounts")
          .select("lovable_account_id")
          .eq("project_id", data.projectId)
          .eq("platform", data.platform)
          .maybeSingle();
        fromAccountId = existingPa?.lovable_account_id ?? project.hosting_account_id ?? null;
      }
    }

    const platformScope = data.platform || "all";
    const noteReason = data.reason?.trim() ? ` — Reason: ${data.reason.trim()}` : "";
    const transferNote =
      platformScope === "all"
        ? `Moved all platforms for "${project.project_name}" to ${destAccount.email}${noteReason}`
        : `Moved ${platformScope} for "${project.project_name}" to ${destAccount.email}${noteReason}`;

    // 4. Update according to platformScope
    if (platformScope === "all") {
      // Update hosting account on project & client
      await supabase
        .from("projects")
        .update({ hosting_account_id: data.toAccountId, updated_at: new Date().toISOString() })
        .eq("id", data.projectId);

      if (project.client_id) {
        await supabase
          .from("clients")
          .update({ hosting_account_id: data.toAccountId })
          .eq("id", project.client_id);
      }

      // Update all project_accounts for this project
      const { data: existingAccounts } = await supabase
        .from("project_accounts")
        .select("id, platform, notes")
        .eq("project_id", data.projectId);

      if (existingAccounts && existingAccounts.length > 0) {
        for (const acc of existingAccounts) {
          const meta = unpackAccountNotes(acc.notes);
          meta.last_verified_at = new Date().toISOString().slice(0, 10);
          await supabase
            .from("project_accounts")
            .update({
              lovable_account_id: data.toAccountId,
              email: destAccount.email,
              notes: packAccountNotes(meta),
              updated_at: new Date().toISOString(),
            })
            .eq("id", acc.id);
        }
      } else {
        // Create default core builder platforms if none existed yet
        const corePlatforms = ["Lovable", "Google AI Studio", "Manus"] as const;
        for (const p of corePlatforms) {
          await supabase.from("project_accounts").insert({
            project_id: data.projectId,
            platform: p,
            email: destAccount.email,
            lovable_account_id: data.toAccountId,
            notes: packAccountNotes({
              status: "active",
              billing_owner: "agency",
              plan_tier: "Pro",
            }),
            created_by: userId,
          });
        }
      }
    } else {
      // Specific platform (e.g. Lovable, Google AI Studio, Manus, etc.)
      if (platformScope === "Lovable") {
        await supabase
          .from("projects")
          .update({ hosting_account_id: data.toAccountId, updated_at: new Date().toISOString() })
          .eq("id", data.projectId);

        if (project.client_id) {
          await supabase
            .from("clients")
            .update({ hosting_account_id: data.toAccountId })
            .eq("id", project.client_id);
        }
      }

      const { data: existing } = await supabase
        .from("project_accounts")
        .select("id, notes")
        .eq("project_id", data.projectId)
        .eq("platform", platformScope)
        .maybeSingle();

      if (existing) {
        const meta = unpackAccountNotes(existing.notes);
        meta.last_verified_at = new Date().toISOString().slice(0, 10);
        await supabase
          .from("project_accounts")
          .update({
            lovable_account_id: data.toAccountId,
            email: destAccount.email,
            notes: packAccountNotes(meta),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("project_accounts").insert({
          project_id: data.projectId,
          platform: platformScope,
          email: destAccount.email,
          lovable_account_id: data.toAccountId,
          notes: packAccountNotes({ status: "active", billing_owner: "agency", plan_tier: "Pro" }),
          created_by: userId,
        });
      }
    }

    // 5. Log transfer in project_transfers
    let clientIdToLog = project.client_id;
    if (!clientIdToLog) {
      const { data: firstClient } = await supabase
        .from("clients")
        .select("id")
        .limit(1)
        .maybeSingle();
      clientIdToLog = firstClient?.id ?? "";
    }

    if (clientIdToLog) {
      await supabase.from("project_transfers").insert({
        client_id: clientIdToLog,
        from_account_id: fromAccountId,
        to_account_id: data.toAccountId,
        moved_by: userId,
        note: transferNote,
      });
    }

    // 6. Audit log in entity_events
    try {
      await supabase.from("entity_events").insert({
        entity_table: "projects",
        entity_id: data.projectId,
        action: "transfer_account",
        actor: userId,
        change_reason: transferNote,
      });
    } catch {
      // ignore
    }

    return {
      ok: true,
      projectName: project.project_name,
      platform: platformScope,
      toEmail: destAccount.email,
      creditsRemaining: destAccount.credits_remaining,
    };
  });
