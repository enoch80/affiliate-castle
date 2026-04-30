-- Sprint B: KGR fields + PAA/related searches on KeywordResearch + nicheSlug on Campaign

ALTER TABLE "KeywordResearch"
  ADD COLUMN IF NOT EXISTS "paaQuestions"      JSONB,
  ADD COLUMN IF NOT EXISTS "relatedSearches"   JSONB,
  ADD COLUMN IF NOT EXISTS "searchIntent"      TEXT,
  ADD COLUMN IF NOT EXISTS "difficultyLevel"   TEXT,
  ADD COLUMN IF NOT EXISTS "pinterestKeywords" JSONB,
  ADD COLUMN IF NOT EXISTS "kgrScore"          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "kgrTier"           TEXT,
  ADD COLUMN IF NOT EXISTS "allintitleCount"   INTEGER,
  ADD COLUMN IF NOT EXISTS "estimatedVolume"   INTEGER,
  ADD COLUMN IF NOT EXISTS "kgrCandidates"     JSONB;

ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "nicheSlug" TEXT;
