"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { useBotProtectionFields } from "@/components/BotProtectionFields";

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const { fields: botFields, element: botFieldsUi } = useBotProtectionFields();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRefCode(ref);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", email, username, password, ref: refCode, ...botFields }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Registration failed");
        return;
      }

      // New accounts always have a pending email verification token. Show the
      // inbox step instead of silently attempting a login that authorize()
      // will reject, which used to leave the creator signed out on the homepage.
      if (data.requiresVerification === true || typeof data.email === "string") {
        setVerificationEmail(typeof data.email === "string" ? data.email : email);
        setResent(false);
        return;
      }

      const result = await signIn("credentials", { email, password, ...botFields, redirect: false });
      if (result?.error) {
        setError("Account created. Please sign in after verifying your email.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!verificationEmail) return;
    setError("");
    setResending(true);
    setResent(false);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail, ...botFields }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not resend verification email");
        return;
      }
      setResent(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setResending(false);
    }
  }

  return (
    <PageTransition><div className="relative mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div key={i}
            className="particle-dot absolute h-1 w-1 rounded-full"
            style={{
              left: `${10 + (i * 7) % 80}%`,
              top: `${15 + (i * 13) % 70}%`,
              background: i % 3 === 0 ? "var(--color-magenta)" : i % 3 === 1 ? "var(--color-cyan)" : "var(--color-violet)",
              animationDelay: `${i * 0.6}s`,
              animationDuration: `${4 + (i % 3) * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="w-full">
        <div className="neon-card">
          <div className="px-8 py-10 sm:px-10">
            {/* Logo */}
            <div className="mb-6 text-center">
              <span className="logo-text font-display text-2xl font-bold tracking-wider">ZyniVerse</span>
            </div>

            <h1 className="neon-glow-text font-display text-center text-4xl font-bold tracking-wider">
              <div className="rounded-xl px-4 py-2 inline-block">
                {verificationEmail ? "ALMOST THERE" : "JOIN US"}
              </div>
            </h1>
            <p className="mt-2 text-center text-sm text-[var(--color-mute)] tracking-wider uppercase">
              {verificationEmail ? "Verify your email" : "Create your account"}
            </p>

            {verificationEmail ? (
              <div className="rgv-verify mt-10">
                <span className="rgv-icon" aria-hidden="true">✉</span>
                <h2 className="rgv-title font-display text-xl font-bold">Check your inbox</h2>
                <p className="rgv-copy">
                  We sent a verification link to <strong className="rgv-email">{verificationEmail}</strong>.
                  Verify your email to activate your account before signing in.
                </p>
                {botFieldsUi}
                <p className="rgv-note">Didn&apos;t get it? Check your spam folder or send it again.</p>
                <button type="button" onClick={handleResend} disabled={resending} className="login-btn rgv-resend">
                  <span /><span /><span /><span />
                  {resending ? "SENDING..." : "RESEND VERIFICATION EMAIL"}
                </button>
                {resent && (
                  <p className="rgv-ok" role="status">Verification email sent.</p>
                )}
                {error && (
                  <p className="text-center text-sm text-red-400 tracking-wider">
                    {error}
                  </p>
                )}
                <Link href="/login" className="rgv-link">Back to sign in</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-10 space-y-6">
                <div className="floating-input-wrap">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=" "
                    required
                  />
                  <label>Email</label>
                  <span className="input-glow-line" />
                </div>

                <div className="floating-input-wrap">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder=" "
                    required
                    minLength={3}
                  />
                  <label>Username</label>
                  <span className="input-glow-line" />
                </div>

                <div className="floating-input-wrap">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                    required
                    minLength={6}
                  />
                  <label>Password</label>
                  <span className="input-glow-line" />
                </div>

                {botFieldsUi}

                {error && (
                  <p className="text-center text-sm text-red-400 tracking-wider">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading} className="login-btn">
                  <span /><span /><span /><span />
                  {loading ? "CREATING..." : "CREATE ACCOUNT"}
                </button>
              </form>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-[var(--color-mute)] tracking-wider">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[var(--color-cyan)] transition-colors hover:text-[var(--color-magenta)]"
                >
                  SIGN IN
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div></PageTransition>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}
