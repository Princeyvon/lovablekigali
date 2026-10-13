import { supabase } from "@/integrations/supabase/client";

export type BuildStage = "Planning" | "Building" | "Testing" | "Shipped";

export interface PipelineProject {
  id: string;
  project_name: string;
  client_id: string;
  hosting_account_id: string | null;
  built_by: string | null;
  build_stage: BuildStage;
  app_url: string | null;
  started_at: string | null;
  shipped_at: string | null;
  due_at: string | null;
  notes: string | null;
  payment_state: string;
  created_at: string;
  updated_at: string;
  prospect_id: string | null;
  // Augmented UI fields
  onboarded_by_name?: string;
  industry?: string;
  // Multiple environments (GitHub, Google AI Studio, Lovable)
  github_repo_url?: string | null;
  github_email?: string | null;
  google_ai_studio_email?: string | null;
  google_ai_studio_url?: string | null;
  lovable_email?: string | null;
  lovable_url?: string | null;
}

export interface PipelineClient {
  id: string;
  business_name: string;
  industry: string | null;
  onboarded_by: string | null;
  onboarded_by_name?: string;
  signed_date: string;
  status: "Active" | "Paused" | "Churned";
  app_status: "Live" | "Suspended" | "Closed";
  app_url: string | null;
  build_stage: BuildStage;
  build_started_at: string | null;
  shipped_at: string | null;
  project_name: string | null;
  hosting_account_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

// No hard-coded member: real team members come from the database.
export const PRINCE_MEMBER_ID: string | null = null;
export const PRINCE_MEMBER_NAME = "princeyvon30";

export const INITIAL_PIPELINE_ITEMS: Array<{
  business: string;
  industry: string | null;
  onboarded_by: string;
  monthly: string | null;
  paid_through: string | null;
  status: "Active";
  stage: BuildStage;
  clientId: string;
  projectId: string;
}> = [
  {
    business: "FireGuard",
    industry: null,
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000001",
    projectId: "p1000000-0000-4000-8000-000000000001",
  },
  {
    business: "Fleet OS",
    industry: null,
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000002",
    projectId: "p1000000-0000-4000-8000-000000000002",
  },
  {
    business: "Ijuru",
    industry: "Food & Beverage",
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000003",
    projectId: "p1000000-0000-4000-8000-000000000003",
  },
  {
    business: "Lovable OS",
    industry: null,
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000004",
    projectId: "p1000000-0000-4000-8000-000000000004",
  },
  {
    business: "Mosiac Website",
    industry: null,
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000005",
    projectId: "p1000000-0000-4000-8000-000000000005",
  },
  {
    business: "Mr Chips",
    industry: null,
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000006",
    projectId: "p1000000-0000-4000-8000-000000000006",
  },
  {
    business: "Quality Cuisine",
    industry: null,
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000007",
    projectId: "p1000000-0000-4000-8000-000000000007",
  },
  {
    business: "Rugs Studio",
    industry: null,
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000008",
    projectId: "p1000000-0000-4000-8000-000000000008",
  },
  {
    business: "Schools Ledgerly",
    industry: null,
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000009",
    projectId: "p1000000-0000-4000-8000-000000000009",
  },
  {
    business: "Volta OS",
    industry: null,
    onboarded_by: PRINCE_MEMBER_NAME,
    monthly: null,
    paid_through: null,
    status: "Active",
    stage: "Planning",
    clientId: "c1000000-0000-4000-8000-000000000010",
    projectId: "p1000000-0000-4000-8000-000000000010",
  },
];

const STORAGE_KEY_PROJECTS = "agency_pipeline_projects_v3";
const STORAGE_KEY_CLIENTS = "agency_pipeline_clients_v3";

export function getSeedProjects(): PipelineProject[] {
  const now = new Date().toISOString();
  return INITIAL_PIPELINE_ITEMS.map((item) => {
    const slug = item.business.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: item.projectId,
      project_name: item.business,
      client_id: item.clientId,
      hosting_account_id: null,
      built_by: PRINCE_MEMBER_ID,
      build_stage: item.stage,
      app_url: `https://${slug}.lovable.app`,
      started_at: now.slice(0, 10),
      shipped_at: null,
      due_at: null,
      notes: `Onboarded by ${item.onboarded_by}. Status: ${item.status}`,
      payment_state: "Open",
      created_at: now,
      updated_at: now,
      prospect_id: null,
      onboarded_by_name: item.onboarded_by,
      industry: item.industry ?? undefined,
      github_repo_url: `https://github.com/lovable-solutions/${slug}`,
      github_email: "dev@lovablesolutions.com",
      google_ai_studio_email: "ai-builder@lovablesolutions.com",
      google_ai_studio_url: "https://aistudio.google.com",
      lovable_email: "princeyvon30@gmail.com",
      lovable_url: `https://lovable.dev/projects/${item.projectId}`,
    };
  });
}

export function getSeedClients(): PipelineClient[] {
  const now = new Date().toISOString();
  return INITIAL_PIPELINE_ITEMS.map((item) => ({
    id: item.clientId,
    business_name: item.business,
    industry: item.industry,
    onboarded_by: PRINCE_MEMBER_ID,
    onboarded_by_name: item.onboarded_by,
    signed_date: now.slice(0, 10),
    status: item.status,
    app_status: "Live",
    app_url: null,
    build_stage: item.stage,
    build_started_at: now.slice(0, 10),
    shipped_at: null,
    project_name: item.business,
    hosting_account_id: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    created_at: now,
  }));
}

/**
 * Load persisted projects from localStorage merged with seed projects
 */
// Local copies are only trusted after a fresh database load in this session.
let cacheReady = false;
export function markCacheReady() {
  cacheReady = true;
}

export function getLocalStoredProjects(): PipelineProject[] {
  if (typeof window === "undefined" || !cacheReady) return [];
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY_PROJECTS);
    return raw ? (JSON.parse(raw) as PipelineProject[]) : [];
  } catch {
    return [];
  }
}

/**
 * Save projects to localStorage
 */
export function saveLocalProjects(projects: PipelineProject[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  } catch (err) {
    console.error("Error saving local projects:", err);
  }
}

/**
 * Load persisted clients from localStorage merged with seed clients
 */
export function getLocalStoredClients(): PipelineClient[] {
  if (typeof window === "undefined" || !cacheReady) return [];
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY_CLIENTS);
    return raw ? (JSON.parse(raw) as PipelineClient[]) : [];
  } catch {
    return [];
  }
}

/**
 * Save clients to localStorage
 */
export function saveLocalClients(clients: PipelineClient[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
  } catch (err) {
    console.error("Error saving local clients:", err);
  }
}

/**
 * Update project stage locally and save
 */
export function updateLocalProjectStage(id: string, stage: BuildStage): PipelineProject[] {
  const current = getLocalStoredProjects();
  const updated = current.map((p) => {
    if (p.id === id) {
      return {
        ...p,
        build_stage: stage,
        shipped_at:
          stage === "Shipped" ? (p.shipped_at ?? new Date().toISOString().slice(0, 10)) : null,
        updated_at: new Date().toISOString(),
      };
    }
    return p;
  });
  saveLocalProjects(updated);

  // Also update client if matched
  const clients = getLocalStoredClients();
  const clientUpdated = clients.map((c) => {
    const proj = updated.find((p) => p.id === id);
    if (proj && c.id === proj.client_id) {
      return {
        ...c,
        build_stage: stage,
        shipped_at:
          stage === "Shipped" ? (c.shipped_at ?? new Date().toISOString().slice(0, 10)) : null,
      };
    }
    return c;
  });
  saveLocalClients(clientUpdated);

  return updated;
}

/**
 * Add or update project locally
 */
export function upsertLocalProject(project: PipelineProject): PipelineProject[] {
  const current = getLocalStoredProjects();
  const idx = current.findIndex((p) => p.id === project.id);
  let next: PipelineProject[];
  if (idx >= 0) {
    next = [...current];
    next[idx] = { ...next[idx], ...project, updated_at: new Date().toISOString() };
  } else {
    next = [project, ...current];
  }
  saveLocalProjects(next);
  return next;
}

/**
 * Add or update client locally
 */
export function upsertLocalClient(client: PipelineClient): PipelineClient[] {
  const current = getLocalStoredClients();
  const idx = current.findIndex((c) => c.id === client.id);
  let next: PipelineClient[];
  if (idx >= 0) {
    next = [...current];
    next[idx] = { ...next[idx], ...client };
  } else {
    next = [client, ...current];
  }
  saveLocalClients(next);
  return next;
}

/**
 * Merged query for projects: reads Supabase, merges with local store
 */
export async function fetchMergedProjects(): Promise<PipelineProject[]> {
  const local = getLocalStoredProjects();
  try {
    const { data: dbProjects, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    if (!dbProjects) {
      return [];
    }

    // Merge: DB projects take precedence unless local has newer update,
    // and include any local/seed projects not yet in DB
    const dbMap = new Map(dbProjects.map((p) => [p.id, p as PipelineProject]));
    const merged: PipelineProject[] = [];

    // Add DB projects
    for (const dbP of dbProjects) {
      const locP = local.find((l) => l.id === dbP.id);
      const dbProj = dbP as unknown as Partial<PipelineProject>;
      merged.push({
        ...dbP,
        github_repo_url: locP?.github_repo_url || dbProj.github_repo_url || null,
        github_email: locP?.github_email || dbProj.github_email || null,
        google_ai_studio_email:
          locP?.google_ai_studio_email || dbProj.google_ai_studio_email || null,
        google_ai_studio_url: locP?.google_ai_studio_url || dbProj.google_ai_studio_url || null,
        lovable_email: locP?.lovable_email || dbProj.lovable_email || null,
        lovable_url: locP?.lovable_url || dbProj.lovable_url || null,
        onboarded_by_name: locP?.onboarded_by_name || dbProj.onboarded_by_name,
        industry: locP?.industry || dbProj.industry,
      } as PipelineProject);
    }

    void dbMap;

    // Update local cache with merged
    saveLocalProjects(merged);
    markCacheReady();
    return merged;
  } catch (e) {
    throw e;
  }
}

/**
 * Merged query for clients: reads Supabase, merges with local store
 */
export async function fetchMergedClients(): Promise<PipelineClient[]> {
  const local = getLocalStoredClients();
  try {
    const { data: dbClients, error } = await supabase
      .from("clients")
      .select("*")
      .order("business_name");

    if (error) throw new Error(error.message);
    if (!dbClients) {
      return [];
    }

    const dbMap = new Map(dbClients.map((c) => [c.id, c as PipelineClient]));
    const merged: PipelineClient[] = [];

    for (const dbC of dbClients) {
      const locC = local.find((l) => l.id === dbC.id);
      merged.push({
        ...dbC,
        onboarded_by_name: locC?.onboarded_by_name,
      } as PipelineClient);
    }

    void dbMap;

    saveLocalClients(merged);
    return merged;
  } catch (e) {
    throw e;
  }
}
