"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const KEY = "zyni_human_ok";
const TTL = 24 * 60 * 60 * 1000;

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isVerified() {
  try { const t = Number(localStorage.getItem(KEY) || "0"); return t > Date.now() - TTL; } catch { return false; }
}

export default function HumanVerificationGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // The APK runs OAuth inside an in-app WebView with a fresh browser profile,
    // so it has no human-verification flag yet. Never put a full-screen overlay
    // between the WebView and the sign-in/hand-off pages.
    const params = new URLSearchParams(window.location.search);
    const isMobileOAuth =
      (pathname === "/login" && params.get("mobile") === "1") ||
      pathname === "/auth/mobile-done";
    if (pathname === "/verify-human" || isMobileOAuth) {
      setVerified(true);
      setReady(true);
      return;
    }
    const ok = isVerified();
    setVerified(ok);
    setReady(true);
  }, [pathname]);

  async function onVerify() {
    setLoading(true); setError("");
    try {
      const c = await fetch("/api/verify-human", { method: "GET", credentials: "same-origin", cache: "no-store" }).then(r => r.json());
      const nonce = String(c?.nonce || "");
      if (!nonce) throw new Error("no nonce");
      const answer = await sha256Hex(`human:${nonce}`);
      const res = await fetch("/api/verify-human", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) });
      if (!res.ok) throw new Error("failed");
      try { localStorage.setItem(KEY, String(Date.now())); } catch {}
      setVerified(true);
      router.refresh();
    } catch {
      setError("Verification failed. Please try again.");
    } finally { setLoading(false); }
  }

  if (!ready || verified) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/95 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl">🛡️</div>
        <h1 className="text-2xl font-bold">Human Verification</h1>
        <p className="mt-3 text-sm text-white/70">Please confirm you are human to continue to ZyniVerse.</p>
        <button onClick={onVerify} disabled={loading} className="mt-6 w-full rounded-xl bg-white text-black font-semibold py-3 hover:bg-white/90 disabled:opacity-60">
          {loading ? "Verifying..." : "I am human"}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
