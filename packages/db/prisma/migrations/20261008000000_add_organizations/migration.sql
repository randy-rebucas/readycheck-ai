-- Organizations become the tenant boundary. Every existing user gets a
-- personal org (as owner); their scans, notifications and subscription move
-- into it. Scans that never had an owner keep orgId NULL and stay invisible.

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'member');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "personal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "Membership_orgId_userId_key" ON "Membership"("orgId", "userId");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one personal org per existing user. The slug embeds the user id
-- so the rows below can be joined back without a temp mapping table.
INSERT INTO "Organization" ("id", "name", "slug", "personal")
SELECT gen_random_uuid()::text,
       COALESCE(NULLIF(u."name", ''), u."email", 'Personal') || '''s workspace',
       'personal-' || u."id",
       true
FROM "User" u;

INSERT INTO "Membership" ("id", "orgId", "userId", "role")
SELECT gen_random_uuid()::text, o."id", u."id", 'owner'
FROM "User" u
JOIN "Organization" o ON o."slug" = 'personal-' || u."id";

-- Scan.orgId
ALTER TABLE "Scan" ADD COLUMN "orgId" TEXT;

UPDATE "Scan" s
SET "orgId" = o."id"
FROM "Organization" o
WHERE s."userId" IS NOT NULL AND o."slug" = 'personal-' || s."userId";

CREATE INDEX "Scan_orgId_idx" ON "Scan"("orgId");
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notification.orgId (inherits from its scan; scan-less rows stay NULL = hidden)
ALTER TABLE "Notification" ADD COLUMN "orgId" TEXT;

UPDATE "Notification" n
SET "orgId" = s."orgId"
FROM "Scan" s
WHERE n."scanId" = s."id";

CREATE INDEX "Notification_orgId_createdAt_idx" ON "Notification"("orgId", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscription moves from user to the user's personal org.
ALTER TABLE "Subscription" ADD COLUMN "orgId" TEXT;

UPDATE "Subscription" sub
SET "orgId" = o."id"
FROM "Organization" o
WHERE o."slug" = 'personal-' || sub."userId";

ALTER TABLE "Subscription" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";
DROP INDEX "Subscription_userId_key";
ALTER TABLE "Subscription" DROP COLUMN "userId";

CREATE UNIQUE INDEX "Subscription_orgId_key" ON "Subscription"("orgId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
