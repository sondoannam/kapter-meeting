-- CreateEnum
CREATE TYPE "MeetingIngestionSource" AS ENUM ('LIVE_CAPTURE', 'FILE_UPLOAD');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "ingestionSource" "MeetingIngestionSource" NOT NULL DEFAULT 'LIVE_CAPTURE';
