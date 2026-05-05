-- CreateEnum
CREATE TYPE "MeetingExtractionChunkStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MeetingArtifactDraftFinalizationStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "MeetingExtractionChunk" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "newContentStartMs" INTEGER NOT NULL,
    "promptStartMs" INTEGER NOT NULL,
    "promptEndMs" INTEGER NOT NULL,
    "status" "MeetingExtractionChunkStatus" NOT NULL DEFAULT 'PENDING',
    "partialSummary" TEXT,
    "taskMutationsJson" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingExtractionChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingArtifactDraft" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "rollingTasksJson" JSONB NOT NULL,
    "lastCompletedChunkIndex" INTEGER NOT NULL DEFAULT -1,
    "finalizationStatus" "MeetingArtifactDraftFinalizationStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingArtifactDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingExtractionChunk_meetingId_status_chunkIndex_idx" ON "MeetingExtractionChunk"("meetingId", "status", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingExtractionChunk_meetingId_chunkIndex_key" ON "MeetingExtractionChunk"("meetingId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingArtifactDraft_meetingId_key" ON "MeetingArtifactDraft"("meetingId");

-- AddForeignKey
ALTER TABLE "MeetingExtractionChunk" ADD CONSTRAINT "MeetingExtractionChunk_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingArtifactDraft" ADD CONSTRAINT "MeetingArtifactDraft_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
