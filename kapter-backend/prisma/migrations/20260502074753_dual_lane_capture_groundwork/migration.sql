-- CreateEnum
CREATE TYPE "CaptureContext" AS ENUM ('GOOGLE_MEET_ROOM', 'GENERIC_TAB');

-- CreateEnum
CREATE TYPE "AudioSourceType" AS ENUM ('TAB_MIX', 'SELF_MIC');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "captureContext" "CaptureContext",
ADD COLUMN     "degradedWithoutSelfMic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recorderLabelHint" TEXT;

-- AlterTable
ALTER TABLE "MeetingAudioBatch" ADD COLUMN     "sourceType" "AudioSourceType";

-- AlterTable
ALTER TABLE "TranscriptSegment" ADD COLUMN     "sourceType" "AudioSourceType";
