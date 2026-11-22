import type { Metadata } from "next";
import meta from "./metadata.json";
import { PianoApp } from "./piano-app";

export const metadata: Metadata = { title: meta.title, description: meta.description };

export default function PianoPage() {
  return <PianoApp />;
}
