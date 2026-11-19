import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import FollowersClient from "./FollowersClient";

export const metadata: Metadata = {
  title: "Followers",
  robots: { index: false, follow: false },
};

export default async function FollowersPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { id } = await params;

  return <FollowersClient userId={id} />;
}
