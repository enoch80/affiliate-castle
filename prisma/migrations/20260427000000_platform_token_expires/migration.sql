-- AlterTable: add tokenExpiresAt to PlatformAccount
ALTER TABLE "PlatformAccount" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);
