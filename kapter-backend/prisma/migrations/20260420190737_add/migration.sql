-- CreateEnum
CREATE TYPE "MeetingAudioBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "externalMeetingId" TEXT;

-- CreateTable
CREATE TABLE "MeetingAudioBatch" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "sequenceStart" INTEGER NOT NULL,
    "sequenceEnd" INTEGER NOT NULL,
    "streamOffsetMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "MeetingAudioBatchStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "meetingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAudioBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingAudioBatch_meetingId_createdAt_idx" ON "MeetingAudioBatch"("meetingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAudioBatch_streamId_sequenceStart_sequenceEnd_key" ON "MeetingAudioBatch"("streamId", "sequenceStart", "sequenceEnd");

-- CreateIndex
CREATE INDEX "Meeting_externalMeetingId_idx" ON "Meeting"("externalMeetingId");

-- AddForeignKey
ALTER TABLE "MeetingAudioBatch" ADD CONSTRAINT "MeetingAudioBatch_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
