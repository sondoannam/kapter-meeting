-- CreateEnum
CREATE TYPE "RecurringSpeakerProfileStatus" AS ENUM ('CANDIDATE', 'STABLE', 'PROMOTED');

-- CreateEnum
CREATE TYPE "MeetingSpeakerPostProcessStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "speakerPostProcessError" TEXT,
ADD COLUMN     "speakerPostProcessStatus" "MeetingSpeakerPostProcessStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "speakerPostProcessedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SpeakerProfile" ADD COLUMN     "recurringMatchConfidence" DOUBLE PRECISION,
ADD COLUMN     "recurringMatchSeenCount" INTEGER,
ADD COLUMN     "recurringSpeakerProfileId" TEXT;

-- CreateTable
CREATE TABLE "RecurringSpeakerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RecurringSpeakerProfileStatus" NOT NULL DEFAULT 'CANDIDATE',
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "meetingCount" INTEGER NOT NULL DEFAULT 1,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "promotedVoiceProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSpeakerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSpeakerSample" (
    "id" TEXT NOT NULL,
    "recurringSpeakerProfileId" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "rmsDb" DOUBLE PRECISION,
    "speechRatio" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "sampleRate" INTEGER,
    "sourceMeetingId" TEXT,
    "sourceSpeakerProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSpeakerSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringSpeakerProfile_userId_status_lastSeenAt_idx" ON "RecurringSpeakerProfile"("userId", "status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "RecurringSpeakerProfile_promotedVoiceProfileId_idx" ON "RecurringSpeakerProfile"("promotedVoiceProfileId");

-- CreateIndex
CREATE INDEX "RecurringSpeakerSample_recurringSpeakerProfileId_createdAt_idx" ON "RecurringSpeakerSample"("recurringSpeakerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "RecurringSpeakerSample_sourceMeetingId_idx" ON "RecurringSpeakerSample"("sourceMeetingId");

-- CreateIndex
CREATE INDEX "RecurringSpeakerSample_sourceSpeakerProfileId_idx" ON "RecurringSpeakerSample"("sourceSpeakerProfileId");

-- CreateIndex
CREATE INDEX "SpeakerProfile_meetingId_recurringSpeakerProfileId_idx" ON "SpeakerProfile"("meetingId", "recurringSpeakerProfileId");

-- AddForeignKey
ALTER TABLE "SpeakerProfile" ADD CONSTRAINT "SpeakerProfile_recurringSpeakerProfileId_fkey" FOREIGN KEY ("recurringSpeakerProfileId") REFERENCES "RecurringSpeakerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSpeakerProfile" ADD CONSTRAINT "RecurringSpeakerProfile_promotedVoiceProfileId_fkey" FOREIGN KEY ("promotedVoiceProfileId") REFERENCES "VoiceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSpeakerProfile" ADD CONSTRAINT "RecurringSpeakerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSpeakerSample" ADD CONSTRAINT "RecurringSpeakerSample_recurringSpeakerProfileId_fkey" FOREIGN KEY ("recurringSpeakerProfileId") REFERENCES "RecurringSpeakerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSpeakerSample" ADD CONSTRAINT "RecurringSpeakerSample_sourceMeetingId_fkey" FOREIGN KEY ("sourceMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSpeakerSample" ADD CONSTRAINT "RecurringSpeakerSample_sourceSpeakerProfileId_fkey" FOREIGN KEY ("sourceSpeakerProfileId") REFERENCES "SpeakerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
