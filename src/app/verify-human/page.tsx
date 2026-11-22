"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function VerifyHumanInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const [nonce, setNonce] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/verify-human", { method: "GET", credentials: "same-origin", cache: "no-store" });
        const data = await res.json();
        if (alive && data?.nonce) setNonce(String(data.nonce));
      } catch {
        if (alive) setError("Could not load verification. Refresh the page.");
      }
    })();
    return () => { alive = false; };
  }, []);

  async function onVerify() {
    if (!nonce) { setError("Verification not ready. Please refresh."); return; }
    setLoading(true);
    setError("");
    try {
      const answer = await sha256Hex(`human:${nonce}`);
      const res = await fetch("/api/verify-human", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      if (!res.ok) throw new Error("Verification failed");
      const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(target);
      router.refresh();
    } catch {
      setError("Verification failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-black text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl">🛡️</div>
        <h1 className="text-2xl font-bold">Human Verification</h1>
        <p className="mt-3 text-sm text-white/70">
          Please confirm you are human to continue to ZyniVerse. This helps protect the site from abusive bot traffic.
        </p>
        <button
          onClick={onVerify}
          disabled={loading || !nonce}
          className="mt-6 w-full rounded-xl bg-white text-black font-semibold py-3 hover:bg-white/90 disabled:opacity-60"
        >
          {loading ? "Verifying..." : !nonce ? "Loading..." : "I am human"}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}

export default function VerifyHumanPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black" />}>
      <VerifyHumanInner />
    </Suspense>
  );
}
