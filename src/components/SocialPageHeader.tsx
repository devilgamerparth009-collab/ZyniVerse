"use client";

import { motion } from "framer-motion";

interface SocialPageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export default function SocialPageHeader({
  eyebrow = "Community",
  title,
  description,
  icon,
}: SocialPageHeaderProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <div className="relative overflow-hidden rounded-2xl neon-rgb-border bg-[var(--color-panel)]/60 backdrop-blur-sm">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full blur-3xl"
          style={{ background: "rgba(0,255,255,0.15)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full blur-3xl"
          style={{ background: "rgba(255,0,255,0.1)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,0,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative px-6 py-7 sm:px-8 sm:py-9">
          <div className="mb-4 flex items-center gap-3">
            {icon && (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 backdrop-blur-sm">
                {icon}
              </div>
            )}
            <span
              className="font-mono text-xs uppercase tracking-[0.2em]"
              style={{ color: "var(--color-cyan)", textShadow: "0 0 10px rgba(0,255,255,0.5)" }}
            >
              {eyebrow}
            </span>
          </div>
          <div className="inline-block rounded-xl neon-rgb-border px-5 py-2">
            <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          </div>
          <p className="mt-3 max-w-xl text-sm text-[var(--color-mute)]">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
