"use client";

export function SocialLoading({ count = 4, height = "h-16" }: { count?: number; height?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${height} animate-pulse rounded-xl neon-rgb-border bg-[var(--color-panel)]/40`} />
      ))}
    </div>
  );
}

export function SocialEmpty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 p-8 text-center backdrop-blur-sm">
      <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
      {description && <p className="mt-1 text-sm text-[var(--color-mute)]">{description}</p>}
    </div>
  );
}

export function SocialError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 p-8 text-center backdrop-blur-sm">
      <p className="text-sm text-[var(--color-ink)]">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-full neon-rgb-border px-5 py-2 text-xs font-bold text-[var(--color-cyan)] transition-colors hover:bg-[var(--color-cyan)]/10"
      >
        Try again
      </button>
    </div>
  );
}
