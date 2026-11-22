"use client";

import { usePathname } from "next/navigation";
import { PrototypeHeader } from "@/components/playground/prototype-header";

export function PrototypeChrome({
  titles,
  children,
}: {
  titles: Record<string, string>;
  children: React.ReactNode;
}) {
  const slug = usePathname().split("/")[2] ?? "";
  return (
    <div className="flex min-h-dvh flex-col">
      <PrototypeHeader title={titles[slug]} backHref="/" />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
