import React, { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Lock,
  X,
  Mail,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { revealAccountPassword, saveAccountPassword } from "@/lib/emails.functions";
import { broadcastDbSync } from "@/lib/database-interconnect";

interface EmailPasswordModalProps {
  open: boolean;
  onClose: () => void;
  email: string;
  accountId?: string;
  label?: string;
  onSuccess?: (newPassword: string) => void;
}

export function EmailPasswordModal({
  open,
  onClose,
  email,
  accountId,
  label,
  onSuccess,
}: EmailPasswordModalProps) {
  const qc = useQueryClient();
  const reveal = useServerFn(revealAccountPassword);
  const savePw = useServerFn(saveAccountPassword);

  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !email) {
      setCurrentPassword("");
      setNewPassword("");
      setShowCurrent(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    reveal({
      data: {
        id: accountId || email,
        email: email,
      },
    })
      .then((res) => {
        if (!isMounted) return;
        if (res?.password) {
          setCurrentPassword(res.password);
        } else {
          setCurrentPassword("");
        }
      })
      .catch((err) => {
        console.warn("Failed to load existing password:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, email, accountId, reveal]);

  if (!open) return null;

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    toast.success("Password copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generateStrongPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
    const randomSuffix = Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
    const generated = `Lovable#2026!${randomSuffix}`;
    setNewPassword(generated);
    setShowNew(true);
    toast.success("Generated strong 18-character password");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPassword = newPassword.trim();
    if (!targetPassword) {
      toast.error("Please enter a new password");
      return;
    }

    setIsSaving(true);
    try {
      await savePw({
        data: {
          id: accountId || email,
          email: email.trim().toLowerCase(),
          password: targetPassword,
        },
      });

      toast.success(`Password saved and synced for ${email}`);

      // Broadcast interconnect event across tabs and memory
      broadcastDbSync({
        type: "account_password_updated",
        id: accountId || email,
        payload: { email: email.trim().toLowerCase() },
      });

      // Invalidate relevant query caches
      qc.invalidateQueries({ queryKey: ["lovable-accounts"] });
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
      qc.invalidateQueries({ queryKey: ["projects"] });

      if (onSuccess) onSuccess(targetPassword);
      onClose();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to save password");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                Edit Email Password
              </h3>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="size-3 text-primary" />
                <span className="font-mono font-medium text-foreground">{email}</span>
                {label ? <span className="text-[11px]">({label})</span> : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Current Password Peek */}
          <div className="rounded-xl border border-border/80 bg-secondary/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Current Password:</span>
              {isLoading ? (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <RefreshCw className="size-3 animate-spin" /> Checking vault…
                </span>
              ) : currentPassword ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {showCurrent ? currentPassword : "••••••••••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title={showCurrent ? "Hide" : "Show"}
                  >
                    {showCurrent ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentPassword, "current")}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title="Copy current password"
                  >
                    {copiedKey === "current" ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-[11px] italic text-muted-foreground">None stored yet</span>
              )}
            </div>
          </div>

          {/* New Password Input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                New Password <span className="text-primary">*</span>
              </label>
              <button
                type="button"
                onClick={generateStrongPassword}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary transition hover:underline"
              >
                <Sparkles className="size-3" /> Generate strong
              </button>
            </div>
            <div className="relative mt-1.5">
              <input
                type={showNew ? "text" : "password"}
                required
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter or generate new password…"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 pr-20 font-mono text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                {newPassword ? (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newPassword, "new")}
                    className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title="Copy password"
                  >
                    {copiedKey === "new" ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-2.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" />
            <span>
              Encrypted and synced across GitHub Main Repo, Google AI Studio, Lovable, and builder
              accounts.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-input bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !newPassword.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Lock className="size-3.5" /> Save Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
