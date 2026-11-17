-- Imported Hindi / regional dub catalogue (metadata only, links back to source).

-- CreateTable
CREATE TABLE "DubCatalogTitle" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'series',
    "posterUrl" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "season" TEXT,
    "episodeInfo" TEXT,
    "description" TEXT,
    "year" INTEGER,
    "rating" DOUBLE PRECISION,
    "lastModified" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DubCatalogTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DubScheduleEntry" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT,
    "season" TEXT,
    "episodeInfo" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dayLabel" TEXT,
    "timeLabel" TEXT,
    "releaseAt" TIMESTAMP(3),
    "sourceUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DubScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DubSourceState" (
    "source" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DubSourceState_pkey" PRIMARY KEY ("source")
);

-- CreateIndex
CREATE INDEX "DubCatalogTitle_kind_updatedAt_idx" ON "DubCatalogTitle"("kind", "updatedAt");

-- CreateIndex
CREATE INDEX "DubCatalogTitle_source_lastModified_idx" ON "DubCatalogTitle"("source", "lastModified");

-- CreateIndex
CREATE INDEX "DubCatalogTitle_source_kind_idx" ON "DubCatalogTitle"("source", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "DubCatalogTitle_source_sourceId_key" ON "DubCatalogTitle"("source", "sourceId");

-- CreateIndex
CREATE INDEX "DubScheduleEntry_releaseAt_idx" ON "DubScheduleEntry"("releaseAt");

-- CreateIndex
CREATE INDEX "DubScheduleEntry_source_idx" ON "DubScheduleEntry"("source");

-- CreateIndex
CREATE UNIQUE INDEX "DubScheduleEntry_source_sourceId_key" ON "DubScheduleEntry"("source", "sourceId");
