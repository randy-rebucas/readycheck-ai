-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "disabledRules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "GitHubConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingTriage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "repoPath" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "dismissReason" TEXT,
    "dismissedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FindingTriage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "scanId" TEXT NOT NULL,
    "repoPath" TEXT NOT NULL,
    "ruleIds" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'queued',
    "branch" TEXT,
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "summary" TEXT,
    "diff" TEXT,
    "verification" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildSlice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "stories" TEXT[],
    "spec" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "branch" TEXT,
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "summary" TEXT,
    "testsAdded" INTEGER,
    "issuesFound" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mergedAt" TIMESTAMP(3),

    CONSTRAINT "BuildSlice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitHubConnection_orgId_key" ON "GitHubConnection"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "FindingTriage_orgId_repoPath_ruleId_key" ON "FindingTriage"("orgId", "repoPath", "ruleId");

-- CreateIndex
CREATE INDEX "FixRequest_orgId_scanId_idx" ON "FixRequest"("orgId", "scanId");

-- CreateIndex
CREATE INDEX "BuildSlice_projectId_idx" ON "BuildSlice"("projectId");

-- AddForeignKey
ALTER TABLE "GitHubConnection" ADD CONSTRAINT "GitHubConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingTriage" ADD CONSTRAINT "FindingTriage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixRequest" ADD CONSTRAINT "FixRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSlice" ADD CONSTRAINT "BuildSlice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSlice" ADD CONSTRAINT "BuildSlice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

