-- CreateEnum
CREATE TYPE "WorkerCacheSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "VoiceProfileSampleSource" AS ENUM ('UPLOAD', 'MEETING_PROMOTION');

-- AlterTable
ALTER TABLE "SpeakerProfile" ADD COLUMN     "voiceProfileId" TEXT;

-- CreateTable
CREATE TABLE "VoiceProfile" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workerCacheStatus" "WorkerCacheSyncStatus" NOT NULL DEFAULT 'PENDING',
    "workerCacheError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceProfileSample" (
    "id" TEXT NOT NULL,
    "voiceProfileId" TEXT NOT NULL,
    "source" "VoiceProfileSampleSource" NOT NULL,
    "embedding" JSONB NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "rmsDb" DOUBLE PRECISION,
    "speechRatio" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "sampleRate" INTEGER,
    "sourceMeetingId" TEXT,
    "sourceSpeakerProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceProfileSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingSpeakerSample" (
    "id" TEXT NOT NULL,
    "speakerProfileId" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "sourceType" "AudioSourceType",
    "rmsDb" DOUBLE PRECISION,
    "speechRatio" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "sampleRate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingSpeakerSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceProfile_userId_isActive_workerCacheStatus_idx" ON "VoiceProfile"("userId", "isActive", "workerCacheStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceProfile_userId_displayName_key" ON "VoiceProfile"("userId", "displayName");

-- CreateIndex
CREATE INDEX "VoiceProfileSample_voiceProfileId_createdAt_idx" ON "VoiceProfileSample"("voiceProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceProfileSample_sourceMeetingId_idx" ON "VoiceProfileSample"("sourceMeetingId");

-- CreateIndex
CREATE INDEX "VoiceProfileSample_sourceSpeakerProfileId_idx" ON "VoiceProfileSample"("sourceSpeakerProfileId");

-- CreateIndex
CREATE INDEX "MeetingSpeakerSample_speakerProfileId_createdAt_idx" ON "MeetingSpeakerSample"("speakerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "SpeakerProfile_meetingId_voiceProfileId_idx" ON "SpeakerProfile"("meetingId", "voiceProfileId");

-- AddForeignKey
ALTER TABLE "SpeakerProfile" ADD CONSTRAINT "SpeakerProfile_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "VoiceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceProfile" ADD CONSTRAINT "VoiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceProfileSample" ADD CONSTRAINT "VoiceProfileSample_sourceMeetingId_fkey" FOREIGN KEY ("sourceMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceProfileSample" ADD CONSTRAINT "VoiceProfileSample_sourceSpeakerProfileId_fkey" FOREIGN KEY ("sourceSpeakerProfileId") REFERENCES "SpeakerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceProfileSample" ADD CONSTRAINT "VoiceProfileSample_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "VoiceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSpeakerSample" ADD CONSTRAINT "MeetingSpeakerSample_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "SpeakerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
