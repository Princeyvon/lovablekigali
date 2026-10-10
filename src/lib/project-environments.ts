import { supabase } from "@/integrations/supabase/client";
import { PipelineProject, getLocalStoredProjects, upsertLocalProject } from "@/lib/pipeline-store";
import { packAccountNotes, unpackAccountNotes } from "@/lib/project-accounts.functions";
import { getLocalStoredAccounts } from "@/lib/lovable-accounts-store";

export interface ProjectEnvironmentData {
  github: {
    repo_url: string;
    email: string;
    branch?: string;
  };
  googleAiStudio: {
    email: string;
    url?: string;
    account_id?: string;
  };
  lovable: {
    email: string;
    url?: string;
    account_id?: string;
    credits?: number | null;
  };
}

export interface RawProjectAccount {
  id?: string;
  project_id?: string | null;
  client_id?: string | null;
  platform?: string | null;
  email?: string | null;
  url?: string | null;
  lovable_account_id?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface RawLovableAccount {
  id: string;
  email: string;
  label?: string | null;
  credits_remaining?: number | null;
  [key: string]: unknown;
}

const STORAGE_KEY_PROJECT_ACCOUNTS = "agency_project_accounts_local_v2";

export function getLocalProjectAccounts(): RawProjectAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY_PROJECT_ACCOUNTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalProjectAccounts(accounts: RawProjectAccount[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(STORAGE_KEY_PROJECT_ACCOUNTS, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}

/**
 * Extracts and normalizes the 3 core environments (GitHub, Google AI Studio, Lovable)
 * for a project, pulling from project_accounts, pipeline project properties,
 * and accounts lookup with sensible defaults.
 */
export function extractProjectEnvironments(
  project: PipelineProject | null | undefined,
  projectAccounts: Array<RawProjectAccount> = [],
  lovableAccounts: Array<RawLovableAccount> = [],
): ProjectEnvironmentData {
  if (!project) {
    return {
      github: { repo_url: "", email: "" },
      googleAiStudio: { email: "", url: "https://aistudio.google.com" },
      lovable: { email: "", url: "" },
    };
  }

  // Merge in any locally saved project_accounts and ensure builder accounts
  const localAccounts = getLocalProjectAccounts();
  const allAccounts = [...projectAccounts, ...localAccounts];
  const effectiveLovableAccounts =
    lovableAccounts && lovableAccounts.length > 0 ? lovableAccounts : getLocalStoredAccounts();

  // 1. GitHub Environment: link & email for main repo
  const githubPa = allAccounts.find(
    (pa) => pa.project_id === project.id && (pa.platform === "GitHub" || pa.platform === "github"),
  );

  const defaultSlug = project.project_name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-");

  const githubRepoUrl =
    githubPa?.url ||
    project.github_repo_url ||
    `https://github.com/lovable-solutions/${defaultSlug}`;

  const githubEmail = githubPa?.email || project.github_email || "dev@lovablesolutions.com";

  // 2. Google AI Studio Environment: connected email & app/prompt URL
  const googlePa = allAccounts.find(
    (pa) =>
      pa.project_id === project.id &&
      (pa.platform === "Google AI Studio" ||
        pa.platform === "Google" ||
        pa.platform === "AI Studio"),
  );

  const googleAccFromId = googlePa?.lovable_account_id
    ? effectiveLovableAccounts.find((a) => a.id === googlePa.lovable_account_id)
    : undefined;

  const googleAiEmail =
    googleAccFromId?.email ||
    googlePa?.email ||
    project.google_ai_studio_email ||
    effectiveLovableAccounts[0]?.email ||
    "ai-builder@lovablesolutions.com";

  const googleAiUrl =
    googlePa?.url || project.google_ai_studio_url || "https://aistudio.google.com";

  // 3. Lovable Environment: connected email & project URL
  const lovablePa = allAccounts.find(
    (pa) =>
      pa.project_id === project.id && (pa.platform === "Lovable" || pa.platform === "lovable"),
  );

  const lovableAccFromId =
    (lovablePa?.lovable_account_id
      ? effectiveLovableAccounts.find((a) => a.id === lovablePa.lovable_account_id)
      : undefined) ||
    (project.hosting_account_id
      ? effectiveLovableAccounts.find((a) => a.id === project.hosting_account_id)
      : undefined);

  const lovableEmail =
    lovableAccFromId?.email ||
    lovablePa?.email ||
    project.lovable_email ||
    effectiveLovableAccounts[0]?.email ||
    "princeyvon30@gmail.com";

  const lovableCredits =
    lovableAccFromId?.credits_remaining ??
    effectiveLovableAccounts.find((a) => a.email.toLowerCase() === lovableEmail.toLowerCase())
      ?.credits_remaining ??
    null;

  const lovableUrl =
    lovablePa?.url ||
    project.lovable_url ||
    project.app_url ||
    `https://lovable.dev/projects/${project.id}`;

  return {
    github: {
      repo_url: githubRepoUrl,
      email: githubEmail,
      branch: "main",
    },
    googleAiStudio: {
      email: googleAiEmail,
      url: googleAiUrl,
      account_id: googleAccFromId?.id || googlePa?.lovable_account_id || undefined,
    },
    lovable: {
      email: lovableEmail,
      url: lovableUrl,
      account_id: lovableAccFromId?.id || project.hosting_account_id || undefined,
      credits: lovableCredits,
    },
  };
}

/**
 * Saves or updates all 3 project environments (GitHub, Google AI Studio, Lovable)
 * both in local storage and Supabase project_accounts.
 */
export async function saveProjectEnvironments({
  projectId,
  github,
  googleAiStudio,
  lovable,
  userId = "authenticated-user",
}: {
  projectId: string;
  github: { repo_url: string; email: string };
  googleAiStudio: { email: string; url?: string; account_id?: string };
  lovable: { email: string; url?: string; account_id?: string };
  userId?: string;
}): Promise<ProjectEnvironmentData> {
  const now = new Date().toISOString();

  // 1. Update project in local store
  const allProjects = getLocalStoredProjects();
  const targetProject = allProjects.find((p) => p.id === projectId);
  if (targetProject) {
    const updatedProject: PipelineProject = {
      ...targetProject,
      github_repo_url: github.repo_url.trim(),
      github_email: github.email.trim(),
      google_ai_studio_email: googleAiStudio.email.trim(),
      google_ai_studio_url: googleAiStudio.url?.trim() || "https://aistudio.google.com",
      lovable_email: lovable.email.trim(),
      lovable_url: lovable.url?.trim() || targetProject.app_url || null,
      hosting_account_id: lovable.account_id || targetProject.hosting_account_id,
      updated_at: now,
    };
    upsertLocalProject(updatedProject);
  }

  // 2. Try DB update on projects table
  try {
    await supabase
      .from("projects")
      .update({
        hosting_account_id: lovable.account_id || null,
        app_url: lovable.url || null,
        updated_at: now,
      })
      .eq("id", projectId);
  } catch (e) {
    console.warn("DB projects update skipped/failed:", e);
  }

  // 3. Upsert records in local project_accounts
  const localAccounts = getLocalProjectAccounts();
  const upsertLocalPlatform = (
    platform: string,
    email: string,
    url: string | null,
    lovableAccountId: string | null = null,
  ) => {
    const idx = localAccounts.findIndex(
      (a) => a.project_id === projectId && a.platform === platform,
    );
    const item = {
      id:
        idx >= 0
          ? localAccounts[idx]!.id
          : `pa-${platform.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      project_id: projectId,
      platform,
      email: email || null,
      url: url || null,
      lovable_account_id: lovableAccountId,
      notes: packAccountNotes({ status: "active", plan_tier: "Pro", billing_owner: "agency" }),
      updated_at: now,
    };
    if (idx >= 0) {
      localAccounts[idx] = { ...localAccounts[idx], ...item };
    } else {
      localAccounts.push(item);
    }
  };

  upsertLocalPlatform("GitHub", github.email, github.repo_url);
  upsertLocalPlatform(
    "Google AI Studio",
    googleAiStudio.email,
    googleAiStudio.url || "https://aistudio.google.com",
    googleAiStudio.account_id || null,
  );
  upsertLocalPlatform("Lovable", lovable.email, lovable.url || null, lovable.account_id || null);
  saveLocalProjectAccounts(localAccounts);

  // 4. Upsert in Supabase project_accounts table
  const upsertDbPlatform = async (
    platform: string,
    email: string,
    url: string | null,
    lovableAccountId: string | null = null,
  ) => {
    try {
      const { data: existing } = await supabase
        .from("project_accounts")
        .select("id")
        .eq("project_id", projectId)
        .eq("platform", platform)
        .maybeSingle();

      const payload = {
        project_id: projectId,
        platform,
        email: email || null,
        url: url || null,
        lovable_account_id: lovableAccountId,
        notes: packAccountNotes({ status: "active", plan_tier: "Pro", billing_owner: "agency" }),
        updated_at: now,
      };

      if (existing) {
        await supabase.from("project_accounts").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("project_accounts").insert({
          ...payload,
          created_by: userId,
        });
      }
    } catch (e) {
      console.warn(`Supabase project_accounts update for ${platform} skipped:`, e);
    }
  };

  await Promise.allSettled([
    upsertDbPlatform("GitHub", github.email, github.repo_url),
    upsertDbPlatform(
      "Google AI Studio",
      googleAiStudio.email,
      googleAiStudio.url || "https://aistudio.google.com",
      googleAiStudio.account_id || null,
    ),
    upsertDbPlatform("Lovable", lovable.email, lovable.url || null, lovable.account_id || null),
  ]);

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("agency:db-sync", {
          detail: {
            type: "project_environments_updated",
            id: projectId,
            timestamp: new Date().toISOString(),
          },
        }),
      );
    } catch {
      // ignore
    }
  }

  return {
    github,
    googleAiStudio,
    lovable,
  };
}
