import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CategoryOption {
  value: string;
  label: string;
  count: number;
}

interface CategoryDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: CategoryOption[];
  label?: string;
  className?: string;
}

export function CategoryDropdown({
  value,
  onChange,
  options,
  label = "Category",
  className,
}: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value) || options[0];
  const isFiltered = value !== "All" && value !== "all";

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 w-full sm:w-auto items-center justify-between gap-2.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer shadow-2xs select-none",
          isFiltered
            ? "border-primary/50 bg-primary/10 text-primary font-semibold hover:bg-primary/15"
            : "border-border/80 bg-background text-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          <Filter
            className={cn(
              "size-3.5 shrink-0",
              isFiltered ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span className="text-muted-foreground font-normal">{label}:</span>
          <span className="truncate font-semibold text-foreground">
            {selectedOption?.label ?? value}
          </span>
          <span className="opacity-75 font-semibold text-[11px]">
            ({selectedOption?.count ?? 0})
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-50 mt-1.5 w-64 max-h-80 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2.5 py-1.5 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Select {label}
          </div>
          <div className="py-1">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition cursor-pointer",
                    isSelected
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Check
                      className={cn("size-3.5 shrink-0", isSelected ? "text-primary" : "opacity-0")}
                    />
                    <span className="truncate">{opt.label}</span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      isSelected
                        ? "bg-primary/20 text-primary"
                        : opt.count > 0
                          ? "bg-secondary text-muted-foreground"
                          : "text-muted-foreground/40",
                    )}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
