import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, mfaEnabled } = await getAdminSession();
  if (!isAdmin) {
    redirect("/login");
  }
  if (!mfaEnabled) {
    // The API gate already blocks privileged writes. Send the admin to the
    // enrollment UI instead of leaving them on a page that cannot work.
    redirect("/profile");
  }

  return <AdminShell>{children}</AdminShell>;
}
