import { Module } from "@nestjs/common";

import { MeetingMediaStorageService } from "./meeting-media-storage.service";

@Module({
  providers: [MeetingMediaStorageService],
  exports: [MeetingMediaStorageService],
})
export class StorageModule {}
