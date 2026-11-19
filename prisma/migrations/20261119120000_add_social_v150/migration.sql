-- v1.5.0 social features: broadcast channels, 24h stories, channel reactions.

CREATE TABLE "BroadcastChannel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "coverUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelSubscription" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelPost" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelPostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelPostReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryView" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BroadcastChannel_slug_key" ON "BroadcastChannel"("slug");
CREATE INDEX "BroadcastChannel_ownerId_idx" ON "BroadcastChannel"("ownerId");

CREATE UNIQUE INDEX "ChannelSubscription_channelId_userId_key" ON "ChannelSubscription"("channelId", "userId");
CREATE INDEX "ChannelSubscription_userId_idx" ON "ChannelSubscription"("userId");

CREATE INDEX "ChannelPost_channelId_createdAt_idx" ON "ChannelPost"("channelId", "createdAt");

CREATE UNIQUE INDEX "ChannelPostReaction_postId_userId_emoji_key" ON "ChannelPostReaction"("postId", "userId", "emoji");
CREATE INDEX "ChannelPostReaction_postId_idx" ON "ChannelPostReaction"("postId");

CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt");
CREATE INDEX "Story_userId_createdAt_idx" ON "Story"("userId", "createdAt");
CREATE INDEX "Story_channelId_createdAt_idx" ON "Story"("channelId", "createdAt");

CREATE UNIQUE INDEX "StoryView_storyId_viewerId_key" ON "StoryView"("storyId", "viewerId");
CREATE INDEX "StoryView_storyId_idx" ON "StoryView"("storyId");
