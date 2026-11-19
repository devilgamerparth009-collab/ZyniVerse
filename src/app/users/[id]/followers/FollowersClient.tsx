"use client";

import FollowList from "@/components/FollowList";

export default function FollowersClient({ userId }: { userId: string }) {
  return <FollowList userId={userId} mode="followers" />;
}
