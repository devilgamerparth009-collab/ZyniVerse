import type { Metadata } from "next";
import ChannelsClient from "./ChannelsClient";

export const metadata: Metadata = {
  title: "Channels",
  description: "Follow broadcast channels and keep up with posts from the people and projects you care about.",
};

export default function ChannelsPage() {
  return <ChannelsClient />;
}
