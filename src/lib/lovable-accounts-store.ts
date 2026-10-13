import { supabase } from "@/integrations/supabase/client";

export interface LovableAccount {
  id: string;
  email: string;
  label?: string | null;
  plan?: string | null;
  recovery_email?: string | null;
  credits_remaining?: number | null;
  credits_checked_at?: string | null;
  notes?: string | null;
  encrypted_password?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const STORAGE_KEY_LOVABLE_ACCOUNTS = "agency_lovable_accounts_local_v2";

export const DEFAULT_SEED_ACCOUNTS: LovableAccount[] = [
  {
    id: "la-1000000-0000-4000-8000-000000000001",
    email: "princeyvon30@gmail.com",
    label: "Primary Builder (Lovable)",
    plan: "Pro",
    recovery_email: "backup-prince@lovablesolutions.com",
    credits_remaining: 5000,
    credits_checked_at: new Date().toISOString().slice(0, 10),
    notes: "Main builder account for client application production builds and Lovable workspaces.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "la-1000000-0000-4000-8000-000000000002",
    email: "ai-builder@lovablesolutions.com",
    label: "AI Studio Workspace (Google)",
    plan: "Pro",
    recovery_email: "dev@lovablesolutions.com",
    credits_remaining: 2500,
    credits_checked_at: new Date().toISOString().slice(0, 10),
    notes: "Connected Google account for Gemini model fine-tuning and AI Studio workspaces.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "la-1000000-0000-4000-8000-000000000003",
    email: "dev@lovablesolutions.com",
    label: "GitHub Sync & Deployments",
    plan: "Scale",
    recovery_email: "admin@lovablesolutions.com",
    credits_remaining: 1200,
    credits_checked_at: new Date().toISOString().slice(0, 10),
    notes:
      "Shared agency developer account for GitHub main repository syncing and automated deployments.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "la-1000000-0000-4000-8000-000000000004",
    email: "ev.lovable@gmail.com",
    label: "Executive Builder",
    plan: "Pro",
    recovery_email: "admin@lovable.dev",
    credits_remaining: 4800,
    credits_checked_at: new Date().toISOString().slice(0, 10),
    notes: "Active owner builder account connected to AI Studio and Lovable OS.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * Get accounts from localStorage, falling back to initial seed accounts
 */
export function getLocalStoredAccounts(): LovableAccount[] {
  void DEFAULT_SEED_ACCOUNTS;
  return [];
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY_LOVABLE_ACCOUNTS);
    if (!raw) {
      saveLocalAccounts(DEFAULT_SEED_ACCOUNTS);
      return DEFAULT_SEED_ACCOUNTS;
    }
    const parsed: LovableAccount[] = JSON.parse(raw);
    const existingEmails = new Set(parsed.map((a) => a.email.toLowerCase()));
    let modified = false;

    // Ensure default seeds exist
    for (const seed of DEFAULT_SEED_ACCOUNTS) {
      if (!existingEmails.has(seed.email.toLowerCase())) {
        parsed.push(seed);
        modified = true;
      }
    }

    if (modified) {
      saveLocalAccounts(parsed);
    }
    return parsed;
  } catch (err) {
    console.warn("Error reading local accounts:", err);
    return DEFAULT_SEED_ACCOUNTS;
  }
}

/**
 * Save accounts array to localStorage
 */
export function saveLocalAccounts(accounts: LovableAccount[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(STORAGE_KEY_LOVABLE_ACCOUNTS, JSON.stringify(accounts));
  } catch (err) {
    console.warn("Error saving local accounts:", err);
  }
}

/**
 * Upsert single account in localStorage
 */
export function upsertLocalAccount(account: LovableAccount): LovableAccount {
  const all = getLocalStoredAccounts();
  const existingIdx = all.findIndex(
    (a) => a.id === account.id || a.email.toLowerCase() === account.email.toLowerCase(),
  );

  const updated: LovableAccount = {
    ...(existingIdx >= 0 ? all[existingIdx] : {}),
    ...account,
    updated_at: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    all[existingIdx] = updated;
  } else {
    all.push(updated);
  }

  saveLocalAccounts(all);
  return updated;
}

/**
 * Delete account from localStorage
 */
export function deleteLocalAccount(id: string) {
  const all = getLocalStoredAccounts().filter((a) => a.id !== id);
  saveLocalAccounts(all);
}

/**
 * Fetch accounts merged with Supabase and localStorage fallback
 */
export async function fetchMergedAccounts(): Promise<LovableAccount[]> {
  const { data, error } = await supabase.from("lovable_accounts").select("*").order("email");
  if (error) throw new Error(error.message);
  return (data ?? []) as LovableAccount[];
}

/**
 * Find account by ID or email
 */
export function findAccount(
  idOrEmail: string | null | undefined,
  accounts: LovableAccount[] = [],
): LovableAccount | undefined {
  if (!idOrEmail) return undefined;
  const target = idOrEmail.trim().toLowerCase();
  return (
    accounts.find((a) => a.id === idOrEmail || a.email.toLowerCase() === target) ||
    DEFAULT_SEED_ACCOUNTS.find((a) => a.id === idOrEmail || a.email.toLowerCase() === target)
  );
}
