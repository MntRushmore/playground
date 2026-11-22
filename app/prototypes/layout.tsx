import { getAllPrototypes } from "@/lib/prototypes";
import { PrototypeChrome } from "@/components/playground/prototype-chrome";

// Wraps every private prototype at /prototypes/<slug>.
export default function PrototypesLayout({ children }: LayoutProps<"/prototypes">) {
  const titles = Object.fromEntries(getAllPrototypes().map((p) => [p.slug, p.title]));
  return <PrototypeChrome titles={titles}>{children}</PrototypeChrome>;
}
