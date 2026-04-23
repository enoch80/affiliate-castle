-- Affiliate Castle — Initial Schema Migration
-- Sprint 2: Full DB setup

CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "hoplink" TEXT NOT NULL,
    "resolvedUrl" TEXT,
    "productName" TEXT,
    "niche" TEXT,
    "pricePoint" DOUBLE PRECISION,
    "commissionPct" DOUBLE PRECISION,
    "commissionFixed" DOUBLE PRECISION,
    "network" TEXT,
    "landingPageHtml" TEXT,
    "landingPageScreenshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketResearch" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "targetAudience" JSONB,
    "painPoints" JSONB,
    "benefits" JSONB,
    "trustSignals" JSONB,
    "competitorUrls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketResearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KeywordResearch" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "primaryKeyword" TEXT NOT NULL,
    "secondaryKeywords" JSONB,
    "serpTop10" JSONB,
    "semanticGap" JSONB,
    "avgWordCount" INTEGER,
    "targetWordCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KeywordResearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "angle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalConversions" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentPiece" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contentText" TEXT,
    "contentHtml" TEXT,
    "detectionScore" DOUBLE PRECISION,
    "serpBriefJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "platformPublishId" TEXT,
    "platformPublishUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentPiece_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadMagnet" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contentHtml" TEXT,
    "pdfPath" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadMagnet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BridgePage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "contentJson" JSONB,
    "leadMagnetId" TEXT,
    "optInEnabled" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "optIns" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BridgePage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "platformSource" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueClicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClickEvent" (
    "id" TEXT NOT NULL,
    "trackingLinkId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "countryCode" TEXT,
    "deviceType" TEXT,
    "timeOfDayBucket" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "trackingLinkId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "networkTransactionId" TEXT,
    "postbackRaw" JSONB,
    "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "nicheTag" TEXT,
    "sourceCampaignId" TEXT,
    "listmonkId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),
    CONSTRAINT "EmailSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSequence" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "bodyHtml" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EmailSequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramChannel" (
    "id" TEXT NOT NULL,
    "botTokenEncrypted" TEXT NOT NULL,
    "channelUsername" TEXT NOT NULL,
    "channelId" TEXT,
    "displayName" TEXT NOT NULL,
    "subscriberCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramPost" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "contentPieceId" TEXT,
    "content" TEXT NOT NULL,
    "imagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "forwards" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TelegramPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublishJob" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "contentPieceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "platformUrl" TEXT,
    "errorMessage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublishJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAccount" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "credentialsEncrypted" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyAnalytic" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueClicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "optIns" INTEGER NOT NULL DEFAULT 0,
    "emailOpens" INTEGER NOT NULL DEFAULT 0,
    "emailClicks" INTEGER NOT NULL DEFAULT 0,
    "telegramViews" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DailyAnalytic_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "MarketResearch_offerId_key" ON "MarketResearch"("offerId");
CREATE UNIQUE INDEX "BridgePage_slug_key" ON "BridgePage"("slug");
CREATE UNIQUE INDEX "TrackingLink_shortCode_key" ON "TrackingLink"("shortCode");
CREATE UNIQUE INDEX "Conversion_networkTransactionId_key" ON "Conversion"("networkTransactionId");
CREATE UNIQUE INDEX "EmailSubscriber_email_key" ON "EmailSubscriber"("email");
CREATE UNIQUE INDEX "DailyAnalytic_campaignId_date_key" ON "DailyAnalytic"("campaignId", "date");

-- Foreign keys
ALTER TABLE "MarketResearch" ADD CONSTRAINT "MarketResearch_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KeywordResearch" ADD CONSTRAINT "KeywordResearch_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadMagnet" ADD CONSTRAINT "LeadMagnet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BridgePage" ADD CONSTRAINT "BridgePage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailSequenceStep" ADD CONSTRAINT "EmailSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TelegramPost" ADD CONSTRAINT "TelegramPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TelegramPost" ADD CONSTRAINT "TelegramPost_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TelegramChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyAnalytic" ADD CONSTRAINT "DailyAnalytic_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
