-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformUrl" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'bing',
    "rank" INTEGER,
    "inTop10" BOOLEAN NOT NULL DEFAULT false,
    "inTop50" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RankSnapshot_campaignId_platform_checkedAt_idx" ON "RankSnapshot"("campaignId", "platform", "checkedAt");

-- CreateIndex
CREATE INDEX "RankSnapshot_campaignId_keyword_checkedAt_idx" ON "RankSnapshot"("campaignId", "keyword", "checkedAt");

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
