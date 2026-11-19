import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PeopleClient from "./PeopleClient";

export const metadata: Metadata = {
  title: "Find People",
  description: "Discover people on ZyniVerse, follow them, and start a conversation.",
  robots: { index: false, follow: false },
};

export default async function PeoplePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <PeopleClient />;
}
