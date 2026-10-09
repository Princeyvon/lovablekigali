import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Download, Upload, RotateCcw, Sparkles, X } from "lucide-react";
import {
  exportLibraryBundle,
  importLibraryBundle,
  resetLibraryToDefaults,
} from "@/lib/library-store";
import { onDbSync } from "@/lib/database-interconnect";

interface LibraryToolbarProps {
  onSync?: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
}

export function LibraryToolbar({ onSync, onAddNew, addNewLabel }: LibraryToolbarProps) {
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = () => {
    if (onSync) onSync();
  };

  useEffect(() => {
    const unsub = onDbSync((evt) => {
      if (
        evt.type === "library_skill_updated" ||
        evt.type === "library_inspo_updated" ||
        evt.type === "library_prompt_updated" ||
        evt.type === "library_synced"
      ) {
        refreshData();
      }
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key?.includes("agency_library")) {
        refreshData();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleExport = () => {
    try {
      exportLibraryBundle();
      toast.success("Library JSON backup downloaded successfully");
    } catch (err) {
      toast.error((err as Error).message || "Failed to export library");
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = importLibraryBundle(text);
      if (res.success) {
        toast.success(
          `Imported library assets: processed ${res.skillsCount} skills, ${res.inspoCount} inspo, ${res.promptsCount} prompts!`,
        );
        refreshData();
      } else {
        toast.error(res.error || "Failed to parse library bundle JSON");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReset = () => {
    resetLibraryToDefaults();
    setIsResetConfirmOpen(false);
    refreshData();
    toast.success("Library restored to standard agency presets");
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border/60 pb-3">
      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Import JSON library backup or bundle"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition"
        >
          <Upload className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Import Bundle</span>
        </button>

        <button
          type="button"
          onClick={handleExport}
          title="Download complete JSON backup of all skills, inspo, and prompts"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition"
        >
          <Download className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Export Backup</span>
        </button>

        <button
          type="button"
          onClick={() => setIsResetConfirmOpen(true)}
          title="Reset library to standard agency presets"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition"
        >
          <RotateCcw className="size-3.5" />
          <span className="hidden md:inline">Reset Presets</span>
        </button>

        {onAddNew && addNewLabel && (
          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex items-center gap-2 rounded-xl gradient-leaf px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 transition"
          >
            <Sparkles className="size-3.5" />
            <span>{addNewLabel}</span>
          </button>
        )}
      </div>

      {/* Reset Confirmation Dialog */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <RotateCcw className="size-5 text-amber-500" />
                <span>Restore Agency Presets?</span>
              </div>
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will restore all default system skills, dashboard inspirations, and text prompts.
              Any custom items with matching preset IDs will be refreshed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
