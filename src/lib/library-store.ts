import { supabase } from "@/integrations/supabase/client";
import { broadcastDbSync } from "@/lib/database-interconnect";

// ==========================================
// 1. SKILLS DEFINITIONS & PRESETS
// ==========================================

export interface LibrarySkill {
  id: string;
  title: string;
  category:
    | "Operations"
    | "Engineering"
    | "Frontend Design"
    | "AI & Prompts"
    | "Security"
    | "Finance"
    | "Database & APIs";
  description: string;
  content: string;
  tags: string[];
  target_models?: string[];
  author?: string;
  version?: string;
  created_at: string;
  updated_at?: string;
  source_file_name?: string;
}

export const STORAGE_KEY_LIBRARY_SKILLS = "agency_library_skills_store_v1";

export const DEFAULT_LIBRARY_SKILLS: LibrarySkill[] = [
  {
    id: "sk-agency-onboard",
    title: "Agency OS Client Onboarding Standard",
    category: "Operations",
    description:
      "Standard operating procedure for onboarding newly signed clients into Agency OS, provisioning credentials, accounts, and initial git repository.",
    tags: ["Onboarding", "SOP", "Clients", "Accounts"],
    target_models: ["Universal", "Operations Agent"],
    author: "Operations Lead",
    version: "2.4",
    created_at: "2026-03-01T10:00:00Z",
    content: `# Agency OS Client Onboarding Standard (v2.4)

## Objective
Seamless zero-friction handover from sales closure to active production build pipeline.

## Standard Checklist:
1. Receive signed contract and initial retainer verification in Finance.
2. Convert prospect in Agency OS to signed Client status:
   - Ensure contact email, phone, business name, and industry are populated.
3. Link primary Google builder account in Builder Accounts & Credits Tracker.
4. Provision client repository and link credentials in Vault:
   - AES-256-GCM encrypted platform passwords.
   - Record access logs to maintain audit compliance.
5. Create initial "Planning" ticket in Build Pipeline Kanban.
6. Verify environments:
   - Connect GitHub repository URL and developer sync email.
   - Assign Lovable workspace project.
   - Set Google AI Studio model endpoint & API keys.`,
  },
  {
    id: "sk-frontend-constitution",
    title: "Frontend Design Constitution & Anti-AI Slop Rules",
    category: "Frontend Design",
    description:
      "Universal design guidelines: zero-pill discipline, typographic hierarchy with Plus Jakarta Sans and JetBrains Mono, viewport presence, and high-impact contrast.",
    tags: ["UI/UX", "Design System", "Tailwind CSS", "Typography"],
    target_models: ["Gemini 2.5 Pro", "Claude 3.7", "Lovable AI"],
    author: "Design Systems Team",
    version: "3.1",
    created_at: "2026-03-05T12:00:00Z",
    content: `# Frontend Design Constitution (v3.1)

### 1. Typographic Hierarchy
- **Primary Sans**: "Plus Jakarta Sans" for all headings and body copy.
- **Monospace**: "JetBrains Mono" with font-variant-numeric: tabular-nums for numeric KPIs, credits, currencies, and IDs.
- **Micro-type**: 10px-11px uppercase tracking-[0.16em] for section labels and status micro-badges.

### 2. Zero-Pill Discipline
- Avoid generic pill-shaped badges plastered indiscriminately.
- Prefer structured rectangular badges with subtle rounded-lg or rounded-xl corners, fine border lines (border-border/60), and dark tinted backgrounds.

### 3. Glassmorphic Surface Architecture
- Use subtle gradient borders: border-border bg-card/90 backdrop-blur-md.
- Maintain dark-mode contrast with deep background slate-950, elevated cards in slate-900/60, and primary emerald/violet accent glow.

### 4. High Viewport Presence & Responsiveness
- Grid layouts must gracefully collapse on mobile devices (<768px).
- Provide quick select drop-downs and sticky action headers on narrow viewports.`,
  },
  {
    id: "sk-fullstack-architecture",
    title: "Lovable & TanStack Start Full-Stack Architecture",
    category: "Engineering",
    description:
      "Design pattern for full-stack React 19 apps using TanStack Start, SSR server functions (createServerFn), and Supabase persistence.",
    tags: ["TanStack Start", "React 19", "Server Functions", "Supabase"],
    target_models: ["Lovable AI", "Senior Engineer Agent"],
    author: "Architecture Team",
    version: "2.0",
    created_at: "2026-03-10T14:30:00Z",
    content: `// Type-safe server function with authenticated Supabase context
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UpdatePipelineInput = {
  projectId: string;
  stage: "Planning" | "Building" | "Testing" | "Shipped";
  notes?: string;
};

export const updateProjectStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: UpdatePipelineInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: updated, error } = await supabase
      .from("projects")
      .update({
        build_stage: data.stage,
        notes: data.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.projectId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Write audit event
    await supabase.from("entity_events").insert({
      entity_table: "projects",
      entity_id: data.projectId,
      action: "update",
      actor: userId,
      change_reason: \`Advanced project stage to \${data.stage}\`,
    });

    return { ok: true, project: updated };
  });`,
  },
  {
    id: "sk-vault-security",
    title: "Credential Vault & Role Separation Guide",
    category: "Security",
    description:
      "Rules for managing sensitive client credentials, application-level encryption (AES-256-GCM), and append-only audit logging.",
    tags: ["AES-256", "Security", "Encryption", "Audit"],
    target_models: ["Security Architect", "Universal"],
    author: "Security Officer",
    version: "1.8",
    created_at: "2026-03-12T09:15:00Z",
    content: `# Credential Vault Security & Encryption Rules

1. **Envelope Encryption**:
   - Store all platform passwords encrypted using AES-256-GCM.
   - Master key is retrieved server-side via environment secrets; never leak to client bundle.

2. **Zero-Trust Access**:
   - Every single password reveal request writes an append-only entry to 'credential_access_log'.
   - Record requesting user ID, IP address, target entity ID, and timestamp.

3. **Role Segregation**:
   - Sales reps and guest contributors cannot decrypt production server or database passwords.
   - Restrict bulk reveal exports.

4. **Credential Rotation**:
   - Enforce 90-day password freshness checks.
   - Flag stale credentials in Project Accounts view.`,
  },
  {
    id: "sk-gemini-interactions",
    title: "Google AI Studio & Gemini API Integration Blueprint",
    category: "AI & Prompts",
    description:
      "Integration guide for @google/genai TypeScript SDK, covering structured JSON outputs, streaming generation, and system instructions.",
    tags: ["Gemini API", "AI Studio", "SDK", "Streaming"],
    target_models: ["Gemini 2.5 Pro", "Gemini 2.5 Flash"],
    author: "AI Platform Engineer",
    version: "2.2",
    created_at: "2026-03-15T16:00:00Z",
    content: `// Google AI Studio / Gemini Integration Pattern
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI();

export async function generateDashboardSpec(brief: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: brief,
    config: {
      systemInstruction: \`You are an elite enterprise UX engineer building responsive modern dashboards.
Generate modular layouts, KPI cards, Recharts visualizations, and responsive grids.\`,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  return JSON.parse(response.text || "{}");
}`,
  },
  {
    id: "sk-finance-allocation",
    title: "Multi-Month Payment Allocation Flow",
    category: "Finance",
    description:
      "Algorithm for recording upfront retainers (3, 6, 12 months) and computing active 'Paid Through' periods without false overdue reminders.",
    tags: ["Finance", "Billing", "Retainers", "Math"],
    target_models: ["Finance Agent", "Operations"],
    author: "Chief Financial Officer",
    version: "1.5",
    created_at: "2026-03-18T11:20:00Z",
    content: `# Multi-Month Payment Allocation Flow

1. **Covered Period Calculation**:
   - Each payment row stores 'covers_period_start' and 'covers_period_end'.
   - The client's headline 'Paid Through' date equals the maximum covered period end date across all payments.

2. **Quiet Period Enforcement**:
   - Invoicing and payment reminders go completely quiet until 5 calendar days prior to the covered period end date.
   - Prevents frustrating false-positive overdue notices for clients on quarterly/annual prepayment.

3. **Revenue Recognition**:
   - Monthly recognized revenue = Total Retainer Paid / Duration Months.
   - Show both 'Cash Collected' and 'Amortized Monthly MRR' on executive dashboard.`,
  },
];

// ==========================================
// 2. DASHBOARD INSPO DEFINITIONS & PRESETS
// ==========================================

export interface DashboardInspo {
  id: string;
  title: string;
  category:
    | "Executive SaaS"
    | "Dark Glassmorphism"
    | "Analytics & BI"
    | "Fintech & Payments"
    | "Kanban & Pipelines"
    | "Mobile & Responsive"
    | "Minimalist Clean";
  description: string;
  imageUrl: string;
  tags: string[];
  styleNotes: string;
  promptRecipe: string;
  author?: string;
  created_at: string;
}

export const STORAGE_KEY_LIBRARY_INSPO = "agency_library_inspo_store_v1";

// High quality SVG UI mockups stored as clean data URLs for immediate crisp render
const SVG_MOCKUP_EXECUTIVE_DARK = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" rx="16" fill="%23090d16"/><rect x="24" y="24" width="752" height="60" rx="12" fill="%23111827" stroke="%231f2937" stroke-width="1"/><circle cx="56" cy="54" r="16" fill="%2310b981" fill-opacity="0.2"/><path d="M50 54 L54 58 L62 50" stroke="%2310b981" stroke-width="2" fill="none"/><text x="86" y="52" fill="%23f9fafb" font-family="system-ui" font-weight="700" font-size="16">Executive Agency Command</text><text x="86" y="68" fill="%239ca3af" font-family="system-ui" font-size="12">Real-time MRR, Team Velocity %26 Delivery Health</text><rect x="650" y="38" width="110" height="32" rx="8" fill="%2310b981" /><text x="672" y="59" fill="%23064e3b" font-family="system-ui" font-weight="700" font-size="12">+ New Project</text><rect x="24" y="100" width="235" height="110" rx="12" fill="%23111827" stroke="%231f2937" /><text x="44" y="130" fill="%239ca3af" font-family="system-ui" font-size="12" font-weight="600">MONTHLY RECURRING (MRR)</text><text x="44" y="165" fill="%23f9fafb" font-family="system-ui" font-size="28" font-weight="800">$142,500</text><text x="44" y="192" fill="%2310b981" font-family="system-ui" font-size="12" font-weight="600">+18.4%25 vs prior month</text><rect x="283" y="100" width="235" height="110" rx="12" fill="%23111827" stroke="%231f2937" /><text x="303" y="130" fill="%239ca3af" font-family="system-ui" font-size="12" font-weight="600">ACTIVE CLIENT BUILDS</text><text x="303" y="165" fill="%23f9fafb" font-family="system-ui" font-size="28" font-weight="800">28 Projects</text><text x="303" y="192" fill="%2338bdf8" font-family="system-ui" font-size="12" font-weight="600">4 Shipped this week</text><rect x="541" y="100" width="235" height="110" rx="12" fill="%23111827" stroke="%231f2937" /><text x="561" y="130" fill="%239ca3af" font-family="system-ui" font-size="12" font-weight="600">BUILDER POOL CREDITS</text><text x="561" y="165" fill="%23f9fafb" font-family="system-ui" font-size="28" font-weight="800">18,450</text><text x="561" y="192" fill="%23a78bfa" font-family="system-ui" font-size="12" font-weight="600">Across 4 Google Accounts</text><rect x="24" y="226" width="494" height="250" rx="12" fill="%23111827" stroke="%231f2937"/><text x="44" y="258" fill="%23f9fafb" font-family="system-ui" font-weight="700" font-size="14">Revenue %26 Pipeline Velocity</text><polyline points="44,430 110,400 180,415 260,360 340,330 420,350 490,290" fill="none" stroke="%2310b981" stroke-width="3"/><path d="M44 430 L110 400 L180 415 L260 360 L340 330 L420 350 L490 290 L490 440 L44 440 Z" fill="%2310b981" fill-opacity="0.1"/><rect x="534" y="226" width="242" height="250" rx="12" fill="%23111827" stroke="%231f2937"/><text x="554" y="258" fill="%23f9fafb" font-family="system-ui" font-weight="700" font-size="14">Stage Breakdown</text><circle cx="655" cy="350" r="60" stroke="%23374151" stroke-width="20" fill="none"/><circle cx="655" cy="350" r="60" stroke="%2310b981" stroke-width="20" stroke-dasharray="240 380" fill="none"/><text x="655" y="356" text-anchor="middle" fill="%23f9fafb" font-family="system-ui" font-weight="800" font-size="18">68%25</text><text x="655" y="372" text-anchor="middle" fill="%239ca3af" font-family="system-ui" font-size="10">ON TRACK</text></svg>`;

const SVG_MOCKUP_KANBAN_PIPELINE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" rx="16" fill="%230a0f1d"/><rect x="24" y="24" width="752" height="48" rx="10" fill="%23111a2e" stroke="%231e293b" stroke-width="1"/><text x="44" y="54" fill="%23f8fafc" font-family="system-ui" font-weight="700" font-size="15">Production Build Pipeline (Multi-Stage Kanban)</text><rect x="680" y="34" width="80" height="28" rx="6" fill="%2338bdf8" fill-opacity="0.2"/><text x="696" y="52" fill="%2338bdf8" font-family="system-ui" font-weight="600" font-size="11">4 Stages</text><rect x="24" y="88" width="176" height="388" rx="10" fill="%230f172a" stroke="%231e293b"/><rect x="36" y="100" width="152" height="26" rx="6" fill="%23334155"/><text x="46" y="117" fill="%2394a3b8" font-family="system-ui" font-weight="700" font-size="11">PLANNING (3)</text><rect x="36" y="136" width="152" height="90" rx="8" fill="%231e293b" stroke="%23334155"/><text x="48" y="160" fill="%23f8fafc" font-family="system-ui" font-weight="600" font-size="12">SaaS CRM Portal</text><text x="48" y="178" fill="%2394a3b8" font-family="system-ui" font-size="10">Client: Horizon Ltd</text><rect x="48" y="195" width="56" height="18" rx="4" fill="%2338bdf8" fill-opacity="0.2"/><text x="56" y="208" fill="%2338bdf8" font-family="system-ui" font-size="9">Lovable</text><rect x="216" y="88" width="176" height="388" rx="10" fill="%230f172a" stroke="%231e293b"/><rect x="228" y="100" width="152" height="26" rx="6" fill="%231e3a8a" fill-opacity="0.4"/><text x="238" y="117" fill="%2360a5fa" font-family="system-ui" font-weight="700" font-size="11">BUILDING (8)</text><rect x="228" y="136" width="152" height="100" rx="8" fill="%231e293b" stroke="%232563eb"/><text x="240" y="160" fill="%23f8fafc" font-family="system-ui" font-weight="600" font-size="12">Fintech Card Gateway</text><text x="240" y="178" fill="%2394a3b8" font-family="system-ui" font-size="10">Branch: feature-auth</text><rect x="240" y="195" width="65" height="18" rx="4" fill="%2310b981" fill-opacity="0.2"/><text x="246" y="208" fill="%2310b981" font-family="system-ui" font-size="9">AI Studio</text><rect x="228" y="246" width="152" height="80" rx="8" fill="%231e293b" stroke="%23334155"/><text x="240" y="270" fill="%23f8fafc" font-family="system-ui" font-weight="600" font-size="12">HealthSync Web App</text><rect x="408" y="88" width="176" height="388" rx="10" fill="%230f172a" stroke="%231e293b"/><rect x="420" y="100" width="152" height="26" rx="6" fill="%23701a75" fill-opacity="0.4"/><text x="430" y="117" fill="%23e879f9" font-family="system-ui" font-weight="700" font-size="11">TESTING (4)</text><rect x="420" y="136" width="152" height="90" rx="8" fill="%231e293b" stroke="%23c026d3"/><text x="432" y="160" fill="%23f8fafc" font-family="system-ui" font-weight="600" font-size="12">Solar Quote Engine</text><text x="432" y="178" fill="%2394a3b8" font-family="system-ui" font-size="10">Staging: solar.preview</text><rect x="600" y="88" width="176" height="388" rx="10" fill="%230f172a" stroke="%231e293b"/><rect x="612" y="100" width="152" height="26" rx="6" fill="%23064e3b" fill-opacity="0.6"/><text x="622" y="117" fill="%2334d399" font-family="system-ui" font-weight="700" font-size="11">SHIPPED (14)</text><rect x="612" y="136" width="152" height="90" rx="8" fill="%231e293b" stroke="%23059669"/><text x="624" y="160" fill="%23f8fafc" font-family="system-ui" font-weight="600" font-size="12">Omni Storefront</text><text x="624" y="178" fill="%2394a3b8" font-family="system-ui" font-size="10">Live on Custom Domain</text></svg>`;

const SVG_MOCKUP_FINTECH_METRICS = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" rx="16" fill="%230b0e17"/><rect x="24" y="24" width="752" height="70" rx="12" fill="%23121727" stroke="%231e2640"/><text x="48" y="58" fill="%23f1f5f9" font-family="system-ui" font-weight="800" font-size="18">Fintech Agency Treasury %26 Retainers</text><text x="48" y="78" fill="%2364748b" font-family="system-ui" font-size="12">Multi-month cash collections, contractor payouts %26 runway</text><rect x="24" y="110" width="364" height="170" rx="12" fill="%23121727" stroke="%231e2640"/><text x="48" y="142" fill="%2394a3b8" font-family="system-ui" font-size="12" font-weight="600">COLLECTED RETAINERS (MTD)</text><text x="48" y="186" fill="%2338bdf8" font-family="system-ui" font-size="34" font-weight="800">$218,400.00</text><rect x="48" y="206" width="140" height="24" rx="6" fill="%230284c7" fill-opacity="0.2"/><text x="56" y="222" fill="%2338bdf8" font-family="system-ui" font-size="11">12 Paid Clients Active</text><rect x="412" y="110" width="364" height="170" rx="12" fill="%23121727" stroke="%231e2640"/><text x="436" y="142" fill="%2394a3b8" font-family="system-ui" font-size="12" font-weight="600">NET AGENCY OPERATING PROFIT</text><text x="436" y="186" fill="%2310b981" font-family="system-ui" font-size="34" font-weight="800">$84,650.00</text><text x="436" y="222" fill="%2310b981" font-family="system-ui" font-size="12" font-weight="600">38.7%25 Net Margin</text><rect x="24" y="300" width="752" height="176" rx="12" fill="%23121727" stroke="%231e2640"/><text x="48" y="332" fill="%23f1f5f9" font-family="system-ui" font-weight="700" font-size="14">Recent Invoices %26 Retainers</text><line x1="48" y1="350" x2="728" y2="350" stroke="%231e2640"/><text x="48" y="380" fill="%23e2e8f0" font-family="system-ui" font-weight="600" font-size="13">Apex Dynamics — $12,000.00</text><text x="540" y="380" fill="%2310b981" font-family="system-ui" font-size="12">Paid Through Sep 2026</text><text x="48" y="420" fill="%23e2e8f0" font-family="system-ui" font-weight="600" font-size="13">Vanguard Retail — $8,500.00</text><text x="540" y="420" fill="%2310b981" font-family="system-ui" font-size="12">Paid Through Aug 2026</text><text x="48" y="460" fill="%23e2e8f0" font-family="system-ui" font-weight="600" font-size="13">Nebula Labs — $15,000.00</text><text x="540" y="460" fill="%23f59e0b" font-family="system-ui" font-size="12">Due in 4 Days</text></svg>`;

const SVG_MOCKUP_GLASSMORPHIC_AI = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="grad1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%25" stop-color="%236366f1" stop-opacity="0.3"/><stop offset="100%25" stop-color="%23ec4899" stop-opacity="0.2"/></linearGradient></defs><rect width="800" height="500" rx="16" fill="%2305070e"/><circle cx="700" cy="80" r="180" fill="%23818cf8" fill-opacity="0.08"/><circle cx="100" cy="400" r="150" fill="%23ec4899" fill-opacity="0.06"/><rect x="30" y="30" width="740" height="440" rx="16" fill="%230f172a" fill-opacity="0.6" stroke="%23334155" stroke-opacity="0.5"/><text x="60" y="70" fill="%23ffffff" font-family="system-ui" font-weight="800" font-size="20">AI Autonomous Agents %26 Builder Mesh</text><text x="60" y="92" fill="%2394a3b8" font-family="system-ui" font-size="12">Multi-agent build pipeline: Gemini Flash 2.5 + Lovable Engine</text><rect x="60" y="120" width="320" height="150" rx="12" fill="url(%23grad1)" stroke="%23818cf8" stroke-opacity="0.4"/><text x="80" y="152" fill="%23ffffff" font-family="system-ui" font-weight="700" font-size="14">Code Synthesis Agent</text><text x="80" y="176" fill="%23c7d2fe" font-family="system-ui" font-size="12">Active on 4 branches. Zero compile errors.</text><text x="80" y="210" fill="%2334d399" font-family="system-ui" font-weight="600" font-size="12">● Status: Running (98.4%25 health)</text><rect x="420" y="120" width="320" height="150" rx="12" fill="%231e293b" fill-opacity="0.6" stroke="%23475569" stroke-opacity="0.5"/><text x="440" y="152" fill="%23ffffff" font-family="system-ui" font-weight="700" font-size="14">Design Token Auditor</text><text x="440" y="176" fill="%2394a3b8" font-family="system-ui" font-size="12">Enforces Zero-Pill %26 Plus Jakarta typography.</text><text x="440" y="210" fill="%2338bdf8" font-family="system-ui" font-weight="600" font-size="12">● 14 Components Checked</text><rect x="60" y="300" width="680" height="140" rx="12" fill="%23111c33" fill-opacity="0.5" stroke="%231e293b"/><text x="80" y="332" fill="%23f8fafc" font-family="system-ui" font-weight="700" font-size="13">Live Prompt Stream Console</text><text x="80" y="360" fill="%2338bdf8" font-family="monospace" font-size="11">> [GEMINI_PRO] Synthesizing component ProjectEnvironmentsHub.tsx...</text><text x="80" y="382" fill="%23a78bfa" font-family="monospace" font-size="11">> [LOVABLE_OS] Linking builder account princeyvon30@gmail.com (5000 credits available)</text><text x="80" y="404" fill="%2334d399" font-family="monospace" font-size="11">> [BUILD_CHECK] Vite compile successful in 340ms.</text></svg>`;

export const DEFAULT_DASHBOARD_INSPO: DashboardInspo[] = [
  {
    id: "inspo-exec-dark",
    title: "Executive SaaS Command & KPI Bento",
    category: "Executive SaaS",
    description:
      "Deep slate dark-mode command center with high-contrast MRR metric cards, Recharts velocity curve, and donut stage breakdown.",
    imageUrl: SVG_MOCKUP_EXECUTIVE_DARK,
    tags: ["Dark Mode", "MRR", "Recharts", "Executive", "Bento Grid"],
    styleNotes:
      "Base background #090d16 with #111827 card containers. Emerald accent #10b981 for growth numbers. Tabular numeric fonts.",
    promptRecipe:
      "Create a sleek executive SaaS command center in Tailwind CSS. Use dark slate-950 background, frosted card borders border-border/70, 3 top KPI summary cards with tabular numbers for MRR and active projects, followed by an area revenue chart and a stage breakdown gauge.",
    author: "Lovable Design Team",
    created_at: "2026-03-10T12:00:00Z",
  },
  {
    id: "inspo-kanban-pipeline",
    title: "Multi-Stage Production Build Pipeline",
    category: "Kanban & Pipelines",
    description:
      "Smooth 4-column responsive Kanban board with stage badges, environment tags (Lovable, AI Studio), and drag/drop card design.",
    imageUrl: SVG_MOCKUP_KANBAN_PIPELINE,
    tags: ["Kanban", "Pipeline", "DevOps", "Multi-Env", "Cards"],
    styleNotes:
      "4 stage columns: Planning, Building, Testing, Shipped with distinct colored header caps and active project indicators.",
    promptRecipe:
      "Build a responsive multi-stage build pipeline Kanban board. 4 columns: Planning, Building, Testing, Shipped. Each card shows project title, client, branch tag, and active builder environment micro-badge (Lovable, AI Studio). Include quick action menu on cards.",
    author: "Product Architecture",
    created_at: "2026-03-12T15:30:00Z",
  },
  {
    id: "inspo-fintech-metrics",
    title: "Fintech Agency Treasury & Retainer Engine",
    category: "Fintech & Payments",
    description:
      "Financial dashboard tracking upfront multi-month retainers, gross collected revenue, contractor payouts, and client payment health.",
    imageUrl: SVG_MOCKUP_FINTECH_METRICS,
    tags: ["Fintech", "Treasury", "Retainers", "Cash Flow", "Invoicing"],
    styleNotes:
      "Sky-blue and emerald gradients. Clear visual distinction between paid-through dates and upcoming renewals.",
    promptRecipe:
      "Design a modern dark fintech dashboard tracking agency retainers. Highlight MTD collected cash, net operating profit, and a table of clients with their paid-through date and multi-month allocation badges.",
    author: "Finance Systems",
    created_at: "2026-03-15T09:00:00Z",
  },
  {
    id: "inspo-glassmorphic-ai",
    title: "Autonomous AI Mesh & Agent Console",
    category: "Dark Glassmorphism",
    description:
      "Futuristic glassmorphic HUD for monitoring autonomous AI agents, prompt streaming, model credit burn rate, and build logs.",
    imageUrl: SVG_MOCKUP_GLASSMORPHIC_AI,
    tags: ["Glassmorphism", "AI Agents", "HUD", "Terminal", "Gemini"],
    styleNotes:
      "Radial ambient backdrop glows with frosted backdrop-blur-md cards. Monospace live log output with color-coded log streams.",
    promptRecipe:
      "Generate a futuristic glassmorphic developer HUD for monitoring AI agents. Semi-transparent slate-900 panels with indigo glow borders, agent status cards, and an embedded terminal log stream displaying live model activities.",
    author: "AI Core Team",
    created_at: "2026-03-18T18:00:00Z",
  },
];

// ==========================================
// 3. TEXT PROMPTS DEFINITIONS & PRESETS
// ==========================================

export interface LibraryTextPrompt {
  id: string;
  title: string;
  category:
    | "Dashboard Layouts"
    | "KPI & Metric Visualizations"
    | "Glassmorphic & Theming"
    | "Full-Stack Server Functions"
    | "Client Onboarding & Emails"
    | "Security & Auth"
    | "Bug Fixing & Refactoring";
  description: string;
  promptText: string;
  variables?: string[];
  targetEngine: "Lovable AI" | "Google AI Studio / Gemini" | "Claude 3.7" | "Universal";
  tags: string[];
  author?: string;
  created_at: string;
}

export const STORAGE_KEY_LIBRARY_PROMPTS = "agency_library_prompts_store_v1";

export const DEFAULT_LIBRARY_PROMPTS: LibraryTextPrompt[] = [
  {
    id: "prompt-bento-dashboard",
    title: "Executive Bento Grid Dashboard Generator",
    category: "Dashboard Layouts",
    description:
      "Master prompt for generating clean, high-density Bento grid dashboards with responsive metric cards, sparklines, and filter bars.",
    tags: ["Bento Grid", "Dashboard", "Tailwind CSS", "Recharts"],
    targetEngine: "Lovable AI",
    variables: ["client_name", "primary_kpis", "theme_accent"],
    author: "Principal Designer",
    created_at: "2026-03-08T10:00:00Z",
    promptText: `Create an executive production-grade SaaS dashboard for {{client_name}} using React 19, Tailwind CSS, and Lucide icons.

Specifications:
1. Header & Navigation:
   - Sticky top bar with workspace title, subtitle, date range switcher, and "+ New Action" primary button.
   - Micro-badge showing live system status and active environment.

2. Metric Bento Grid:
   - 4 KPI cards for {{primary_kpis}} featuring:
     * Label in 11px uppercase tracking-[0.16em] text-muted-foreground.
     * Big numeric value formatted with tabular numerals and font-bold.
     * Trend indicator with green/red pill and comparison against prior cycle.

3. Main Chart & Velocity Section:
   - 2-column or 3-column layout on desktop, stacked on mobile.
   - Recharts AreaChart with subtle gradient fill using {{theme_accent}} accent.
   - Clean custom tooltip with dark glass background and rounded corners.

4. Actionable Data Table / List:
   - Status pills for states (Active, Pending, Review).
   - Quick action dropdown (Edit, View Details, Copy ID).
   - Empty state illustration if zero items match filter.`,
  },
  {
    id: "prompt-kanban-pipeline",
    title: "Drag & Drop Multi-Environment Build Kanban",
    category: "Dashboard Layouts",
    description:
      "Prompt blueprint for building a multi-environment production pipeline with GitHub, Google AI Studio, and Lovable tags.",
    tags: ["Kanban", "Pipeline", "DevOps", "Multi-Env"],
    targetEngine: "Universal",
    variables: ["stages", "platforms"],
    author: "DevOps Engineer",
    created_at: "2026-03-10T14:00:00Z",
    promptText: `Implement a responsive build pipeline Kanban board for managing software releases.

Requirements:
- Column stages: {{stages}} (e.g. Planning, Building, Testing, Shipped).
- Card Anatomy:
  * Project name with clickable link to client details.
  * Multi-environment chips showing connected {{platforms}} (e.g. GitHub repo link, Lovable builder account, AI Studio project).
  * Assignee avatar with fallback initials.
  * Due date with warning badge if within 48 hours.
- Table & Kanban Switcher:
  * Segmented control toggle between Grid (Kanban) and Dense Table views.
  * Search bar with instant client/project filtering.
  * Modal dialog to create new project or reassign Google builder account.`,
  },
  {
    id: "prompt-dark-glassmorphism",
    title: "Dark Modern Glassmorphism Theme Constitution",
    category: "Glassmorphic & Theming",
    description:
      "Styling rules and prompt directives to eradicate AI slop and produce polished dark glass surfaces with crisp typography.",
    tags: ["Glassmorphism", "CSS", "Dark Mode", "Anti-Slop"],
    targetEngine: "Lovable AI",
    variables: ["brand_color", "font_display"],
    author: "Design Systems Lead",
    created_at: "2026-03-12T11:00:00Z",
    promptText: `Apply the Modern Dark Glassmorphic Design System:

1. Color Palette:
   - Root background: #07090e (deepest obsidian).
   - Elevated cards: bg-card/80 or rgba(17, 24, 39, 0.75) with backdrop-blur-md.
   - Borders: border border-border/70 with subtle inner glow.
   - Accent: {{brand_color}} glow on active states.

2. Typography:
   - Display: {{font_display}} (e.g. Plus Jakarta Sans) for crisp headings.
   - Code & Numbers: JetBrains Mono with tabular-nums.
   - Zero-Pill Rule: No excessive bubbly pill shapes; use structured rectangular badges with rounded-lg corners.

3. Interactivity:
   - Subtle scale hover on cards (hover:border-primary/50 transition-all duration-200).
   - Sleek scrollbars with custom thumb styling.
   - Accessible tooltips on icon-only buttons.`,
  },
  {
    id: "prompt-tanstack-serverfn",
    title: "TanStack Start Type-Safe Server Function with Supabase",
    category: "Full-Stack Server Functions",
    description:
      "Rock-solid full-stack pattern for TanStack Start SSR functions, validating inputs and enforcing Supabase authentication and audit logging.",
    tags: ["TanStack Start", "Server Functions", "Supabase", "TypeScript"],
    targetEngine: "Claude 3.7",
    variables: ["action_name", "input_schema", "table_name"],
    author: "Lead Architect",
    created_at: "2026-03-14T16:00:00Z",
    promptText: `Generate a production-grade TanStack Start server function for {{action_name}}.

Requirements:
1. Define input TypeScript type: {{input_schema}}.
2. Use createServerFn({ method: "POST" }) with requireSupabaseAuth middleware.
3. Perform database operations against Supabase table {{table_name}}.
4. Wrap with try/catch and handle foreign key constraints gracefully.
5. Record an append-only audit entry in 'entity_events' table containing:
   - entity_table: "{{table_name}}"
   - entity_id: record ID
   - action: "create" | "update" | "delete"
   - actor: context.userId
   - change_reason: human readable description.
6. Return a typed response { ok: boolean, data?: any, error?: string }.`,
  },
  {
    id: "prompt-multi-month-retainer",
    title: "Client Multi-Month Retainer & Invoicing Engine",
    category: "Client Onboarding & Emails",
    description:
      "Billing logic prompt for tracking upfront multi-month payments, calculating covered periods, and generating professional client receipts.",
    tags: ["Billing", "Retainers", "Finance", "Invoices"],
    targetEngine: "Universal",
    variables: ["client_name", "months_prepaid", "total_amount"],
    author: "Finance Operations",
    created_at: "2026-03-16T13:30:00Z",
    promptText: `Implement the multi-month retainer allocation logic for client {{client_name}}:

1. Input parameters:
   - Total retainer: {{total_amount}}
   - Covered duration: {{months_prepaid}} months
   - Payment date: Today

2. Calculations:
   - Calculate 'covers_period_start' (first day of current billing cycle).
   - Calculate 'covers_period_end' (date exactly {{months_prepaid}} months ahead minus 1 day).
   - Set client 'paid_through' date to 'covers_period_end'.
   - Compute monthly amortized MRR = {{total_amount}} / {{months_prepaid}}.

3. Automation:
   - Suppress automated overdue notifications until 5 days before 'covers_period_end'.
   - Generate client receipt with itemized period breakdown and VAT/Tax ID.`,
  },
  {
    id: "prompt-diagnostic-bugfixer",
    title: "Self-Healing Diagnostic & Edge-Case Bug Fixer",
    category: "Bug Fixing & Refactoring",
    description:
      "Diagnostic prompt to systematically locate null pointers, missing store fallbacks, and mobile layout clipping without breaking existing code.",
    tags: ["Debugging", "Refactoring", "Edge Cases", "Quality"],
    targetEngine: "Google AI Studio / Gemini",
    variables: ["error_symptom", "affected_components"],
    author: "QA & Reliability",
    created_at: "2026-03-18T10:00:00Z",
    promptText: `Perform a systematic diagnostic and repair of the following issue:

Symptom: {{error_symptom}}
Affected Component(s): {{affected_components}}

Protocol:
1. Trace root cause across data flow: check server function inputs, database query errors, and client state fallbacks.
2. Ensure resilient fallbacks: if an entity or foreign key is not found, auto-resolve to default seed store or graceful placeholder instead of throwing unhandled exceptions.
3. Validate mobile viewports: verify responsive container widths, max-heights on modals, and prevent horizontal layout blowouts.
4. Verify TypeScript compilation: ensure all imports match exact paths and zero build errors exist.`,
  },
];

// ==========================================
// 4. STORAGE & SYNC HELPER FUNCTIONS
// ==========================================

export function getLocalSkills(): LibrarySkill[] {
  if (typeof window === "undefined") return DEFAULT_LIBRARY_SKILLS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_LIBRARY_SKILLS);
    if (!raw) {
      saveLocalSkills(DEFAULT_LIBRARY_SKILLS);
      return DEFAULT_LIBRARY_SKILLS;
    }
    const parsed: LibrarySkill[] = JSON.parse(raw);
    const existingIds = new Set(parsed.map((s) => s.id));
    let modified = false;
    for (const def of DEFAULT_LIBRARY_SKILLS) {
      if (!existingIds.has(def.id)) {
        parsed.push(def);
        modified = true;
      }
    }
    if (modified) saveLocalSkills(parsed);
    return parsed;
  } catch {
    return DEFAULT_LIBRARY_SKILLS;
  }
}

export const STORAGE_KEY_LIBRARY_AUDIT = "agency_library_audit_events_v1";

export interface LibraryAuditEvent {
  id: string;
  entity_table: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  actor?: string;
  change_reason: string;
  created_at: string;
}

export function getLocalAuditEvents(): LibraryAuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_LIBRARY_AUDIT);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordLibraryAuditEvent(evt: {
  entity_table: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  actor?: string;
  change_reason: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalAuditEvents();
    const newEntry: LibraryAuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...evt,
      created_at: new Date().toISOString(),
    };
    const updated = [newEntry, ...current].slice(0, 300); // keep up to 300 events
    window.localStorage.setItem(STORAGE_KEY_LIBRARY_AUDIT, JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not save audit event:", err);
  }
}

export function clearLocalAuditEvents(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY_LIBRARY_AUDIT);
  } catch (err) {
    console.warn("Could not clear audit events:", err);
  }
}

export function saveLocalSkills(skills: LibrarySkill[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_LIBRARY_SKILLS, JSON.stringify(skills));
  } catch (err) {
    console.warn("Could not save skills to localStorage:", err);
  }
}

export function upsertSkill(skill: LibrarySkill): LibrarySkill[] {
  const current = getLocalSkills();
  const idx = current.findIndex((s) => s.id === skill.id);
  let updated: LibrarySkill[];
  const isUpdate = idx >= 0;
  if (isUpdate) {
    updated = [...current];
    updated[idx] = { ...updated[idx], ...skill, updated_at: new Date().toISOString() };
  } else {
    updated = [skill, ...current];
  }
  saveLocalSkills(updated);
  void persistLibraryItem("skill", skill);

  broadcastDbSync({
    type: "library_skill_updated",
    id: skill.id,
    payload: { action: isUpdate ? "update" : "create", title: skill.title },
  });

  recordLibraryAuditEvent({
    entity_table: "library_skills",
    entity_id: skill.id,
    action: isUpdate ? "update" : "create",
    change_reason: `${isUpdate ? "Updated" : "Created"} library skill: ${skill.title} (${skill.category})`,
  });

  // Record audit event to Supabase asynchronously
  try {
    supabase
      .from("entity_events")
      .insert({
        entity_table: "library_skills",
        entity_id: skill.id,
        action: isUpdate ? "update" : "create",
        change_reason: `${isUpdate ? "Updated" : "Created"} library skill: ${skill.title} (${skill.category})`,
      })
      .then(() => {});
  } catch {
    // ignore
  }

  return updated;
}

export function deleteSkill(id: string): LibrarySkill[] {
  const current = getLocalSkills();
  const item = current.find((s) => s.id === id);
  const updated = current.filter((s) => s.id !== id);
  saveLocalSkills(updated);
  void removeLibraryItem(id);

  broadcastDbSync({
    type: "library_skill_updated",
    id,
    payload: { action: "delete", title: item?.title },
  });

  recordLibraryAuditEvent({
    entity_table: "library_skills",
    entity_id: id,
    action: "delete",
    change_reason: `Deleted library skill: ${item?.title || id}`,
  });

  try {
    supabase
      .from("entity_events")
      .insert({
        entity_table: "library_skills",
        entity_id: id,
        action: "delete",
        change_reason: `Deleted library skill: ${item?.title || id}`,
      })
      .then(() => {});
  } catch {
    // ignore
  }

  return updated;
}

// Inspo storage functions
export function getLocalInspo(): DashboardInspo[] {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_INSPO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_LIBRARY_INSPO);
    if (!raw) {
      saveLocalInspo(DEFAULT_DASHBOARD_INSPO);
      return DEFAULT_DASHBOARD_INSPO;
    }
    const parsed: DashboardInspo[] = JSON.parse(raw);
    const existingIds = new Set(parsed.map((i) => i.id));
    let modified = false;
    for (const def of DEFAULT_DASHBOARD_INSPO) {
      if (!existingIds.has(def.id)) {
        parsed.push(def);
        modified = true;
      }
    }
    if (modified) saveLocalInspo(parsed);
    return parsed;
  } catch {
    return DEFAULT_DASHBOARD_INSPO;
  }
}

export function saveLocalInspo(items: DashboardInspo[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_LIBRARY_INSPO, JSON.stringify(items));
  } catch (err) {
    console.warn("Could not save inspo to localStorage:", err);
  }
}

export function upsertInspo(item: DashboardInspo): DashboardInspo[] {
  const current = getLocalInspo();
  const idx = current.findIndex((i) => i.id === item.id);
  let updated: DashboardInspo[];
  const isUpdate = idx >= 0;
  if (isUpdate) {
    updated = [...current];
    updated[idx] = { ...updated[idx], ...item };
  } else {
    updated = [item, ...current];
  }
  saveLocalInspo(updated);
  void persistLibraryItem("inspo", item);

  broadcastDbSync({
    type: "library_inspo_updated",
    id: item.id,
    payload: { action: isUpdate ? "update" : "create", title: item.title },
  });

  recordLibraryAuditEvent({
    entity_table: "dashboard_inspo",
    entity_id: item.id,
    action: isUpdate ? "update" : "create",
    change_reason: `${isUpdate ? "Updated" : "Added"} dashboard inspo: ${item.title} (${item.category})`,
  });

  try {
    supabase
      .from("entity_events")
      .insert({
        entity_table: "dashboard_inspo",
        entity_id: item.id,
        action: isUpdate ? "update" : "create",
        change_reason: `${isUpdate ? "Updated" : "Added"} dashboard inspo: ${item.title} (${item.category})`,
      })
      .then(() => {});
  } catch {
    // ignore
  }

  return updated;
}

export function deleteInspo(id: string): DashboardInspo[] {
  const current = getLocalInspo();
  const item = current.find((i) => i.id === id);
  const updated = current.filter((i) => i.id !== id);
  saveLocalInspo(updated);
  void removeLibraryItem(id);

  broadcastDbSync({
    type: "library_inspo_updated",
    id,
    payload: { action: "delete", title: item?.title },
  });

  recordLibraryAuditEvent({
    entity_table: "dashboard_inspo",
    entity_id: id,
    action: "delete",
    change_reason: `Deleted dashboard inspo: ${item?.title || id}`,
  });

  try {
    supabase
      .from("entity_events")
      .insert({
        entity_table: "dashboard_inspo",
        entity_id: id,
        action: "delete",
        change_reason: `Deleted dashboard inspo: ${item?.title || id}`,
      })
      .then(() => {});
  } catch {
    // ignore
  }

  return updated;
}

// Prompts storage functions
export function getLocalPrompts(): LibraryTextPrompt[] {
  if (typeof window === "undefined") return DEFAULT_LIBRARY_PROMPTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_LIBRARY_PROMPTS);
    if (!raw) {
      saveLocalPrompts(DEFAULT_LIBRARY_PROMPTS);
      return DEFAULT_LIBRARY_PROMPTS;
    }
    const parsed: LibraryTextPrompt[] = JSON.parse(raw);
    const existingIds = new Set(parsed.map((p) => p.id));
    let modified = false;
    for (const def of DEFAULT_LIBRARY_PROMPTS) {
      if (!existingIds.has(def.id)) {
        parsed.push(def);
        modified = true;
      }
    }
    if (modified) saveLocalPrompts(parsed);
    return parsed;
  } catch {
    return DEFAULT_LIBRARY_PROMPTS;
  }
}

export function saveLocalPrompts(prompts: LibraryTextPrompt[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_LIBRARY_PROMPTS, JSON.stringify(prompts));
  } catch (err) {
    console.warn("Could not save prompts to localStorage:", err);
  }
}

export function upsertPrompt(prompt: LibraryTextPrompt): LibraryTextPrompt[] {
  const current = getLocalPrompts();
  const idx = current.findIndex((p) => p.id === prompt.id);
  let updated: LibraryTextPrompt[];
  const isUpdate = idx >= 0;
  if (isUpdate) {
    updated = [...current];
    updated[idx] = { ...updated[idx], ...prompt };
  } else {
    updated = [prompt, ...current];
  }
  saveLocalPrompts(updated);
  void persistLibraryItem("prompt", prompt);

  broadcastDbSync({
    type: "library_prompt_updated",
    id: prompt.id,
    payload: { action: isUpdate ? "update" : "create", title: prompt.title },
  });

  recordLibraryAuditEvent({
    entity_table: "library_prompts",
    entity_id: prompt.id,
    action: isUpdate ? "update" : "create",
    change_reason: `${isUpdate ? "Updated" : "Saved"} AI text prompt: ${prompt.title} (${prompt.category})`,
  });

  try {
    supabase
      .from("entity_events")
      .insert({
        entity_table: "library_prompts",
        entity_id: prompt.id,
        action: isUpdate ? "update" : "create",
        change_reason: `${isUpdate ? "Updated" : "Saved"} AI text prompt: ${prompt.title} (${prompt.category})`,
      })
      .then(() => {});
  } catch {
    // ignore
  }

  return updated;
}

export function deletePrompt(id: string): LibraryTextPrompt[] {
  const current = getLocalPrompts();
  const item = current.find((p) => p.id === id);
  const updated = current.filter((p) => p.id !== id);
  saveLocalPrompts(updated);
  void removeLibraryItem(id);

  broadcastDbSync({
    type: "library_prompt_updated",
    id,
    payload: { action: "delete", title: item?.title },
  });

  recordLibraryAuditEvent({
    entity_table: "library_prompts",
    entity_id: id,
    action: "delete",
    change_reason: `Deleted AI text prompt: ${item?.title || id}`,
  });

  try {
    supabase
      .from("entity_events")
      .insert({
        entity_table: "library_prompts",
        entity_id: id,
        action: "delete",
        change_reason: `Deleted AI text prompt: ${item?.title || id}`,
      })
      .then(() => {});
  } catch {
    // ignore
  }

  return updated;
}

// ==========================================
// 4.5 CLOUD DATABASE SYNC (library_items)
// ==========================================

type LibraryKind = "skill" | "inspo" | "prompt";

function cacheFor(kind: LibraryKind, items: unknown[]) {
  if (kind === "skill") saveLocalSkills(items as LibrarySkill[]);
  else if (kind === "inspo") saveLocalInspo(items as DashboardInspo[]);
  else saveLocalPrompts(items as LibraryTextPrompt[]);
}

function defaultsFor(kind: LibraryKind): (LibrarySkill | DashboardInspo | LibraryTextPrompt)[] {
  if (kind === "skill") return DEFAULT_LIBRARY_SKILLS;
  if (kind === "inspo") return DEFAULT_DASHBOARD_INSPO;
  return DEFAULT_LIBRARY_PROMPTS;
}

let syncInFlight: Promise<void> | null = null;

/** Pull the shared library from the cloud database into the local cache.
 *  Seeds the standard presets into the database the first time it runs empty. */
export function syncLibraryFromDb(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    try {
      const { data, error } = await supabase
        .from("library_items")
        .select("item_id, kind, title, category, payload, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      const kinds: LibraryKind[] = ["skill", "inspo", "prompt"];
      const seedRows: Record<string, unknown>[] = [];
      for (const kind of kinds) {
        const ofKind = rows.filter((r) => r.kind === kind);
        if (ofKind.length === 0) {
          for (const def of defaultsFor(kind)) {
            seedRows.push({
              item_id: def.id,
              kind,
              title: def.title,
              category: def.category ?? null,
              payload: def,
            });
          }
          cacheFor(kind, defaultsFor(kind));
        } else {
          cacheFor(
            kind,
            ofKind.map((r) => ({ ...(r.payload as object), id: r.item_id })),
          );
        }
      }
      if (seedRows.length > 0) {
        await supabase.from("library_items").upsert(seedRows, { onConflict: "item_id" });
      }
      broadcastDbSync({ type: "library_synced", payload: { source: "db" } });
    } catch (err) {
      console.warn("Library cloud sync failed (using local cache):", err);
    }
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

export async function persistLibraryItem(
  kind: LibraryKind,
  item: { id: string; title: string; category?: string },
  sortOrder = 0,
): Promise<void> {
  try {
    const { error } = await supabase.from("library_items").upsert(
      {
        item_id: item.id,
        kind,
        title: item.title,
        category: item.category ?? null,
        payload: item,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "item_id" },
    );
    if (error) throw error;
  } catch (err) {
    console.warn("Could not save library item to cloud:", err);
  }
}

export async function removeLibraryItem(id: string): Promise<void> {
  try {
    const { error } = await supabase.from("library_items").delete().eq("item_id", id);
    if (error) throw error;
  } catch (err) {
    console.warn("Could not delete library item from cloud:", err);
  }
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let realtimeRefs = 0;

/** Subscribe to live library changes so edits on other devices appear here. */
export function initLibraryRealtime(): () => void {
  realtimeRefs++;
  if (!realtimeChannel) {
    realtimeChannel = supabase
      .channel("library_items_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "library_items" },
        () => {
          void syncLibraryFromDb();
        },
      )
      .subscribe();
  }
  return () => {
    realtimeRefs--;
    if (realtimeRefs <= 0 && realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
      realtimeRefs = 0;
    }
  };
}

// ==========================================
// 5. BUNDLE EXPORT, IMPORT & RESET WORKFLOWS
// ==========================================

export interface LibraryBundle {
  version: number;
  exported_at: string;
  skills: LibrarySkill[];
  inspo: DashboardInspo[];
  prompts: LibraryTextPrompt[];
}

export function exportLibraryBundle(): void {
  const bundle: LibraryBundle = {
    version: 1,
    exported_at: new Date().toISOString(),
    skills: getLocalSkills(),
    inspo: getLocalInspo(),
    prompts: getLocalPrompts(),
  };

  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agency-library-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importLibraryBundle(jsonStr: string): {
  success: boolean;
  skillsCount: number;
  inspoCount: number;
  promptsCount: number;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonStr) as Partial<LibraryBundle>;
    if (!data || typeof data !== "object") {
      throw new Error("Invalid library bundle format");
    }

    let skillsCount = 0;
    let inspoCount = 0;
    let promptsCount = 0;

    if (Array.isArray(data.skills) && data.skills.length > 0) {
      const current = getLocalSkills();
      const idMap = new Map(current.map((s, idx) => [s.id, idx]));
      const merged = [...current];
      for (const item of data.skills) {
        if (!item || !item.id || !item.title) continue;
        if (idMap.has(item.id)) {
          const idx = idMap.get(item.id)!;
          merged[idx] = { ...merged[idx], ...item };
        } else {
          merged.push(item);
          idMap.set(item.id, merged.length - 1);
        }
        skillsCount++;
      }
      saveLocalSkills(merged);
    }

    if (Array.isArray(data.inspo) && data.inspo.length > 0) {
      const current = getLocalInspo();
      const idMap = new Map(current.map((i, idx) => [i.id, idx]));
      const merged = [...current];
      for (const item of data.inspo) {
        if (!item || !item.id || !item.title) continue;
        if (idMap.has(item.id)) {
          const idx = idMap.get(item.id)!;
          merged[idx] = { ...merged[idx], ...item };
        } else {
          merged.push(item);
          idMap.set(item.id, merged.length - 1);
        }
        inspoCount++;
      }
      saveLocalInspo(merged);
    }

    if (Array.isArray(data.prompts) && data.prompts.length > 0) {
      const current = getLocalPrompts();
      const idMap = new Map(current.map((p, idx) => [p.id, idx]));
      const merged = [...current];
      for (const item of data.prompts) {
        if (!item || !item.id || !item.title) continue;
        if (idMap.has(item.id)) {
          const idx = idMap.get(item.id)!;
          merged[idx] = { ...merged[idx], ...item };
        } else {
          merged.push(item);
          idMap.set(item.id, merged.length - 1);
        }
        promptsCount++;
      }
      saveLocalPrompts(merged);
    }

    // Persist the merged library to the cloud database
    for (const s of getLocalSkills()) void persistLibraryItem("skill", s);
    for (const i of getLocalInspo()) void persistLibraryItem("inspo", i);
    for (const p of getLocalPrompts()) void persistLibraryItem("prompt", p);

    broadcastDbSync({
      type: "library_synced",
      payload: { skillsCount, inspoCount, promptsCount },
    });

    recordLibraryAuditEvent({
      entity_table: "library_bundle",
      entity_id: "bundle-import",
      action: "create",
      change_reason: `Imported library bundle: processed ${skillsCount} skills, ${inspoCount} inspo, ${promptsCount} prompts`,
    });

    try {
      supabase
        .from("entity_events")
        .insert({
          entity_table: "library_skills",
          entity_id: "bundle-import",
          action: "create",
          change_reason: `Imported library bundle: +${skillsCount} skills, +${inspoCount} inspo, +${promptsCount} prompts`,
        })
        .then(() => {});
    } catch {
      // ignore
    }

    return { success: true, skillsCount, inspoCount, promptsCount };
  } catch (err) {
    return {
      success: false,
      skillsCount: 0,
      inspoCount: 0,
      promptsCount: 0,
      error: (err as Error).message,
    };
  }
}

export function resetLibraryToDefaults(): void {
  saveLocalSkills(DEFAULT_LIBRARY_SKILLS);
  saveLocalInspo(DEFAULT_DASHBOARD_INSPO);
  saveLocalPrompts(DEFAULT_LIBRARY_PROMPTS);

  // Reset the cloud copy too so every device gets the defaults
  void (async () => {
    try {
      await supabase.from("library_items").delete().neq("item_id", "");
      syncInFlight = null;
      await syncLibraryFromDb();
    } catch (err) {
      console.warn("Could not reset cloud library:", err);
    }
  })();

  broadcastDbSync({
    type: "library_synced",
    payload: { reset: true },
  });

  recordLibraryAuditEvent({
    entity_table: "library_bundle",
    entity_id: "reset-defaults",
    action: "update",
    change_reason:
      "Reset all library skills, dashboard inspo, and text prompts to standard agency presets",
  });

  try {
    supabase
      .from("entity_events")
      .insert({
        entity_table: "library_skills",
        entity_id: "reset-defaults",
        action: "update",
        change_reason:
          "Reset all library skills, dashboard inspo, and text prompts to standard agency presets",
      })
      .then(() => {});
  } catch {
    // ignore
  }
}

export function getLibraryCounts(): { skills: number; inspo: number; prompts: number } {
  return {
    skills: getLocalSkills().length,
    inspo: getLocalInspo().length,
    prompts: getLocalPrompts().length,
  };
}
