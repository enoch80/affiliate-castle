-- Sprint C: SEO score + issues fields on ContentPiece

ALTER TABLE "ContentPiece"
  ADD COLUMN IF NOT EXISTS "seoScore"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "seoIssues" TEXT;
