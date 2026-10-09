import { supabase } from "@/integrations/supabase/client";
import {
  PRINCE_MEMBER_ID,
  PRINCE_MEMBER_NAME,
  upsertLocalClient,
  PipelineClient,
} from "@/lib/pipeline-store";
import { todayISO } from "@/lib/agency";

export type ProspectStage = "Contacted" | "Demo" | "Negotiating" | "Signed" | "Lost";

export const PROSPECT_STAGES: readonly ProspectStage[] = [
  "Contacted",
  "Demo",
  "Negotiating",
  "Signed",
  "Lost",
] as const;

export const LEAD_SOURCES = [
  "Referral",
  "Inbound Website",
  "Cold Outreach",
  "LinkedIn",
  "Networking Event",
  "Partner Agency",
  "Social Media",
  "Direct Call",
] as const;

export interface ProspectItem {
  id: string;
  business_name: string;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: string | null;
  stage: ProspectStage;
  assigned_rep: string | null;
  assigned_rep_name?: string;
  client_id: string | null;
  estimated_value?: number | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export const STORAGE_KEY_PROSPECTS = "lovable_prospects_data_v2";

export const INITIAL_PROSPECTS: ProspectItem[] = [
  {
    id: "lead-1001",
    business_name: "Kigali Innovations Hub",
    industry: "Technology",
    contact_name: "Eric Mugisha",
    contact_email: "eric.mugisha@kihub.rw",
    contact_phone: "+250 788 412 091",
    source: "Inbound Website",
    stage: "Demo",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 850000,
    notes:
      "Requires complete digital member portal and smart access integration. Scheduled demo for Thursday.",
    created_at: "2026-03-02T09:30:00Z",
  },
  {
    id: "lead-1002",
    business_name: "Akagera Fresh Organics",
    industry: "Food & Beverage",
    contact_name: "Diane Ingabire",
    contact_email: "diane@akagerafresh.rw",
    contact_phone: "+250 783 551 229",
    source: "Referral",
    stage: "Negotiating",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 500000,
    notes: "Agreed on core commerce scope. Reviewing contract SLA and bi-weekly payment schedule.",
    created_at: "2026-03-05T14:15:00Z",
  },
  {
    id: "lead-1003",
    business_name: "Nyungwe Eco Safaris",
    industry: "Tourism",
    contact_name: "Jean-Paul Bizimana",
    contact_email: "jp@nyungwetours.com",
    contact_phone: "+250 789 204 118",
    source: "Cold Outreach",
    stage: "Contacted",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 700000,
    notes: "Reached out via LinkedIn. Interested in automated multilingual booking engine.",
    created_at: "2026-03-10T11:00:00Z",
  },
  {
    id: "lead-1004",
    business_name: "Gorilla Express Couriers",
    industry: "Logistics",
    contact_name: "Patrick Kwizera",
    contact_email: "p.kwizera@gorillaexpress.rw",
    contact_phone: "+250 785 882 340",
    source: "LinkedIn",
    stage: "Contacted",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 650000,
    notes: "Needs real-time fleet dispatch dashboard with SMS client alerts.",
    created_at: "2026-03-11T16:20:00Z",
  },
  {
    id: "lead-1005",
    business_name: "Maison Kigali Roastery",
    industry: "Food & Beverage",
    contact_name: "Marie Claire Uwamahoro",
    contact_email: "orders@maisonkigali.rw",
    contact_phone: "+250 788 190 776",
    source: "Inbound Website",
    stage: "Signed",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 450000,
    notes: "Signed proposal. Ready for onboarding into client active roster and build setup.",
    created_at: "2026-02-24T10:00:00Z",
  },
  {
    id: "lead-1006",
    business_name: "Zenith Health Diagnostics",
    industry: "Healthcare",
    contact_name: "Dr. Emmanuel Gasana",
    contact_email: "gasana@zenithhealth.rw",
    contact_phone: "+250 782 449 810",
    source: "Referral",
    stage: "Demo",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 1200000,
    notes: "High potential medical results portal. Demo prepared for clinical director and board.",
    created_at: "2026-03-07T13:40:00Z",
  },
  {
    id: "lead-1007",
    business_name: "Alpha Academy Kigali",
    industry: "Education",
    contact_name: "Grace Mukamana",
    contact_email: "head@alphaacademy.edu.rw",
    contact_phone: "+250 788 772 319",
    source: "Networking Event",
    stage: "Negotiating",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 600000,
    notes:
      "Met at Kigali EdTech Expo. Finalizing fee tier structure for term-based tuition portal.",
    created_at: "2026-03-01T15:00:00Z",
  },
  {
    id: "lead-1008",
    business_name: "Solair Clean Energy RW",
    industry: "Energy",
    contact_name: "David Karangwa",
    contact_email: "david@solair.rw",
    contact_phone: "+250 789 610 994",
    source: "Partner Agency",
    stage: "Contacted",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 950000,
    notes: "Inquiry for commercial solar installment tracking app for local field agents.",
    created_at: "2026-03-12T08:45:00Z",
  },
  {
    id: "lead-1009",
    business_name: "Urban Stitch Atelier",
    industry: "Fashion",
    contact_name: "Solange Uwera",
    contact_email: "solange@urbanstitch.rw",
    contact_phone: "+250 783 119 025",
    source: "Social Media",
    stage: "Demo",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 400000,
    notes: "Bespoke tailoring custom measurements visual app. Showed prototype wireframes.",
    created_at: "2026-03-08T10:30:00Z",
  },
  {
    id: "lead-1010",
    business_name: "Prime Auto Parts Hub",
    industry: "Automotive",
    contact_name: "Olivier Habimana",
    contact_email: "habimana@primeparts.rw",
    contact_phone: "+250 781 220 558",
    source: "Cold Outreach",
    stage: "Lost",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 300000,
    notes: "Decided to postpone digital upgrade until Q4 2026 due to internal restructuring.",
    created_at: "2026-02-15T12:00:00Z",
  },
  {
    id: "lead-1011",
    business_name: "Horizon Microfinance",
    industry: "Finance",
    contact_name: "Claude Ndayisaba",
    contact_email: "claude@horizonmicro.rw",
    contact_phone: "+250 788 333 111",
    source: "Inbound Website",
    stage: "Signed",
    assigned_rep: PRINCE_MEMBER_ID,
    assigned_rep_name: PRINCE_MEMBER_NAME,
    client_id: null,
    estimated_value: 1500000,
    notes: "Contract signed for agent banking app and mobile money disbursement integration.",
    created_at: "2026-02-28T16:00:00Z",
  },
];

export function getLocalStoredProspects(): ProspectItem[] {
  if (typeof window === "undefined") return INITIAL_PROSPECTS;
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY_PROSPECTS);
    if (!raw) {
      saveLocalProspects(INITIAL_PROSPECTS);
      return INITIAL_PROSPECTS;
    }
    const parsed = JSON.parse(raw) as ProspectItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveLocalProspects(INITIAL_PROSPECTS);
      return INITIAL_PROSPECTS;
    }

    // Merge any missing initial seed items
    const existingIds = new Set(parsed.map((p) => p.id));
    let modified = false;
    for (const seed of INITIAL_PROSPECTS) {
      if (!existingIds.has(seed.id)) {
        parsed.push(seed);
        modified = true;
      }
    }
    if (modified) {
      saveLocalProspects(parsed);
    }
    return parsed;
  } catch (err) {
    console.error("Error reading local prospects:", err);
    return INITIAL_PROSPECTS;
  }
}

export function saveLocalProspects(prospects: ProspectItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(STORAGE_KEY_PROSPECTS, JSON.stringify(prospects));
  } catch (err) {
    console.error("Error saving local prospects:", err);
  }
}

export function upsertLocalProspect(prospect: ProspectItem): ProspectItem[] {
  const current = getLocalStoredProspects();
  const idx = current.findIndex((p) => p.id === prospect.id);
  let next: ProspectItem[];
  if (idx >= 0) {
    next = [...current];
    next[idx] = {
      ...next[idx],
      ...prospect,
      updated_at: new Date().toISOString(),
    };
  } else {
    next = [prospect, ...current];
  }
  saveLocalProspects(next);
  return next;
}

export function updateLocalProspectStage(id: string, stage: ProspectStage): ProspectItem[] {
  const current = getLocalStoredProspects();
  const next = current.map((p) => {
    if (p.id === id) {
      return {
        ...p,
        stage,
        updated_at: new Date().toISOString(),
      };
    }
    return p;
  });
  saveLocalProspects(next);
  return next;
}

export function deleteLocalProspect(id: string): ProspectItem[] {
  const current = getLocalStoredProspects();
  const next = current.filter((p) => p.id !== id);
  saveLocalProspects(next);
  return next;
}

/**
 * Converts a prospect to an active client:
 * 1. Creates a client in pipeline-store
 * 2. Marks prospect stage as "Signed"
 * 3. Associates client_id with the prospect
 * 4. Tries syncing to Supabase
 */
export async function convertProspectToClient(prospect: ProspectItem): Promise<{
  client: PipelineClient;
  prospect: ProspectItem;
}> {
  const clientId =
    prospect.client_id ||
    `c-conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const newClient: PipelineClient = {
    id: clientId,
    business_name: prospect.business_name,
    industry: prospect.industry,
    onboarded_by: prospect.assigned_rep ?? PRINCE_MEMBER_ID,
    onboarded_by_name: prospect.assigned_rep_name ?? PRINCE_MEMBER_NAME,
    signed_date: todayISO(),
    status: "Active",
    app_status: "Live",
    app_url: null,
    build_stage: "Planning",
    build_started_at: todayISO(),
    shipped_at: null,
    project_name: `${prospect.business_name} App`,
    hosting_account_id: null,
    contact_name: prospect.contact_name,
    contact_email: prospect.contact_email,
    contact_phone: prospect.contact_phone,
    created_at: new Date().toISOString(),
  };

  // Upsert client into client store
  upsertLocalClient(newClient);

  // Update prospect
  const updatedProspect: ProspectItem = {
    ...prospect,
    stage: "Signed",
    client_id: clientId,
    updated_at: new Date().toISOString(),
  };
  upsertLocalProspect(updatedProspect);

  // Attempt Supabase sync
  try {
    await supabase.from("clients").insert({
      id: clientId,
      business_name: newClient.business_name,
      industry: newClient.industry,
      onboarded_by: newClient.onboarded_by,
      signed_date: newClient.signed_date,
      status: newClient.status,
      contact_name: newClient.contact_name,
      contact_email: newClient.contact_email,
      contact_phone: newClient.contact_phone,
    });
  } catch (e) {
    console.warn("Supabase client conversion insert error:", e);
  }

  try {
    await supabase
      .from("prospects")
      .update({
        stage: "Signed",
        client_id: clientId,
      })
      .eq("id", prospect.id);
  } catch (e) {
    console.warn("Supabase prospect conversion update error:", e);
  }

  return { client: newClient, prospect: updatedProspect };
}

/**
 * Merged query for prospects: queries Supabase, merges with local prospects
 */
export async function fetchMergedProspects(): Promise<ProspectItem[]> {
  const local = getLocalStoredProspects();
  try {
    const { data: dbProspects, error } = await supabase
      .from("prospects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !dbProspects || dbProspects.length === 0) {
      return local;
    }

    const dbMap = new Map(dbProspects.map((p) => [p.id, p]));
    const merged: ProspectItem[] = [];

    for (const dbP of dbProspects) {
      const locP = local.find((l) => l.id === dbP.id);
      merged.push({
        id: dbP.id,
        business_name: dbP.business_name,
        industry: dbP.industry,
        contact_name: dbP.contact_name,
        contact_email: dbP.contact_email,
        contact_phone: dbP.contact_phone,
        source: dbP.source,
        stage: dbP.stage as ProspectStage,
        assigned_rep: dbP.assigned_rep,
        assigned_rep_name:
          locP?.assigned_rep_name ??
          (dbP.assigned_rep === PRINCE_MEMBER_ID ? PRINCE_MEMBER_NAME : undefined),
        client_id: dbP.client_id,
        estimated_value: locP?.estimated_value ?? 500000,
        notes: locP?.notes ?? null,
        created_at: dbP.created_at,
        updated_at: locP?.updated_at,
      });
    }

    for (const locP of local) {
      if (!dbMap.has(locP.id)) {
        merged.push(locP);
      }
    }

    saveLocalProspects(merged);
    return merged;
  } catch (e) {
    console.warn("fetchMergedProspects fallback to local:", e);
    return local;
  }
}
