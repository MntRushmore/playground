import { Gallery } from "@/components/playground/gallery";
import { ThemeToggle } from "@/components/playground/theme-toggle";
import { getAllPrototypes } from "@/lib/prototypes";

export default function Home() {
  const prototypes = getAllPrototypes();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-[env(safe-area-inset-top)] pb-16 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <h1 className="text-base font-medium">Playground</h1>
        <ThemeToggle />
      </header>
      <Gallery prototypes={prototypes} />
    </div>
  );
}
