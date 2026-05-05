-- DropIndex
DROP INDEX "MeetingAudioBatch_streamId_sequenceStart_sequenceEnd_key";

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAudioBatch_streamId_sourceType_sequenceStart_sequenc_key" ON "MeetingAudioBatch"("streamId", "sourceType", "sequenceStart", "sequenceEnd");
