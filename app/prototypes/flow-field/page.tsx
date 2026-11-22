import type { Metadata } from "next";
import { FlowFieldApp } from "./flow-field-app";
import meta from "./metadata.json";

export const metadata: Metadata = { title: meta.title, description: meta.description };

export default function FlowFieldPage() {
  return <FlowFieldApp />;
}
