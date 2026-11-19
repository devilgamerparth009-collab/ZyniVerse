import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import FollowingClient from "./FollowingClient";

export const metadata: Metadata = {
  title: "Following",
  robots: { index: false, follow: false },
};

export default async function FollowingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { id } = await params;

  return <FollowingClient userId={id} />;
}
