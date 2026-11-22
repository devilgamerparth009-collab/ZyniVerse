"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const email = params.get("email") || "";
  const missingParams = !token || !email;
  const [status, setStatus] = useState<"loading" | "ok" | "error">(missingParams ? "error" : "loading");
  const [message, setMessage] = useState(missingParams ? "Invalid verification link." : "Verifying your email...");

  useEffect(() => {
    if (missingParams) return;
    let cancelled = false;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Verification failed");
        if (!cancelled) {
          setStatus("ok");
          setMessage("Your email is verified. You can now sign in.");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : "Verification failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, email, missingParams]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-black text-white">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-2xl font-bold mb-3">Email Verification</h1>
        <p className={status === "error" ? "text-red-400" : "text-gray-300"}>{message}</p>
        {status !== "loading" && (
          <Link href="/login" className="inline-block mt-5 px-4 py-2 rounded-lg bg-cyan-400 text-black font-semibold">
            Go to Login
          </Link>
        )}
      </div>
    </main>
  );
}
