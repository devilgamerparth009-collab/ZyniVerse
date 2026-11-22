"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function MfaSettings() {
  const { data: session, update } = useSession();
  const enabled = Boolean(session?.user?.mfaEnabled);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSetup() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ secret: string; otpauthUrl: string }>(
        "/api/auth/mfa/setup"
      );
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start MFA setup");
    } finally {
      setBusy(false);
    }
  }

  async function enableMfa() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ recoveryCodes: string[] }>("/api/auth/mfa/enable", {
        code: code.trim(),
      });
      setRecoveryCodes(data.recoveryCodes);
      setSecret(null);
      setCode("");
      await update();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable MFA");
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth/mfa/disable", {
        password,
        code: code.trim(),
      });
      setPassword("");
      setCode("");
      setRecoveryCodes(null);
      await update();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable MFA");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
            Two-factor authentication
          </h3>
          <p className="mt-1 text-xs text-[var(--color-mute)]">
            {enabled
              ? "Your account is protected with an authenticator app. Admin actions require MFA."
              : "Add an authenticator app for stronger account and admin security."}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            enabled
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {enabled ? "Enabled" : "Off"}
        </span>
      </div>

      {error && <p className="mt-4 text-xs text-red-400">{error}</p>}

      {!enabled && !secret && (
        <button
          type="button"
          disabled={busy}
          onClick={startSetup}
          className="mt-4 rounded-lg bg-[var(--color-cyan)] px-4 py-2 text-xs font-semibold text-black disabled:opacity-60"
        >
          {busy ? "Preparing…" : "Set up authenticator"}
        </button>
      )}

      {!enabled && secret && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-[var(--color-mute)]">
            Scan the QR link below or enter this secret manually in Google Authenticator,
            Authy, or any TOTP app:
          </p>
          <code className="block break-all rounded-lg bg-black/40 p-3 text-xs text-[var(--color-cyan)]">
            {secret}
          </code>
          {otpauthUrl && (
            <a
              href={otpauthUrl}
              className="inline-block text-xs text-[var(--color-magenta)] hover:underline"
            >
              Open authenticator setup link
            </a>
          )}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit code"
            className="w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-cyan)]"
          />
          <button
            type="button"
            disabled={busy || code.length !== 6}
            onClick={enableMfa}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black disabled:opacity-60"
          >
            {busy ? "Verifying…" : "Enable two-factor authentication"}
          </button>
        </div>
      )}

      {enabled && (
        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Account password"
            className="w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-cyan)]"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="Authenticator or recovery code"
            className="w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-cyan)]"
          />
          <button
            type="button"
            disabled={busy || !password || !code}
            onClick={disableMfa}
            className="rounded-lg border border-red-500/40 px-4 py-2 text-xs font-semibold text-red-400 disabled:opacity-60"
          >
            {busy ? "Disabling…" : "Disable two-factor authentication"}
          </button>
        </div>
      )}

      {recoveryCodes && recoveryCodes.length > 0 && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-xs font-semibold text-emerald-400">
            Save these recovery codes now. They will not be shown again.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-[var(--color-ink)]">
            {recoveryCodes.map((recoveryCode) => (
              <code key={recoveryCode}>{recoveryCode}</code>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
