import type { Metadata } from "next";
import { DoodleArmiesApp } from "./doodle-armies-app";
import meta from "./metadata.json";

export const metadata: Metadata = { title: meta.title, description: meta.description };

export default function DoodleArmiesPage() {
  return <DoodleArmiesApp />;
}
