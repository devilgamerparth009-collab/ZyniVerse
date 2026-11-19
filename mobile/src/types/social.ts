/**
 * Shared response shapes for the v1.5.0 social endpoints.
 *
 * These mirror the locked server contract (src/lib/social-types.ts on the web)
 * so screens stay strongly typed without a new dependency.
 */

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
  /** Short English label, e.g. "Watches One Piece". */
  reason: string;
};

export type FollowListResponse = {
  users: PublicUser[];
  nextCursor: string | null;
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

export type ChannelPostsResponse = {
  posts: ChannelPostView[];
  nextCursor: string | null;
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

export type ReactionState = {
  reactions: Record<string, number>;
  myReactions: string[];
};

export type SubscriptionState = {
  subscribed: boolean;
  subscriberCount: number;
};

export type CreateChannelInput = {
  name: string;
  description?: string;
  iconUrl?: string;
  coverUrl?: string;
};

export type CreateChannelPostInput = {
  content: string;
  imageUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  pinned?: boolean;
};

export type CreateStoryInput = {
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  caption?: string;
  channelId?: string;
};
