-- CreateEnum
CREATE TYPE "MeetingArtifactReviewStatus" AS ENUM ('PENDING', 'READY', 'APPROVED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "ProjectContextProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- DropForeignKey
ALTER TABLE "ActionItem" DROP CONSTRAINT "ActionItem_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "SpeakerProfile" DROP CONSTRAINT "SpeakerProfile_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "TranscriptSegment" DROP CONSTRAINT "TranscriptSegment_meetingId_fkey";

-- AlterTable
ALTER TABLE "ActionItem" ADD COLUMN     "status" "ActionItemStatus" NOT NULL DEFAULT 'TODO',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "artifactApprovedAt" TIMESTAMP(3),
ADD COLUMN     "artifactExtractionError" TEXT,
ADD COLUMN     "artifactReviewStatus" "MeetingArtifactReviewStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "ProjectContextUpdateProposal" (
    "id" TEXT NOT NULL,
    "proposedContextMarkdown" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "status" "ProjectContextProposalStatus" NOT NULL DEFAULT 'PENDING',
    "projectId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectContextUpdateProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectContextUpdateProposal_projectId_status_createdAt_idx" ON "ProjectContextUpdateProposal"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectContextUpdateProposal_meetingId_status_createdAt_idx" ON "ProjectContextUpdateProposal"("meetingId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectContextUpdateProposal" ADD CONSTRAINT "ProjectContextUpdateProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContextUpdateProposal" ADD CONSTRAINT "ProjectContextUpdateProposal_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakerProfile" ADD CONSTRAINT "SpeakerProfile_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
