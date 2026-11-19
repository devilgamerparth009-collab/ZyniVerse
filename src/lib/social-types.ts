import type { Prisma } from "@prisma/client";

/** Shared response shapes for the v1.5.0 social features. */

export type PublicUser = {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
};

export type DiscoveredUser = PublicUser & {
  isFollowing: boolean;
  isFriend: boolean;
  mutualFollowers: number;
  reason: string; // short human label e.g. "Watches One Piece", "ZyniVerse team"
};

export type ChannelSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  coverUrl: string | null;
  isOfficial: boolean;
  owner: PublicUser;
  subscriberCount: number;
  postCount: number;
  isSubscribed: boolean;
  latestPost: { id: string; content: string; createdAt: string } | null;
};

export type ChannelPostView = {
  id: string;
  channelId: string;
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  pinned: boolean;
  createdAt: string;
  author: PublicUser;
  reactions: Record<string, number>;
  myReactions: string[];
  canManage: boolean;
};

export type StoryItem = {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
  viewCount: number;
  user: PublicUser;
  channel: { id: string; slug: string; name: string; iconUrl: string | null } | null;
};

/** Keep every public user projection limited to the fields above. */
export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Drop newlines, zero-width characters and other invisible text noise. */
export function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\ufeff]/g, " ").replace(/\s+/g, " ").trim();
}

/** The shaped channel row every channel endpoint selects from Prisma. */
export type ChannelSummaryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  coverUrl: string | null;
  isOfficial: boolean;
  owner: PublicUser;
  subscriptions: { id: string }[];
  _count: { subscriptions: number; posts: number };
  posts: { id: string; content: string; createdAt: Date }[];
};

/** One select shape for every endpoint that returns a ChannelSummary. */
export function channelSelect(viewerId?: string) {
  return {
    id: true,
    slug: true,
    name: true,
    description: true,
    iconUrl: true,
    coverUrl: true,
    isOfficial: true,
    owner: { select: { id: true, username: true, avatar: true, bio: true } },
    subscriptions: {
      where: { userId: viewerId ?? "" },
      select: { id: true },
      take: 1,
    },
    _count: { select: { subscriptions: true, posts: true } },
    posts: {
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { id: true, content: true, createdAt: true },
    },
  } satisfies Prisma.BroadcastChannelSelect;
}

export function toChannelSummary(
  channel: ChannelSummaryRow,
  viewerId?: string
): ChannelSummary {
  const latest = channel.posts[0];
  return {
    id: channel.id,
    slug: channel.slug,
    name: channel.name,
    description: channel.description,
    iconUrl: channel.iconUrl,
    coverUrl: channel.coverUrl,
    isOfficial: channel.isOfficial,
    owner: toPublicUser(channel.owner),
    subscriberCount: channel._count.subscriptions,
    postCount: channel._count.posts,
    isSubscribed: viewerId ? channel.subscriptions.length > 0 : false,
    latestPost: latest
      ? {
          id: latest.id,
          content: latest.content,
          createdAt: latest.createdAt.toISOString(),
        }
      : null,
  };
}

/** The shaped post row every channel-post endpoint selects from Prisma. */
export type ChannelPostRow = {
  id: string;
  channelId: string;
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  pinned: boolean;
  createdAt: Date;
  author: PublicUser;
};

export function toChannelPostView(
  post: ChannelPostRow,
  reactions: { reactions: Record<string, number>; myReactions: string[] },
  canManage: boolean
): ChannelPostView {
  return {
    id: post.id,
    channelId: post.channelId,
    content: post.content,
    imageUrl: post.imageUrl,
    linkUrl: post.linkUrl,
    linkLabel: post.linkLabel,
    pinned: post.pinned,
    createdAt: post.createdAt.toISOString(),
    author: toPublicUser(post.author),
    reactions: reactions.reactions,
    myReactions: reactions.myReactions,
    canManage,
  };
}

/** One select shape for every endpoint that returns a StoryItem. */
export function storySelect(viewerId?: string) {
  return {
    id: true,
    mediaUrl: true,
    mediaType: true,
    caption: true,
    createdAt: true,
    expiresAt: true,
    user: { select: { id: true, username: true, avatar: true, bio: true } },
    channel: {
      select: { id: true, slug: true, name: true, iconUrl: true },
    },
    views: { where: { viewerId: viewerId ?? "" }, select: { id: true }, take: 1 },
    _count: { select: { views: true } },
  } satisfies Prisma.StorySelect;
}

export type StoryRow = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption: string | null;
  createdAt: Date;
  expiresAt: Date;
  user: PublicUser;
  channel: { id: string; slug: string; name: string; iconUrl: string | null } | null;
  views: { id: string }[];
  _count: { views: number };
};

export function toStoryItem(story: StoryRow, viewerId?: string): StoryItem {
  return {
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType === "video" ? "video" : "image",
    caption: story.caption,
    createdAt: story.createdAt.toISOString(),
    expiresAt: story.expiresAt.toISOString(),
    viewed: viewerId ? story.views.length > 0 : false,
    viewCount: story._count.views,
    user: toPublicUser(story.user),
    channel: story.channel
      ? {
          id: story.channel.id,
          slug: story.channel.slug,
          name: story.channel.name,
          iconUrl: story.channel.iconUrl,
        }
      : null,
  };
}

/** Turn raw reaction rows into the counts/my-reactions pair used by the API. */
export function aggregateReactions(
  rows: readonly { emoji: string; userId: string }[],
  viewerId?: string
): { reactions: Record<string, number>; myReactions: string[] } {
  // Null prototype so an emoji like "__proto__" cannot pollute the object.
  const reactions = Object.create(null) as Record<string, number>;
  const myReactions: string[] = [];
  for (const row of rows) {
    reactions[row.emoji] = (reactions[row.emoji] ?? 0) + 1;
    if (viewerId && row.userId === viewerId) myReactions.push(row.emoji);
  }
  return { reactions, myReactions };
}
