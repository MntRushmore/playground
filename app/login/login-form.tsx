"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function safeNext(raw: string | null) {
  // Only allow same-origin relative paths.
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Something went wrong");
        setPending(false);
        return;
      }
      window.location.assign(safeNext(params.get("next")));
    } catch {
      setError("Network error");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h1 className="text-lg font-medium">Playground</h1>
      <Input
        type="password"
        autoFocus
        autoComplete="current-password"
        placeholder="Password"
        aria-label="Password"
        aria-invalid={error ? true : undefined}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-11"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11" disabled={pending || password.length === 0}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
