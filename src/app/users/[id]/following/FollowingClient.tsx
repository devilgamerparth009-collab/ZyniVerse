"use client";

import FollowList from "@/components/FollowList";

export default function FollowingClient({ userId }: { userId: string }) {
  return <FollowList userId={userId} mode="following" />;
}
