import { notFound } from "next/navigation";

// Real prototypes are static folders (app/prototypes/<slug>/), which take precedence
// over this dynamic segment. Anything that reaches here doesn't exist.
export default function UnknownPrototype() {
  notFound();
}
