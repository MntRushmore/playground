"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { collectTags, filterPrototypes } from "@/lib/gallery-filter";
import type { PrototypeSummary } from "@/lib/prototype-types";
import { cn } from "@/lib/utils";
import { PrototypeCard } from "./prototype-card";

export function Gallery({ prototypes }: { prototypes: PrototypeSummary[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useLocalStorage("gallery", "showHidden", false);

  const hasHidden = prototypes.some((p) => p.hidden);
  const tags = useMemo(() => collectTags(prototypes, showHidden), [prototypes, showHidden]);
  const visible = useMemo(
    () => filterPrototypes(prototypes, { query, tag, showHidden }),
    [prototypes, query, tag, showHidden]
  );

  if (prototypes.length === 0) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">
        No prototypes yet. Ask your coding agent to make one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search"
            aria-label="Search prototypes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        {(tags.length > 0 || hasHidden) && (
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? null : t)}
                aria-pressed={tag === t}
                className="flex min-h-11 items-center px-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md"
              >
                <span
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                    tag === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground active:text-foreground"
                  )}
                >
                  {t}
                </span>
              </button>
            ))}
            {hasHidden && (
              <div className="ml-auto flex min-h-11 items-center gap-2 pl-2">
                <Label htmlFor="show-hidden" className="text-xs text-muted-foreground">
                  Show hidden
                </Label>
                <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
              </div>
            )}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Nothing matches.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <li key={p.slug} className="animate-in fade-in-0 duration-300">
              <PrototypeCard prototype={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
