-- CreateEnum
CREATE TYPE "ScanSourceType" AS ENUM ('local', 'git');

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "sourceType" "ScanSourceType" NOT NULL DEFAULT 'local';
