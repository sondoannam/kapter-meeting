-- CreateEnum
CREATE TYPE "TranscriptMergeStrategy" AS ENUM ('PREFERRED_SELF_MIC_DUPLICATE', 'AMBIGUOUS_OVERLAP');

-- AlterTable
ALTER TABLE "TranscriptSegment" ADD COLUMN     "isSuppressed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mergeSourceType" "AudioSourceType",
ADD COLUMN     "mergeStrategy" "TranscriptMergeStrategy",
ADD COLUMN     "suppressedAt" TIMESTAMP(3);
