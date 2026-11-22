import type { Metadata } from "next";
import { MarbleRunApp } from "./marble-run-app";
import meta from "./metadata.json";

export const metadata: Metadata = { title: meta.title, description: meta.description };

export default function MarbleRunPage() {
  return <MarbleRunApp />;
}
