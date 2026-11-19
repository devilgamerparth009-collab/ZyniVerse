import type { Metadata } from "next";
import ChannelClient from "./ChannelClient";

export const metadata: Metadata = {
  title: "Channel",
  robots: { index: false, follow: false },
};

export default async function ChannelDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ChannelClient slug={slug} />;
}
