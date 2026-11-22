import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PrototypeSummary } from "@/lib/prototype-types";

/**
 * Static thumbnail card. Light and dark images are both rendered and swapped with
 * CSS (`dark:`), so there's no flash and no JS. Never embed a live iframe here.
 */
export function PrototypeCard({ prototype: p }: { prototype: PrototypeSummary }) {
  return (
    <Link
      href={`/prototypes/${p.slug}`}
      className="group flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-muted transition-colors duration-200 group-hover:border-foreground/20 group-active:border-foreground/30">
        {p.thumbnail ? (
          <>
            <Image
              src={p.thumbnail.light}
              alt=""
              width={1280}
              height={800}
              unoptimized
              className="size-full object-cover dark:hidden"
            />
            <Image
              src={p.thumbnail.dark}
              alt=""
              width={1280}
              height={800}
              unoptimized
              className="hidden size-full object-cover dark:block"
            />
          </>
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
            No preview yet
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-medium">{p.title}</h2>
          {p.public && <Badge variant="outline">Public</Badge>}
          {p.hidden && <Badge variant="outline">Hidden</Badge>}
        </div>
        {p.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
        )}
      </div>
    </Link>
  );
}
