import type { Metadata } from "next";
import StoriesClient from "./StoriesClient";

export const metadata: Metadata = {
  title: "Stories",
  description: "Watch short updates from people and channels on ZyniVerse.",
  robots: { index: false, follow: false },
};

export default function StoriesPage() {
  return <StoriesClient />;
}
