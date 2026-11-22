import type { ComponentType } from "react";

/** Shape of app/prototypes/<slug>/metadata.json as written by agents. */
export type RawMetadata = {
  title: string;
  description: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  hidden?: boolean;
  public?: boolean;
};

export type RegistryEntry = {
  slug: string;
  metadata: RawMetadata;
  assets: { thumbnail: boolean; ogImage: boolean; ogVideo: boolean };
  load: () => Promise<{ default: ComponentType }>;
};

/** Normalized, serializable prototype info safe to pass to client components. */
export type PrototypeSummary = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
  public: boolean;
  thumbnail: { light: string; dark: string } | null;
};
