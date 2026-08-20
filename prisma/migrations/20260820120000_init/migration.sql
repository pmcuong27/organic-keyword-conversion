-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PropertyMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ga4PropertyId" TEXT NOT NULL,
    "ga4DisplayName" TEXT,
    "gscSiteUrl" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rowsUpserted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GscDailyMetric" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hour" TEXT NOT NULL DEFAULT '',
    "query" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "landingPage" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "clicks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GscDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ga4DailyMetric" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hour" TEXT NOT NULL DEFAULT '',
    "landingPage" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "eventName" TEXT NOT NULL,
    "channelGroup" TEXT NOT NULL DEFAULT 'Organic Search',
    "source" TEXT NOT NULL DEFAULT '',
    "sessions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eventCount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eventValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isKeyEvent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ga4DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordAttribution" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hour" TEXT NOT NULL DEFAULT '',
    "keyword" TEXT NOT NULL,
    "landingPage" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "clicks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pageTotalClicks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clickShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "propensityShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "organicConversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedConversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedConvRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceLevel" TEXT NOT NULL DEFAULT 'low',
    "eventBreakdown" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "PropertyMapping_userId_idx" ON "PropertyMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyMapping_userId_ga4PropertyId_gscSiteUrl_key" ON "PropertyMapping"("userId", "ga4PropertyId", "gscSiteUrl");

-- CreateIndex
CREATE INDEX "SyncJob_userId_startedAt_idx" ON "SyncJob"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "GscDailyMetric_propertyId_date_idx" ON "GscDailyMetric"("propertyId", "date");

-- CreateIndex
CREATE INDEX "GscDailyMetric_propertyId_landingPage_date_idx" ON "GscDailyMetric"("propertyId", "landingPage", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GscDailyMetric_propertyId_date_hour_query_page_device_count_key" ON "GscDailyMetric"("propertyId", "date", "hour", "query", "page", "device", "country");

-- CreateIndex
CREATE INDEX "Ga4DailyMetric_propertyId_date_idx" ON "Ga4DailyMetric"("propertyId", "date");

-- CreateIndex
CREATE INDEX "Ga4DailyMetric_propertyId_landingPage_date_idx" ON "Ga4DailyMetric"("propertyId", "landingPage", "date");

-- CreateIndex
CREATE INDEX "Ga4DailyMetric_propertyId_isKeyEvent_idx" ON "Ga4DailyMetric"("propertyId", "isKeyEvent");

-- CreateIndex
CREATE UNIQUE INDEX "Ga4DailyMetric_grain_source_key" ON "Ga4DailyMetric"("propertyId", "date", "hour", "landingPage", "eventName", "channelGroup", "device", "country", "source");

-- CreateIndex
CREATE INDEX "KeywordAttribution_propertyId_date_idx" ON "KeywordAttribution"("propertyId", "date");

-- CreateIndex
CREATE INDEX "KeywordAttribution_propertyId_estimatedConversions_idx" ON "KeywordAttribution"("propertyId", "estimatedConversions");

-- CreateIndex
CREATE INDEX "KeywordAttribution_propertyId_keyword_idx" ON "KeywordAttribution"("propertyId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordAttribution_propertyId_date_hour_keyword_landingPage_key" ON "KeywordAttribution"("propertyId", "date", "hour", "keyword", "landingPage", "device", "country");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMapping" ADD CONSTRAINT "PropertyMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GscDailyMetric" ADD CONSTRAINT "GscDailyMetric_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ga4DailyMetric" ADD CONSTRAINT "Ga4DailyMetric_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordAttribution" ADD CONSTRAINT "KeywordAttribution_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

