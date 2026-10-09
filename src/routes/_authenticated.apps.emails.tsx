import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Github,
  Globe,
  KeyRound,
  Layers,
  Mail,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { APP_TABS } from "@/routes/_authenticated.apps";
import { Empty, Panel, Pill, Stat } from "@/components/dash";
import { SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, todayISO } from "@/lib/agency";
import { revealAccountPassword, saveAccountPassword } from "@/lib/emails.functions";
import { fetchMergedAccounts, upsertLocalAccount } from "@/lib/lovable-accounts-store";
import {
  PLATFORMS,
  Platform,
  transferProjectProductAccount,
  unpackAccountNotes,
} from "@/lib/project-accounts.functions";
import { broadcastDbSync } from "@/lib/database-interconnect";

export const Route = createFileRoute("/_authenticated/apps/emails")({
  head: () => ({
    meta: [
      { title: "Builder & Google accounts — Agency OS" },
      {
        name: "description",
        content:
          "Track builder emails, Google login accounts, credit balances, and the exact project tools (Lovable, Google AI Studio, Manus) connected to each email.",
      },
      { property: "og:title", content: "Builder & Google accounts — Agency OS" },
      {
        property: "og:description",
        content:
          "Manage credits across Google accounts and seamlessly move projects or individual platforms when credits run out.",
      },
    ],
  }),
  component: Emails,
});

const field =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

type Draft = {
  id?: string;
  email: string;
  label: string;
  plan: string;
  recovery_email: string;
  credits_remaining: string;
  notes: string;
  password: string;
};

const empty: Draft = {
  email: "",
  label: "",
  plan: "",
  recovery_email: "",
  credits_remaining: "0",
  notes: "",
  password: "",
};

type QuickMoveState = {
  open: boolean;
  projectId: string;
  projectName: string;
  fromAccountId: string | null;
  fromAccountEmail: string;
  platform: string; // "all" or specific
  availablePlatforms: string[];
  toAccountId: string;
  reason: string;
};

const PLATFORM_BADGE_STYLES: Record<
  string,
  { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Lovable: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/20",
    icon: Sparkles,
  },
  "Google AI Studio": {
    bg: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/20",
    icon: Cpu,
  },
  Manus: {
    bg: "bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/20",
    icon: Bot,
  },
  GitHub: {
    bg: "bg-slate-500/10",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/20",
    icon: Github,
  },
  Supabase: {
    bg: "bg-teal-500/10",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-500/20",
    icon: Database,
  },
  Vercel: {
    bg: "bg-neutral-500/10",
    text: "text-neutral-700 dark:text-neutral-300",
    border: "border-neutral-500/20",
    icon: Globe,
  },
  Hosting: {
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/20",
    icon: Sparkles,
  },
};

function Emails() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"accounts" | "tracker" | "transfers">("accounts");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showDraftPassword, setShowDraftPassword] = useState(false);

  // Dedicated Edit Password modal state
  type EditPasswordState = {
    open: boolean;
    accountId: string;
    email: string;
    label: string;
    password: string;
    isSaving: boolean;
  };
  const [pwdModal, setPwdModal] = useState<EditPasswordState>({
    open: false,
    accountId: "",
    email: "",
    label: "",
    password: "",
    isSaving: false,
  });
  const [showPwdEye, setShowPwdEye] = useState(false);

  const openPasswordModal = (params: {
    accountId: string;
    email: string;
    label: string;
    currentPassword?: string;
  }) => {
    const existing = params.currentPassword || shown[params.accountId] || "";
    setPwdModal({
      open: true,
      accountId: params.accountId,
      email: params.email,
      label: params.label,
      password: existing,
      isSaving: false,
    });
    setShowPwdEye(false);

    if (!existing) {
      reveal({ data: { id: params.accountId, email: params.email } })
        .then((res) => {
          if (res?.password) {
            setPwdModal((prev) => (prev.open ? { ...prev, password: res.password } : prev));
            setShown((s) => ({ ...s, [params.accountId]: res.password }));
          }
        })
        .catch(() => {});
    }
  };

  const generateSecurePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%^&*";
    let result = "";
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPwdModal((prev) => ({ ...prev, password: result }));
    setShowPwdEye(true);
    toast.success("Generated strong password");
  };

  // Quick Move modal state
  const [moveModal, setMoveModal] = useState<QuickMoveState>({
    open: false,
    projectId: "",
    projectName: "",
    fromAccountId: null,
    fromAccountEmail: "",
    platform: "all",
    availablePlatforms: [],
    toAccountId: "",
    reason: "",
  });

  // Credit Attention Required dismissal and collapse states
  const [creditAlertDismissed, setCreditAlertDismissed] = useState<boolean>(() => {
    try {
      return (
        typeof window !== "undefined" &&
        window.sessionStorage?.getItem("dismissed_credit_alert_session") === "true"
      );
    } catch {
      return false;
    }
  });
  const [creditAlertCollapsed, setCreditAlertCollapsed] = useState<boolean>(false);

  const handleDismissCreditAlert = () => {
    setCreditAlertDismissed(true);
    try {
      window.sessionStorage?.setItem("dismissed_credit_alert_session", "true");
    } catch {
      /* ignore storage errors */
    }
    toast.info("Credit alert banner dismissed for this session", {
      action: {
        label: "Undo",
        onClick: () => {
          setCreditAlertDismissed(false);
          try {
            window.sessionStorage?.removeItem("dismissed_credit_alert_session");
          } catch {
            /* ignore storage errors */
          }
        },
      },
    });
  };

  const handleRestoreCreditAlert = () => {
    setCreditAlertDismissed(false);
    try {
      window.sessionStorage?.removeItem("dismissed_credit_alert_session");
    } catch {
      /* ignore storage errors */
    }
  };

  const reveal = useServerFn(revealAccountPassword);
  const savePw = useServerFn(saveAccountPassword);
  const transferFn = useServerFn(transferProjectProductAccount);

  // Queries
  const { data: accounts = [] } = useQuery({
    queryKey: ["lovable-accounts"],
    queryFn: fetchMergedAccounts,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () =>
      (
        await supabase
          .from("projects")
          .select(
            "id, project_name, client_id, hosting_account_id, build_stage, payment_state, app_url",
          )
          .order("project_name")
      ).data ?? [],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () =>
      (await supabase.from("clients").select("*").order("business_name")).data ?? [],
  });

  const { data: projectAccounts = [] } = useQuery({
    queryKey: ["all-project-accounts"],
    queryFn: async () =>
      (
        await supabase
          .from("project_accounts")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["project-transfers"],
    queryFn: async () =>
      (await supabase.from("project_transfers").select("*").order("moved_at", { ascending: false }))
        .data ?? [],
  });

  const totalCredits = accounts.reduce((s, a) => s + Number(a.credits_remaining ?? 0), 0);
  const lowCreditAccounts = accounts.filter((a) => Number(a.credits_remaining ?? 0) < 500);

  // Helper lookups
  const clientOf = (id: string | null) => clients.find((c) => c.id === id);
  const accountOf = (id: string | null) => accounts.find((a) => a.id === id);

  // Compute connected projects per email account
  type ConnectedProjectItem = {
    projectId: string;
    projectName: string;
    clientName: string;
    clientId: string;
    platforms: string[];
    isHosting: boolean;
  };

  const accountProjectMap = useMemo(() => {
    const map = new Map<string, ConnectedProjectItem[]>();

    for (const acc of accounts) {
      const projMap = new Map<string, ConnectedProjectItem>();

      // 1. Projects where hosting_account_id === acc.id
      for (const p of projects) {
        if (p.hosting_account_id === acc.id) {
          const client = clientOf(p.client_id);
          projMap.set(p.id, {
            projectId: p.id,
            projectName: p.project_name,
            clientId: p.client_id,
            clientName: client?.business_name ?? "Internal Client",
            platforms: ["Lovable"],
            isHosting: true,
          });
        }
      }

      // 2. Project accounts where lovable_account_id === acc.id OR email matches
      for (const pa of projectAccounts) {
        const isMatch =
          pa.lovable_account_id === acc.id ||
          (pa.email && pa.email.toLowerCase() === acc.email.toLowerCase());

        if (isMatch) {
          const meta = unpackAccountNotes(pa.notes);
          const allTargetProjectIds = Array.from(
            new Set([pa.project_id, ...(meta.linked_project_ids ?? [])]),
          );

          for (const pId of allTargetProjectIds) {
            const p = projects.find((x) => x.id === pId);
            if (!p) continue;
            const client = clientOf(p.client_id);
            const existing = projMap.get(p.id);
            const plat = pa.platform;

            if (existing) {
              if (!existing.platforms.includes(plat)) {
                existing.platforms.push(plat);
              }
            } else {
              projMap.set(p.id, {
                projectId: p.id,
                projectName: p.project_name,
                clientId: p.client_id,
                clientName: client?.business_name ?? "Internal Client",
                platforms: [plat],
                isHosting: p.hosting_account_id === acc.id,
              });
            }
          }
        }
      }

      // Sort connected projects by project_name
      const list = Array.from(projMap.values()).sort((a, b) =>
        a.projectName.localeCompare(b.projectName),
      );
      map.set(acc.id, list);
    }

    return map;
  }, [accounts, projects, clients, projectAccounts]);

  // Compute Project ↔ Tools matrix tracker
  type ProjectTrackerRow = {
    project: (typeof projects)[number];
    client?: (typeof clients)[number];
    lovableAccount?: (typeof accounts)[number];
    googleAiAccount?: (typeof accounts)[number];
    manusAccount?: (typeof accounts)[number];
    otherPlatforms: Array<{ platform: string; email: string; account?: (typeof accounts)[number] }>;
    allAccounts: Array<(typeof accounts)[number]>;
  };

  const projectTrackerRows: ProjectTrackerRow[] = useMemo(() => {
    return projects.map((p) => {
      const client = clientOf(p.client_id);

      // Find platform accounts for this project
      const pAccounts = projectAccounts.filter((pa) => {
        if (pa.project_id === p.id) return true;
        const meta = unpackAccountNotes(pa.notes);
        return meta.linked_project_ids?.includes(p.id);
      });

      // Lovable account: check project_accounts first, fallback to hosting_account_id
      const lovablePa = pAccounts.find((pa) => pa.platform === "Lovable");
      let lovableAcc = lovablePa?.lovable_account_id
        ? accounts.find((a) => a.id === lovablePa.lovable_account_id)
        : lovablePa?.email
          ? accounts.find((a) => a.email.toLowerCase() === lovablePa.email?.toLowerCase())
          : undefined;

      if (!lovableAcc && p.hosting_account_id) {
        lovableAcc = accounts.find((a) => a.id === p.hosting_account_id);
      }

      // Google AI Studio account
      const googlePa = pAccounts.find((pa) => pa.platform === "Google AI Studio");
      const googleAcc = googlePa?.lovable_account_id
        ? accounts.find((a) => a.id === googlePa.lovable_account_id)
        : googlePa?.email
          ? accounts.find((a) => a.email.toLowerCase() === googlePa.email?.toLowerCase())
          : undefined;

      // Manus account
      const manusPa = pAccounts.find((pa) => pa.platform === "Manus");
      const manusAcc = manusPa?.lovable_account_id
        ? accounts.find((a) => a.id === manusPa.lovable_account_id)
        : manusPa?.email
          ? accounts.find((a) => a.email.toLowerCase() === manusPa.email?.toLowerCase())
          : undefined;

      // Other platforms
      const others = pAccounts
        .filter((pa) => !["Lovable", "Google AI Studio", "Manus"].includes(pa.platform))
        .map((pa) => {
          const acc = pa.lovable_account_id
            ? accounts.find((a) => a.id === pa.lovable_account_id)
            : accounts.find((a) => a.email.toLowerCase() === pa.email?.toLowerCase());
          return {
            platform: pa.platform,
            email: pa.email || acc?.email || "Unknown",
            account: acc,
          };
        });

      const uniqueAccs = Array.from(
        new Set(
          [lovableAcc, googleAcc, manusAcc, ...others.map((o) => o.account)].filter(
            Boolean,
          ) as (typeof accounts)[number][],
        ),
      );

      return {
        project: p,
        client,
        lovableAccount: lovableAcc,
        googleAiAccount: googleAcc,
        manusAccount: manusAcc,
        otherPlatforms: others,
        allAccounts: uniqueAccs,
      };
    });
  }, [projects, projectAccounts, accounts, clients]);

  // Filtered accounts for Cards tab
  const visibleAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const connected = accountProjectMap.get(a.id) ?? [];
      const matchProjects = connected.some(
        (p) =>
          p.projectName.toLowerCase().includes(q.toLowerCase()) ||
          p.platforms.some((pl) => pl.toLowerCase().includes(q.toLowerCase())),
      );
      return matches(q, a.email, a.label, a.plan, a.notes) || matchProjects;
    });
  }, [accounts, q, accountProjectMap]);

  // Filtered tracker rows
  const visibleTrackerRows = useMemo(() => {
    if (!q.trim()) return projectTrackerRows;
    const query = q.toLowerCase();
    return projectTrackerRows.filter((r) => {
      const matchProj = r.project.project_name.toLowerCase().includes(query);
      const matchClient = r.client?.business_name.toLowerCase().includes(query);
      const matchLovable = r.lovableAccount?.email.toLowerCase().includes(query);
      const matchGoogle = r.googleAiAccount?.email.toLowerCase().includes(query);
      const matchManus = r.manusAccount?.email.toLowerCase().includes(query);
      return matchProj || matchClient || matchLovable || matchGoogle || matchManus;
    });
  }, [projectTrackerRows, q]);

  // Save Account Mutation
  const saveAccount = useMutation({
    mutationFn: async (d: Draft) => {
      const accountId = d.id || `la-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const row = {
        id: accountId,
        email: d.email.trim().toLowerCase(),
        label: d.label || null,
        plan: d.plan || null,
        recovery_email: d.recovery_email || null,
        credits_remaining: Number(d.credits_remaining || 0),
        credits_checked_at: todayISO(),
        notes: d.notes || null,
      };

      // 1. Immediately persist locally so the account is NEVER missing
      upsertLocalAccount(row);

      // 2. Attempt Supabase save without failing on RLS
      try {
        if (d.id) {
          await supabase.from("lovable_accounts").update(row).eq("id", d.id);
        } else {
          await supabase.from("lovable_accounts").insert(row);
        }
      } catch (err) {
        console.warn("Supabase account save non-fatal/saved locally:", err);
      }

      // 3. Save password if provided
      if (d.password) {
        await savePw({ data: { id: accountId, password: d.password, email: d.email } });
      }
    },
    onSuccess: () => {
      setDraft(null);
      toast.success("Google / Builder account saved");
      qc.invalidateQueries({ queryKey: ["lovable-accounts"] });
      qc.invalidateQueries({ queryKey: ["lovable-accounts-mini"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Transfer Mutation
  const executeTransfer = useMutation({
    mutationFn: async () => {
      if (!moveModal.projectId || !moveModal.toAccountId) {
        throw new Error("Please select a target project and destination email account.");
      }
      return await transferFn({
        data: {
          projectId: moveModal.projectId,
          platform: moveModal.platform,
          fromAccountId: moveModal.fromAccountId,
          toAccountId: moveModal.toAccountId,
          reason: moveModal.reason,
        },
      });
    },
    onSuccess: (res) => {
      setMoveModal((prev) => ({ ...prev, open: false }));
      toast.success(
        `Successfully moved ${res.platform === "all" ? "all tools" : res.platform} for "${res.projectName}" to ${res.toEmail}`,
      );
      qc.invalidateQueries({ queryKey: ["lovable-accounts"] });
      qc.invalidateQueries({ queryKey: ["lovable-accounts-mini"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-lookup"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
      qc.invalidateQueries({ queryKey: ["project-transfers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const showPassword = async (id: string, email?: string) => {
    try {
      const res = await reveal({ data: { id, email } });
      if (!res.password) {
        toast.info("No password saved for this Google account");
        return;
      }
      setShown((s) => ({ ...s, [id]: res.password }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSavePasswordModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdModal.password.trim()) {
      toast.error("Please enter a new password");
      return;
    }
    setPwdModal((prev) => ({ ...prev, isSaving: true }));
    try {
      await savePw({
        data: {
          id: pwdModal.accountId,
          email: pwdModal.email,
          password: pwdModal.password.trim(),
        },
      });
      // Immediately update local revealed state so user sees the new password
      setShown((prev) => ({ ...prev, [pwdModal.accountId]: pwdModal.password.trim() }));
      toast.success(`Password saved for ${pwdModal.email}`);
      broadcastDbSync({
        type: "account_password_updated",
        id: pwdModal.accountId,
        payload: { email: pwdModal.email },
      });
      setPwdModal({
        open: false,
        accountId: "",
        email: "",
        label: "",
        password: "",
        isSaving: false,
      });
      qc.invalidateQueries({ queryKey: ["lovable-accounts"] });
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to save password");
      setPwdModal((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const openQuickMove = (
    projectId: string,
    projectName: string,
    fromAccountId: string | null,
    fromAccountEmail: string,
    defaultPlatform: string = "all",
    availablePlatforms: string[] = ["Lovable", "Google AI Studio", "Manus"],
  ) => {
    // Pick another account with credits if possible
    const otherAccount = accounts.find(
      (a) => a.id !== fromAccountId && Number(a.credits_remaining ?? 0) > 0,
    );
    setMoveModal({
      open: true,
      projectId,
      projectName,
      fromAccountId,
      fromAccountEmail,
      platform: defaultPlatform,
      availablePlatforms,
      toAccountId: otherAccount ? otherAccount.id : "",
      reason: "",
    });
  };

  return (
    <AppShell
      title="Builder Accounts & Credit Tracker"
      subtitle="Track Google login emails, available credits, and the exact project tools (Lovable, Google AI Studio, Manus) connected to each email."
      actions={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search emails, projects, tools…" />
          <button
            onClick={() => {
              if (projects.length > 0) {
                const firstProj = projects[0];
                const destAcc = accounts.find((a) => a.id !== firstProj.hosting_account_id);
                setMoveModal({
                  open: true,
                  projectId: firstProj.id,
                  projectName: firstProj.project_name,
                  fromAccountId: firstProj.hosting_account_id,
                  fromAccountEmail: accountOf(firstProj.hosting_account_id)?.email ?? "Unassigned",
                  platform: "all",
                  availablePlatforms: ["Lovable", "Google AI Studio", "Manus"],
                  toAccountId: destAcc ? destAcc.id : "",
                  reason: "",
                });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            <ArrowRightLeft className="size-4" /> Move Project / Tool
          </button>
          {isAdmin ? (
            <button
              onClick={() => setDraft(empty)}
              className="gradient-leaf inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-xs"
            >
              <Plus className="size-4" /> Add Google Account
            </button>
          ) : null}
        </div>
      }
    >
      <SubTabs tabs={APP_TABS} />

      {/* Top Stat Row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Builder Accounts"
          value={String(accounts.length)}
          hint="Google login emails"
          tone="leaf"
        />
        <Stat
          label="Total Credits Left"
          value={totalCredits.toLocaleString("en-US")}
          hint={
            lowCreditAccounts.length > 0
              ? `${lowCreditAccounts.length} account(s) low on credits`
              : "Across all accounts"
          }
          tone={lowCreditAccounts.length > 0 ? "warn" : "mist"}
        />
        <Stat
          label="Active Projects"
          value={String(projects.length)}
          hint="Tracked in Agency OS"
          tone="deep"
        />
        <Stat
          label="Platform Footprint"
          value={String(projectAccounts.length)}
          hint="Lovable · AI Studio · Manus links"
          tone="mist"
        />
      </div>

      {/* Low credit banner / section */}
      {lowCreditAccounts.length > 0 &&
        (creditAlertDismissed ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong className="font-semibold text-foreground">
                  {lowCreditAccounts.length} builder{" "}
                  {lowCreditAccounts.length === 1 ? "account requires" : "accounts require"}{" "}
                  attention
                </strong>{" "}
                (&lt; 500 credits remaining). Alert notice is currently dismissed.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreCreditAlert}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 transition"
              >
                Review Accounts
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 shadow-xs">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      Credit Attention Required
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {lowCreditAccounts.length}{" "}
                      {lowCreditAccounts.length === 1
                        ? "Account Low / Depleted"
                        : "Accounts Low / Depleted"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Builder accounts below 500 credits can cause AI generations in Lovable, Google
                    AI Studio, or Manus to halt.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreditAlertCollapsed((c) => !c)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                >
                  {creditAlertCollapsed ? (
                    <>
                      <ChevronDown className="size-3.5" /> Show {lowCreditAccounts.length}{" "}
                      {lowCreditAccounts.length === 1 ? "Account" : "Accounts"}
                    </>
                  ) : (
                    <>
                      <ChevronUp className="size-3.5" /> Collapse
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDismissCreditAlert}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition"
                  title="Dismiss credit alert"
                >
                  <X className="size-3.5" /> Dismiss
                </button>
              </div>
            </div>

            {/* Organized accounts list */}
            {!creditAlertCollapsed && (
              <div className="mt-4 space-y-3 border-t border-amber-500/20 pt-4">
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {lowCreditAccounts.map((acc) => {
                    const connectedProjects = accountProjectMap.get(acc.id) ?? [];
                    const credits = Number(acc.credits_remaining ?? 0);
                    const isZero = credits === 0;

                    return (
                      <div
                        key={acc.id}
                        className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs hover:border-amber-500/40 transition"
                      >
                        <div>
                          {/* Account Email & Credits Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Mail className="size-3.5 text-muted-foreground shrink-0" />
                                <span
                                  className="font-mono text-xs font-semibold text-foreground truncate"
                                  title={acc.email}
                                >
                                  {acc.email}
                                </span>
                              </div>
                              {acc.label && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                                  {acc.label}
                                </p>
                              )}
                            </div>
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                isZero
                                  ? "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/25"
                                  : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25"
                              }`}
                            >
                              {credits.toLocaleString()} credits
                            </span>
                          </div>

                          {/* Impacted Projects */}
                          <div className="mt-3 text-xs">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                              <span>Impacted Projects ({connectedProjects.length}):</span>
                            </div>
                            {connectedProjects.length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                {connectedProjects.map((p) => (
                                  <span
                                    key={p.projectId}
                                    className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground"
                                  >
                                    <Building2 className="size-3 text-muted-foreground" />
                                    <span className="truncate max-w-[130px]">{p.projectName}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                      ({p.platforms.join(", ")})
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1.5 text-[11px] text-muted-foreground italic">
                                No active projects linked to this account
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Inline Actions */}
                        <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-border/60 pt-2.5">
                          {connectedProjects.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const firstProj = connectedProjects[0];
                                openQuickMove(
                                  firstProj.projectId,
                                  firstProj.projectName,
                                  acc.id,
                                  acc.email,
                                  "all",
                                  firstProj.platforms,
                                );
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary/80 transition"
                            >
                              <ArrowRightLeft className="size-3 text-primary" /> Move Projects
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDraft({
                                id: acc.id,
                                email: acc.email,
                                label: acc.label || "",
                                plan: acc.plan || "",
                                recovery_email: acc.recovery_email || "",
                                credits_remaining: String(acc.credits_remaining ?? 0),
                                notes: acc.notes || "",
                                password: "",
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                          >
                            <Pencil className="size-3" /> Update Credits
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openPasswordModal({
                                accountId: acc.id,
                                email: acc.email,
                                label: acc.label || "Builder Account",
                                currentPassword: shown[acc.id] || "",
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-primary hover:bg-secondary transition"
                          >
                            <KeyRound className="size-3" /> Edit Password
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    <span>
                      Use <strong>Move Projects</strong> to switch all tools for an affected project
                      to another Google email with positive credits.
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleDismissCreditAlert}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition"
                  >
                    Dismiss this section
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

      {/* View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("accounts")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition ${
              activeTab === "accounts"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Mail className="size-4" /> Email Accounts ({accounts.length})
          </button>
          <button
            onClick={() => setActiveTab("tracker")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition ${
              activeTab === "tracker"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Layers className="size-4" /> Project ↔ Tool Tracker Matrix ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab("transfers")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition ${
              activeTab === "transfers"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <ArrowRightLeft className="size-4" /> Transfer Log ({transfers.length})
          </button>
        </div>
      </div>

      {/* Draft Form Modal / Panel */}
      {draft ? (
        <Panel title={draft.id ? "Edit Google Account & Credits" : "Add Google / Builder Account"}>
          <p className="text-xs text-muted-foreground mb-4">
            Agency builders use Google sign-in to access Lovable, Google AI Studio, and Manus.
            Storing this email and password allows seamless credential access and credit tracking
            across projects.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              Google Email Address *
              <input
                className={field + " mt-1"}
                placeholder="developer@agency.com or @gmail.com"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Account Label
              <input
                className={field + " mt-1"}
                placeholder="e.g. Primary Vibe Coding / AI Studio Pro"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Google Account Password {draft.id ? "(Leave blank to keep current)" : "*"}
              <div className="relative mt-1">
                <input
                  className={field + " pr-10"}
                  type={showDraftPassword ? "text" : "password"}
                  placeholder={draft.id ? "••••••••••••" : "Shared Google login password"}
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowDraftPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={showDraftPassword ? "Hide password" : "Show password"}
                >
                  {showDraftPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Recovery Email
              <input
                className={field + " mt-1"}
                placeholder="backup@agency.com"
                value={draft.recovery_email}
                onChange={(e) => setDraft({ ...draft, recovery_email: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Plan / Tier
              <input
                className={field + " mt-1"}
                placeholder="Free / Pro / Scale"
                value={draft.plan}
                onChange={(e) => setDraft({ ...draft, plan: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Credits Remaining
              <input
                className={field + " mt-1"}
                inputMode="numeric"
                value={draft.credits_remaining}
                onChange={(e) => setDraft({ ...draft, credits_remaining: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground md:col-span-2">
              Notes & API Keys Info
              <textarea
                className={field + " mt-1"}
                rows={2}
                placeholder="Internal notes, shared limits, renewal dates..."
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => saveAccount.mutate(draft)}
              disabled={!draft.email}
              className="gradient-leaf rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save Google Account
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </Panel>
      ) : null}

      {/* TAB 1: ACCOUNTS CARDS VIEW */}
      {activeTab === "accounts" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleAccounts.length === 0 ? (
            <div className="lg:col-span-2">
              <Panel title="Email Accounts">
                <Empty>No builder accounts match your query.</Empty>
              </Panel>
            </div>
          ) : null}

          {visibleAccounts.map((a) => {
            const connectedProjects = accountProjectMap.get(a.id) ?? [];
            const creditsNum = Number(a.credits_remaining ?? 0);
            const isLowCredits = creditsNum < 500;

            return (
              <section
                key={a.id}
                className="surface-card flex flex-col justify-between p-5 space-y-4"
              >
                <div>
                  {/* Account Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-display text-base font-semibold">
                        <Mail className="size-4 text-primary" />
                        <span className="truncate">{a.email}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.label || "General Builder Account"}
                        {a.plan ? ` · ${a.plan}` : ""}
                        {a.recovery_email ? ` · Recovery: ${a.recovery_email}` : ""}
                        {a.credits_checked_at ? ` · Updated ${fmtDate(a.credits_checked_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Pill tone={isLowCredits ? "warn" : "leaf"}>
                        {creditsNum.toLocaleString("en-US")} credits
                      </Pill>
                      {isAdmin ? (
                        <button
                          aria-label="Edit account"
                          onClick={() =>
                            setDraft({
                              id: a.id,
                              email: a.email,
                              label: a.label ?? "",
                              plan: a.plan ?? "",
                              recovery_email: a.recovery_email ?? "",
                              credits_remaining: String(a.credits_remaining ?? 0),
                              notes: a.notes ?? "",
                              password: "",
                            })
                          }
                          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Password & Reveal Box */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <KeyRound className="size-4 text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground font-medium shrink-0">
                        Google Password:
                      </span>
                      <span className="numeric min-w-0 truncate font-mono text-xs font-semibold text-foreground">
                        {shown[a.id] ?? "••••••••••••"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {shown[a.id] ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(shown[a.id]!);
                              setCopiedId(a.id);
                              toast.success("Password copied");
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            title="Copy password"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-secondary transition"
                          >
                            {copiedId === a.id ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                            <span>{copiedId === a.id ? "Copied" : "Copy"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openPasswordModal({
                                accountId: a.id,
                                email: a.email,
                                label: a.label || "Google / Builder Account",
                                currentPassword: shown[a.id] || "",
                              })
                            }
                            title="Edit password"
                            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary font-semibold hover:bg-primary/20 transition"
                          >
                            <Pencil className="size-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShown((prev) => {
                                const next = { ...prev };
                                delete next[a.id];
                                return next;
                              });
                            }}
                            title="Hide password"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-secondary text-muted-foreground transition"
                          >
                            <EyeOff className="size-3.5" />
                            <span>Hide</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void showPassword(a.id, a.email)}
                            title="Show password"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-secondary transition text-foreground"
                          >
                            <Eye className="size-3.5 text-muted-foreground" />
                            <span>Show password</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openPasswordModal({
                                accountId: a.id,
                                email: a.email,
                                label: a.label || "Google / Builder Account",
                              })
                            }
                            title="Edit password"
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                          >
                            <Pencil className="size-3" />
                            <span>Edit</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {a.notes ? (
                    <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                      {a.notes}
                    </p>
                  ) : null}

                  {/* Connected Projects & Platform Matrix */}
                  <div className="mt-4 border-t border-border/70 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Connected Projects & Platforms ({connectedProjects.length})
                      </p>
                      {connectedProjects.length > 0 && (
                        <button
                          onClick={() => {
                            const first = connectedProjects[0];
                            openQuickMove(
                              first.projectId,
                              first.projectName,
                              a.id,
                              a.email,
                              "all",
                              first.platforms,
                            );
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <ArrowRightLeft className="size-3" /> Move Projects…
                        </button>
                      )}
                    </div>

                    {connectedProjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-1">
                        No projects currently linked to this Google account. Ready for fresh builds!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {connectedProjects.map((cp) => (
                          <div
                            key={cp.projectId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-2.5 transition hover:border-primary/40"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  to="/apps/projects"
                                  search={{ projectId: cp.projectId, tab: "Credentials" }}
                                  className="font-medium text-sm text-foreground hover:text-primary truncate"
                                >
                                  {cp.projectName}
                                </Link>
                                <span className="text-[11px] text-muted-foreground">
                                  · {cp.clientName}
                                </span>
                              </div>

                              {/* Platform badges */}
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {cp.platforms.map((plat) => {
                                  const style =
                                    PLATFORM_BADGE_STYLES[plat] || PLATFORM_BADGE_STYLES.Hosting;
                                  const Icon = style.icon;
                                  return (
                                    <span
                                      key={plat}
                                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text} ${style.border}`}
                                    >
                                      <Icon className="size-2.5" />
                                      {plat}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Move Button for this specific project */}
                            <button
                              onClick={() =>
                                openQuickMove(
                                  cp.projectId,
                                  cp.projectName,
                                  a.id,
                                  a.email,
                                  cp.platforms.length === 1 ? cp.platforms[0] : "all",
                                  cp.platforms,
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                              title="Move this project or tool to another email"
                            >
                              <ArrowRightLeft className="size-3" /> Move
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Card Summary */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                  <span>
                    {connectedProjects.length} project(s) ·{" "}
                    {connectedProjects.reduce((s, p) => s + p.platforms.length, 0)} tool links
                  </span>
                  <Link
                    to="/apps/projects"
                    className="hover:text-foreground inline-flex items-center gap-1"
                  >
                    View in Projects <ExternalLink className="size-3" />
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* TAB 2: PROJECT ↔ TOOL TRACKER MATRIX VIEW */}
      {activeTab === "tracker" && (
        <Panel
          title="Project ↔ Tool Matrix Tracker"
          right={<Pill tone="mist">{visibleTrackerRows.length} projects</Pill>}
        >
          <p className="text-xs text-muted-foreground mb-4">
            Track which Google account powers each product (Lovable, Google AI Studio, Manus) for
            every client project. When credits run out on one tool, click <strong>Move</strong> to
            reassign it instantly.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 pr-4">Project & Client</th>
                  <th className="py-2.5 px-3">Lovable</th>
                  <th className="py-2.5 px-3">Google AI Studio</th>
                  <th className="py-2.5 px-3">Manus</th>
                  <th className="py-2.5 px-3">Other Tools</th>
                  <th className="py-2.5 pl-3 text-right">Quick Transfer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visibleTrackerRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No projects match the search filter.
                    </td>
                  </tr>
                ) : (
                  visibleTrackerRows.map((r) => {
                    const lovableCredits = Number(r.lovableAccount?.credits_remaining ?? 0);
                    const googleCredits = Number(r.googleAiAccount?.credits_remaining ?? 0);
                    const manusCredits = Number(r.manusAccount?.credits_remaining ?? 0);

                    return (
                      <tr key={r.project.id} className="hover:bg-card/50 transition">
                        {/* Project & Client */}
                        <td className="py-3 pr-4">
                          <Link
                            to="/apps/projects"
                            search={{ projectId: r.project.id, tab: "Credentials" }}
                            className="font-semibold text-sm text-foreground hover:text-primary"
                          >
                            {r.project.project_name}
                          </Link>
                          <div className="text-[11px] text-muted-foreground">
                            {r.client ? r.client.business_name : "Internal"} ·{" "}
                            {r.project.build_stage}
                          </div>
                        </td>

                        {/* Lovable Platform */}
                        <td className="py-3 px-3">
                          {r.lovableAccount ? (
                            <div>
                              <div className="flex items-center gap-1 font-medium text-foreground">
                                <Sparkles className="size-3 text-emerald-500" />
                                <span className="truncate max-w-[150px]">
                                  {r.lovableAccount.email}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] ${lovableCredits < 500 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"}`}
                              >
                                {lovableCredits.toLocaleString()} credits left
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60 italic">Not set</span>
                          )}
                        </td>

                        {/* Google AI Studio */}
                        <td className="py-3 px-3">
                          {r.googleAiAccount ? (
                            <div>
                              <div className="flex items-center gap-1 font-medium text-foreground">
                                <Cpu className="size-3 text-sky-500" />
                                <span className="truncate max-w-[150px]">
                                  {r.googleAiAccount.email}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] ${googleCredits < 500 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"}`}
                              >
                                {googleCredits.toLocaleString()} credits left
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60 italic">Not set</span>
                          )}
                        </td>

                        {/* Manus */}
                        <td className="py-3 px-3">
                          {r.manusAccount ? (
                            <div>
                              <div className="flex items-center gap-1 font-medium text-foreground">
                                <Bot className="size-3 text-purple-500" />
                                <span className="truncate max-w-[150px]">
                                  {r.manusAccount.email}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] ${manusCredits < 500 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"}`}
                              >
                                {manusCredits.toLocaleString()} credits left
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60 italic">Not set</span>
                          )}
                        </td>

                        {/* Other Tools */}
                        <td className="py-3 px-3">
                          {r.otherPlatforms.length === 0 ? (
                            <span className="text-muted-foreground/60">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {r.otherPlatforms.map((op) => (
                                <span
                                  key={op.platform}
                                  className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px]"
                                  title={`${op.platform}: ${op.email}`}
                                >
                                  {op.platform}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Quick Action */}
                        <td className="py-3 pl-3 text-right">
                          <button
                            onClick={() =>
                              openQuickMove(
                                r.project.id,
                                r.project.project_name,
                                r.project.hosting_account_id,
                                r.lovableAccount?.email ?? "Unassigned",
                                "all",
                                ["Lovable", "Google AI Studio", "Manus"],
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary transition shadow-2xs"
                          >
                            <ArrowRightLeft className="size-3" /> Move
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* TAB 3: TRANSFER LOG */}
      {activeTab === "transfers" && (
        <Panel
          title="Transfer History & Migration Audit"
          right={<Pill tone="mist">{transfers.length}</Pill>}
        >
          {transfers.length === 0 ? (
            <Empty>No project or tool moves recorded yet.</Empty>
          ) : (
            <div className="space-y-2">
              {transfers.slice(0, 40).map((t) => {
                const c = clients.find((x) => x.id === t.client_id);
                const fromAcc = accountOf(t.from_account_id);
                const toAcc = accountOf(t.to_account_id);

                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-border bg-card p-3 text-sm space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium">
                        <Building2 className="size-4 text-muted-foreground" />
                        <span>{c?.project_name || c?.business_name || "Client Project"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{fmtDate(t.moved_at)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-secondary px-2 py-0.5 font-mono">
                        {fromAcc?.email ?? "Initial / Unassigned"}
                      </span>
                      <ArrowRightLeft className="size-3.5 text-primary" />
                      <span className="rounded bg-primary/10 text-primary px-2 py-0.5 font-mono font-semibold">
                        {toAcc?.email ?? "Unknown Account"}
                      </span>
                    </div>

                    {t.note ? (
                      <p className="text-xs text-muted-foreground/90 italic pt-0.5">{t.note}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* QUICK MOVE / TRANSFER MODAL */}
      {moveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-bold flex items-center gap-2">
                  <ArrowRightLeft className="size-4 text-primary" />
                  Move Project / Tool to Another Email
                </h3>
                <p className="text-xs text-muted-foreground">
                  Switch builder accounts when credits are exhausted or when reassigning tools.
                </p>
              </div>
              <button
                onClick={() => setMoveModal((prev) => ({ ...prev, open: false }))}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Project Picker */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Select Project
                </label>
                <select
                  value={moveModal.projectId}
                  onChange={(e) => {
                    const p = projects.find((x) => x.id === e.target.value);
                    setMoveModal((prev) => ({
                      ...prev,
                      projectId: e.target.value,
                      projectName: p ? p.project_name : prev.projectName,
                      fromAccountId: p ? p.hosting_account_id : prev.fromAccountId,
                      fromAccountEmail: p
                        ? (accountOf(p.hosting_account_id)?.email ?? "Unassigned")
                        : prev.fromAccountEmail,
                    }));
                  }}
                  className={field + " mt-1"}
                >
                  {projects.map((p) => {
                    const client = clientOf(p.client_id);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.project_name} ({client ? client.business_name : "Internal"})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* What to Move (Scope) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  What do you want to move?
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMoveModal((prev) => ({ ...prev, platform: "all" }))}
                    className={`rounded-xl border p-2 text-left text-xs font-medium transition ${
                      moveModal.platform === "all"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-background hover:bg-secondary"
                    }`}
                  >
                    Entire Project (All Tools)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveModal((prev) => ({ ...prev, platform: "Lovable" }))}
                    className={`rounded-xl border p-2 text-left text-xs font-medium transition ${
                      moveModal.platform === "Lovable"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-background hover:bg-secondary"
                    }`}
                  >
                    Only Lovable
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMoveModal((prev) => ({ ...prev, platform: "Google AI Studio" }))
                    }
                    className={`rounded-xl border p-2 text-left text-xs font-medium transition ${
                      moveModal.platform === "Google AI Studio"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-background hover:bg-secondary"
                    }`}
                  >
                    Only Google AI Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveModal((prev) => ({ ...prev, platform: "Manus" }))}
                    className={`rounded-xl border p-2 text-left text-xs font-medium transition ${
                      moveModal.platform === "Manus"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-background hover:bg-secondary"
                    }`}
                  >
                    Only Manus
                  </button>
                </div>
              </div>

              {/* Source Account Info */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs">
                <span className="font-semibold text-muted-foreground">Current Account: </span>
                <span className="font-mono text-foreground font-medium">
                  {moveModal.fromAccountEmail}
                </span>
                {moveModal.fromAccountId && (
                  <span className="ml-2 text-muted-foreground">
                    (
                    {Number(
                      accountOf(moveModal.fromAccountId)?.credits_remaining ?? 0,
                    ).toLocaleString()}{" "}
                    credits left)
                  </span>
                )}
              </div>

              {/* Destination Account Picker */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Move to Google Account *
                </label>
                <select
                  value={moveModal.toAccountId}
                  onChange={(e) =>
                    setMoveModal((prev) => ({ ...prev, toAccountId: e.target.value }))
                  }
                  className={field + " mt-1"}
                >
                  <option value="">Select destination Google email…</option>
                  {accounts.map((a) => {
                    const isSource = a.id === moveModal.fromAccountId;
                    const credits = Number(a.credits_remaining ?? 0);
                    return (
                      <option key={a.id} value={a.id} disabled={isSource}>
                        {a.email} — {credits.toLocaleString()} credits left{" "}
                        {a.label ? `(${a.label})` : ""} {isSource ? "(Current Source)" : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  The project will automatically inherit the Google login password configured on the
                  destination account.
                </p>
              </div>

              {/* Optional Reason */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Reason / Migration Note (Optional)
                </label>
                <input
                  value={moveModal.reason}
                  onChange={(e) => setMoveModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Credits exhausted on source account, switching to active tier"
                  className={field + " mt-1"}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setMoveModal((prev) => ({ ...prev, open: false }))}
                className="rounded-xl border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeTransfer.mutate()}
                disabled={!moveModal.toAccountId || executeTransfer.isPending}
                className="gradient-leaf inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <ArrowRightLeft className="size-4" />
                {executeTransfer.isPending ? "Transferring…" : "Confirm Move"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EMAIL PASSWORD MODAL */}
      {pwdModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-bold flex items-center gap-2 text-foreground">
                  <KeyRound className="size-4 text-primary" />
                  Edit Email Account Password
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Update credentials for{" "}
                  <span className="font-mono font-semibold text-primary">{pwdModal.email}</span>
                </p>
              </div>
              <button
                onClick={() => setPwdModal((prev) => ({ ...prev, open: false }))}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSavePasswordModal} className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    New Account Password *
                  </label>
                  <button
                    type="button"
                    onClick={generateSecurePassword}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="size-3" />
                    Generate Strong
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    type={showPwdEye ? "text" : "password"}
                    required
                    value={pwdModal.password}
                    onChange={(e) => setPwdModal((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter new password…"
                    className={field + " pr-10 font-mono"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwdEye((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwdEye ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Encrypted with AES-256-GCM. Updates Google AI Studio, Lovable and builder
                  environments immediately.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setPwdModal((prev) => ({ ...prev, open: false }))}
                  className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdModal.isSaving || !pwdModal.password.trim()}
                  className="rounded-xl gradient-leaf px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95 disabled:opacity-50"
                >
                  {pwdModal.isSaving ? "Saving…" : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
