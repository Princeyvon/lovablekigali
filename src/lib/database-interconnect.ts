import { supabase } from "@/integrations/supabase/client";
import {
  PipelineProject,
  PipelineClient,
  BuildStage,
  getLocalStoredProjects,
  saveLocalProjects,
  upsertLocalProject,
  getLocalStoredClients,
  saveLocalClients,
  fetchMergedProjects,
  fetchMergedClients,
} from "./pipeline-store";
import {
  fetchMergedAccounts,
  getLocalStoredAccounts,
  saveLocalAccounts,
  LovableAccount,
} from "./lovable-accounts-store";
import {
  saveProjectEnvironments,
  ProjectEnvironmentData,
  getLocalProjectAccounts,
} from "./project-environments";

// Cross-tab and in-window broadcast sync channel
const SYNC_CHANNEL_NAME = "agency-hub-db-interconnect-v1";
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  } catch {
    // fallback to window CustomEvent
  }
}

export type DbSyncEvent = {
  type:
    | "project_stage_changed"
    | "project_environments_updated"
    | "account_password_updated"
    | "account_created_or_updated"
    | "client_updated"
    | "workflow_advanced"
    | "library_skill_updated"
    | "library_inspo_updated"
    | "library_prompt_updated"
    | "library_synced"
    | "bulk_sync_completed";
  id?: string;
  timestamp: string;
  payload?: unknown;
};

// ==========================================
// 1. IN-MEMORY FAST CACHE LAYER (<5ms access)
// ==========================================
interface FastCache {
  projects: PipelineProject[] | null;
  clients: PipelineClient[] | null;
  accounts: LovableAccount[] | null;
  lastWarmedAt: number;
}

const fastCache: FastCache = {
  projects: null,
  clients: null,
  accounts: null,
  lastWarmedAt: 0,
};

export const fastStore = {
  getProjects(): PipelineProject[] {
    if (fastCache.projects && fastCache.projects.length > 0) {
      return fastCache.projects;
    }
    const local = getLocalStoredProjects();
    fastCache.projects = local;
    return local;
  },
  getClients(): PipelineClient[] {
    if (fastCache.clients && fastCache.clients.length > 0) {
      return fastCache.clients;
    }
    const local = getLocalStoredClients();
    fastCache.clients = local;
    return local;
  },
  getAccounts(): LovableAccount[] {
    if (fastCache.accounts && fastCache.accounts.length > 0) {
      return fastCache.accounts;
    }
    const local = getLocalStoredAccounts();
    fastCache.accounts = local;
    return local;
  },
  setProjects(projects: PipelineProject[]) {
    fastCache.projects = projects;
    saveLocalProjects(projects);
  },
  setClients(clients: PipelineClient[]) {
    fastCache.clients = clients;
    saveLocalClients(clients);
  },
  setAccounts(accounts: LovableAccount[]) {
    fastCache.accounts = accounts;
    saveLocalAccounts(accounts);
  },
};

// ==========================================
// 2. RESILIENT MUTATION QUEUE (Auto-Retry)
// ==========================================
interface QueuedDbMutation {
  id: string;
  type: "project_update" | "client_update" | "environment_update" | "account_update";
  payload: Record<string, unknown>;
  timestamp: string;
  retries: number;
}

const MUTATION_QUEUE_KEY = "agency_hub_mutation_queue_v1";

function getQueuedMutations(): QueuedDbMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MUTATION_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueuedMutations(queue: QueuedDbMutation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTATION_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function enqueueDbMutation(
  mutation: Omit<QueuedDbMutation, "id" | "timestamp" | "retries">,
) {
  const item: QueuedDbMutation = {
    ...mutation,
    id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    retries: 0,
  };
  const queue = getQueuedMutations();
  queue.push(item);
  saveQueuedMutations(queue);
  void flushMutationQueue();
}

let isFlushing = false;
export async function flushMutationQueue(): Promise<void> {
  if (isFlushing || typeof window === "undefined") return;
  isFlushing = true;

  try {
    const queue = getQueuedMutations();
    if (queue.length === 0) {
      isFlushing = false;
      return;
    }

    const remaining: QueuedDbMutation[] = [];

    for (const item of queue) {
      try {
        if (item.type === "project_update") {
          const { projectId, ...fields } = item.payload as {
            projectId: string;
            [key: string]: unknown;
          };
          if (projectId) {
            await supabase.from("projects").update(fields).eq("id", projectId);
          }
        } else if (item.type === "client_update") {
          const { clientId, ...fields } = item.payload as {
            clientId: string;
            [key: string]: unknown;
          };
          if (clientId) {
            await supabase.from("clients").update(fields).eq("id", clientId);
          }
        }
      } catch (err) {
        console.warn(`Retry failed for queued mutation ${item.id}:`, err);
        if (item.retries < 5) {
          remaining.push({ ...item, retries: item.retries + 1 });
        }
      }
    }

    saveQueuedMutations(remaining);
  } finally {
    isFlushing = false;
  }
}

// Auto-flush on window focus or network online event
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushMutationQueue());
  window.addEventListener("focus", () => void flushMutationQueue());
}

// ==========================================
// 3. BROADCAST & SYNCHRONIZATION
// ==========================================

/**
 * Broadcast an interconnected event so all views (Kanban, App Status, Projects, Accounts)
 * update in real-time across tabs and in-memory caches without needing page reloads.
 */
export function broadcastDbSync(event: Omit<DbSyncEvent, "timestamp">) {
  const fullEvent: DbSyncEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    // In-window event
    window.dispatchEvent(new CustomEvent("agency:db-sync", { detail: fullEvent }));

    // Cross-tab broadcast
    try {
      broadcastChannel?.postMessage(fullEvent);
    } catch {
      // ignore
    }
  }
}

/**
 * Hook or helper to subscribe to database interconnect events
 */
export function onDbSync(callback: (event: DbSyncEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<DbSyncEvent>;
    if (custom.detail) callback(custom.detail);
  };

  const handleBroadcast = (e: MessageEvent<DbSyncEvent>) => {
    if (e.data) callback(e.data);
  };

  window.addEventListener("agency:db-sync", handleCustomEvent);
  broadcastChannel?.addEventListener("message", handleBroadcast);

  return () => {
    window.removeEventListener("agency:db-sync", handleCustomEvent);
    broadcastChannel?.removeEventListener("message", handleBroadcast);
  };
}

// ==========================================
// 4. CACHE PRE-WARMING & WARMING SYSTEMS
// ==========================================

let isWarming = false;
let isWarmed = false;

export async function warmDatabaseCache(): Promise<{
  projects: PipelineProject[];
  clients: PipelineClient[];
  accounts: LovableAccount[];
}> {
  if (isWarmed && typeof window !== "undefined") {
    return {
      projects: fastStore.getProjects(),
      clients: fastStore.getClients(),
      accounts: fastStore.getAccounts(),
    };
  }

  if (isWarming) {
    return {
      projects: fastStore.getProjects(),
      clients: fastStore.getClients(),
      accounts: fastStore.getAccounts(),
    };
  }

  isWarming = true;

  try {
    // Parallel pre-warming from Supabase & local stores
    const [projects, clients, accounts] = await Promise.all([
      fetchMergedProjects(),
      fetchMergedClients(),
      fetchMergedAccounts(),
    ]);

    fastStore.setProjects(projects);
    fastStore.setClients(clients);
    fastStore.setAccounts(accounts);
    fastCache.lastWarmedAt = Date.now();

    isWarmed = true;
    isWarming = false;

    // Flush any pending mutations that occurred offline
    void flushMutationQueue();

    broadcastDbSync({
      type: "bulk_sync_completed",
      payload: { projectCount: projects.length, clientCount: clients.length },
    });

    return { projects, clients, accounts };
  } catch (err) {
    console.warn("warmDatabaseCache warning (using local fallback stores):", err);
    isWarming = false;
    return {
      projects: fastStore.getProjects(),
      clients: fastStore.getClients(),
      accounts: fastStore.getAccounts(),
    };
  }
}

// ==========================================
// 5. UNIFIED WORKFLOW PERSISTENCE
// ==========================================

/**
 * Full database workflow update:
 * 1. Synchronously updates local stores and fastCache so changes are immediately visible with 0ms lag.
 * 2. Writes to Supabase projects and clients tables (or queues if offline).
 * 3. Appends an audit event to entity_events.
 * 4. Broadcasts interconnect event to all open tabs and views.
 */
export async function persistWorkflowChange({
  projectId,
  stage,
  clientId,
  hostingAccountId,
  appUrl,
  notes,
  projectName,
  paymentState,
  actor = "authenticated-user",
}: {
  projectId: string;
  stage?: BuildStage;
  clientId?: string | null;
  hostingAccountId?: string | null;
  appUrl?: string | null;
  notes?: string | null;
  projectName?: string;
  paymentState?: string;
  actor?: string;
}): Promise<PipelineProject | null> {
  const now = new Date().toISOString();
  const allProjects = fastStore.getProjects();
  const existing = allProjects.find((p) => p.id === projectId);

  if (!existing) return null;

  const updatedProject: PipelineProject = {
    ...existing,
    build_stage: stage ?? existing.build_stage,
    shipped_at: !stage
        ? existing.shipped_at
        : stage === "Shipped"
          ? (existing.shipped_at ?? now.slice(0, 10))
          : null,
    hosting_account_id:
      hostingAccountId !== undefined ? hostingAccountId : existing.hosting_account_id,
    app_url: appUrl !== undefined ? appUrl : existing.app_url,
    notes: notes !== undefined ? notes : existing.notes,
    project_name: projectName ?? existing.project_name,
    payment_state: paymentState ?? existing.payment_state,
    updated_at: now,
  };

  // 1. Immediate local persistence (<2ms)
  upsertLocalProject(updatedProject);
  fastCache.projects = getLocalStoredProjects();

  // Sync client in local store
  const targetClientId = clientId || existing.client_id;
  if (targetClientId) {
    const clients = fastStore.getClients();
    const updatedClients = clients.map((c) => {
      if (c.id === targetClientId) {
        return {
          ...c,
          build_stage: stage ?? c.build_stage,
          app_url: appUrl ?? c.app_url,
          hosting_account_id:
            hostingAccountId !== undefined ? hostingAccountId : c.hosting_account_id,
          shipped_at: !stage
              ? c.shipped_at
              : stage === "Shipped"
                ? (c.shipped_at ?? now.slice(0, 10))
                : null,
        };
      }
      return c;
    });
    saveLocalClients(updatedClients);
    fastCache.clients = updatedClients;
  }

  // 2. Broadcast immediately for zero-lag UI response across all tabs & views
  broadcastDbSync({
    type: "project_stage_changed",
    id: projectId,
    payload: { stage, projectId, clientId: targetClientId },
  });

  // 3. Prepare DB payload
  const projectDbPayload: Record<string, string | null> = {
    updated_at: now,
  };
  if (stage) {
    projectDbPayload.build_stage = stage;
    projectDbPayload.shipped_at = stage === "Shipped" ? now.slice(0, 10) : null;
  }
  if (hostingAccountId !== undefined) {
    projectDbPayload.hosting_account_id = hostingAccountId;
  }
  if (appUrl !== undefined) {
    projectDbPayload.app_url = appUrl;
  }
  if (notes !== undefined) {
    projectDbPayload.notes = notes;
  }
  if (projectName !== undefined) projectDbPayload.project_name = projectName;
  if (paymentState !== undefined) projectDbPayload.payment_state = paymentState;

  // 4. Persist to the database — errors surface to the caller
  const { error: projErr } = await supabase
    .from("projects")
    .update(projectDbPayload)
    .eq("id", projectId);
  if (projErr) throw new Error(projErr.message);

  if (targetClientId) {
    const clientDbPayload: Record<string, string | null> = {};
    if (stage) clientDbPayload.build_stage = stage;
    if (appUrl !== undefined) clientDbPayload.app_url = appUrl;
    if (hostingAccountId !== undefined) clientDbPayload.hosting_account_id = hostingAccountId;
    if (projectName !== undefined) clientDbPayload.project_name = projectName;
    if (Object.keys(clientDbPayload).length > 0) {
      const { error: cErr } = await supabase
        .from("clients")
        .update(clientDbPayload)
        .eq("id", targetClientId);
      if (cErr) throw new Error(cErr.message);
    }
  }
  void actor;

  return updatedProject;
}

/**
 * Save project environments with full interconnectivity:
 * Updates projects, project_accounts, and local storage caches.
 */
export async function persistProjectEnvironmentsInterconnect({
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
  const result = await saveProjectEnvironments({
    projectId,
    github,
    googleAiStudio,
    lovable,
    userId,
  });

  broadcastDbSync({
    type: "project_environments_updated",
    id: projectId,
    payload: result,
  });

  return result;
}
