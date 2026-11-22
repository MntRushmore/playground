import type { Metadata } from "next";
import meta from "./metadata.json";
import { PumpkinCarverApp } from "./pumpkin-carver-app";

export const metadata: Metadata = { title: meta.title, description: meta.description };

export default function PumpkinCarverPage() {
  return <PumpkinCarverApp />;
}
