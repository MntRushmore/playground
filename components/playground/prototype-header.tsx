import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

/** Thin bar above every prototype. `backHref` is omitted on public pages. */
export function PrototypeHeader({ title, backHref }: { title?: string; backHref?: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2 pt-[env(safe-area-inset-top)]">
      {backHref ? (
        <Button variant="ghost" size="icon" asChild className="size-11">
          <Link href={backHref} aria-label="All prototypes">
            <ArrowLeftIcon />
          </Link>
        </Button>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
      <ThemeToggle />
    </header>
  );
}
