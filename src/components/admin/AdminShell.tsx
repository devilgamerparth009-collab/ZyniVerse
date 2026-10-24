"use client";

import { useEffect, useState } from "react";

import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("adminSidebarCollapsed") === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsed(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.dataset.adminSidebar = collapsed ? "hidden" : "open";
    return () => {
      delete document.documentElement.dataset.adminSidebar;
    };
  }, [collapsed]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("adminSidebarCollapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const sidebarW = collapsed ? 0 : 272;

  return (
    <div className="min-h-screen bg-[var(--color-void)] relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_20%_0%,rgba(41,242,224,0.08),transparent),radial-gradient(1000px_700px_at_80%_0%,rgba(255,64,146,0.06),transparent)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      </div>
      <AdminSidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      <main
        className="admin-main-content relative min-h-screen px-3 py-8 sm:px-4 lg:pl-3 lg:pr-6 xl:pl-3 xl:pr-8 2xl:pr-10"
        style={
          { "--_sidebar-w": `${sidebarW}px` } as React.CSSProperties
        }
      >
        <div className="w-full max-w-[1800px]">{children}</div>
      </main>
    </div>
  );
}


