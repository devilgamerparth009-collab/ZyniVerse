"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

const links = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/feedback", label: "Feedback", icon: "💬" },
  { href: "/admin/visitors", label: "Visitors", icon: "👁️" },
  { href: "/admin/crawlers", label: "Crawlers", icon: "🤖" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  { href: "/admin/ads", label: "Ads", icon: "📢" },
  { href: "/admin/affiliate", label: "Affiliate", icon: "🛒" },
  { href: "/admin/awards", label: "Awards", icon: "🏆" },
  { href: "/admin/reels", label: "Reels", icon: "🎬" },
  { href: "/admin/bingo", label: "Bingo", icon: "🎱" },
  { href: "/admin/moderation", label: "Moderation", icon: "🛡️" },
];

export default function AdminSidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 lg:hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/80 backdrop-blur-xl p-2 text-[var(--color-mute)] hover:text-[var(--color-cyan)] transition-colors shadow-[0_0_20px_rgba(41,242,224,0.15)]"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {collapsed && (
        <button
          onClick={onToggleCollapse}
          title="Show sidebar"
          className="fixed top-4 left-4 z-50 hidden lg:inline-flex rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/80 backdrop-blur-xl p-2 text-[var(--color-mute)] hover:text-[var(--color-cyan)] hover:bg-white/5 transition-colors shadow-[0_0_20px_rgba(41,242,224,0.15)]"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 0 : 272 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 z-40 h-full overflow-hidden border-r border-[var(--color-line)] bg-[var(--color-panel)]/95 backdrop-blur-2xl shadow-[0_0_60px_rgba(41,242,224,0.08)] transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:translate-x-0" : "lg:translate-x-0"}`}
        style={{ width: collapsed ? 0 : 272 }}
      >
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-[var(--color-line)]">
          <div className="relative">
            <span className="text-xl">⚡</span>
            <span className="absolute inset-0 blur-md text-xl opacity-60">⚡</span>
          </div>
          <span className="font-display text-lg font-bold bg-gradient-to-r from-[var(--color-cyan)] to-[var(--color-magenta)] bg-clip-text text-transparent">Admin Panel</span>
          <button
            onClick={onToggleCollapse}
            title="Hide sidebar"
            className="ml-auto hidden lg:inline-flex rounded-md p-1.5 text-[var(--color-mute)] hover:text-[var(--color-cyan)] hover:bg-white/5 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M6 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <nav className="mt-4 space-y-1 px-3.5">
          {links.map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300 overflow-hidden ${
                  isActive
                    ? "text-[var(--color-cyan)]"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="adminActive"
                    className="absolute inset-0 bg-gradient-to-r from-[var(--color-cyan)]/18 to-transparent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative text-base w-5 flex items-center justify-center">{link.icon}</span>
                <span className="relative truncate">{link.label}</span>
                {isActive && (
                  <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)] shadow-[0_0_8px_rgba(41,242,224,0.9)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-0 right-0 px-3.5">
          <Link
            href="/"
            className="group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-mute)] hover:bg-white/5 hover:text-[var(--color-ink)] transition-all duration-300 overflow-hidden"
          >
            <span className="relative text-base w-5 flex items-center justify-center">🏠</span>
            <span className="relative">Back to Site</span>
            <span className="relative ml-auto opacity-0 transition-opacity group-hover:opacity-100">→</span>
          </Link>
        </div>
      </motion.aside>
    </>
  );
}
