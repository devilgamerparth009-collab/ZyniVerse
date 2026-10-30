import type { Metadata } from "next";
import DiscoverClient from "./client";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Discover — Unified Anime Feed",
  description: "A single feed of anime news, memes, reels, moments, fan art, cosplay and blogs all in one place.",
  alternates: { canonical: `${BASE_URL}/discover` },
};

export default function DiscoverPage() {
  return <DiscoverClient />;
}
