import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrototypeHeader } from "@/components/playground/prototype-header";
import { getPublicEntry, getPublicPrototypes } from "@/lib/prototypes";

// Public, password-free view of prototypes flagged `"public": true`.
// Only public slugs are generated; anything else is a 404 (never a login redirect).
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublicPrototypes().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = getPublicEntry(slug);
  if (!entry) return {};
  const { title, description } = entry.metadata;
  const { ogImage, ogVideo, thumbnail } = entry.assets;

  const image = ogImage
    ? { url: `/og/${slug}.png`, width: 1200, height: 630, alt: title }
    : thumbnail
      ? { url: `/thumbnails/${slug}-dark.jpg`, width: 640, height: 400, alt: title }
      : undefined;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/p/${slug}`,
      images: image ? [image] : undefined,
      videos: ogVideo
        ? [{ url: `/og/${slug}.mp4`, type: "video/mp4", width: 1200, height: 630 }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image.url] : undefined,
    },
  };
}

export default async function PublicPrototypePage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const entry = getPublicEntry(slug);
  if (!entry) notFound();
  const { default: Prototype } = await entry.load();

  return (
    <div className="flex min-h-dvh flex-col">
      <PrototypeHeader title={entry.metadata.title} />
      <main className="flex min-h-0 flex-1 flex-col">
        <Prototype />
      </main>
    </div>
  );
}
