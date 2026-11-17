-- Marks titles whose detail page has been read (language / genre / description
-- backfill). Null means "still needs enrichment", which lets the sync skip
-- titles whose detail page genuinely has no language tags instead of retrying
-- them on every run.

ALTER TABLE "DubCatalogTitle" ADD COLUMN "detailFetchedAt" TIMESTAMP(3);
