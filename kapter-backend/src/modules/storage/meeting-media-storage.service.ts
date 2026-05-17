import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { Client as MinioClient } from "minio";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { appConfig } from "../../config/app.config";

type StoredMeetingAudioFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type MinioLocation = {
  bucket: string;
  objectKey: string;
};

const MINIO_URI_PREFIX = "minio://";

const isMinioUri = (value: string): boolean =>
  value.trim().toLowerCase().startsWith(MINIO_URI_PREFIX);

const inferExtension = (fileName: string, mimeType: string): string => {
  const normalizedExtension = path.extname(fileName.trim()).toLowerCase();

  if (normalizedExtension) {
    return normalizedExtension;
  }

  if (mimeType.trim().toLowerCase() === "audio/mpeg") {
    return ".mp3";
  }

  return ".bin";
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      continue;
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

@Injectable()
export class MeetingMediaStorageService implements OnModuleInit {
  private readonly minioClient: MinioClient | null;
  private bucketReadyPromise: Promise<void> | null = null;

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {
    if (this.config.meetingMedia.driver !== "minio") {
      this.minioClient = null;
      return;
    }

    if (
      !this.config.meetingMedia.minioAccessKey ||
      !this.config.meetingMedia.minioSecretKey
    ) {
      throw new Error(
        "MEETING_MEDIA_MINIO_ACCESS_KEY and MEETING_MEDIA_MINIO_SECRET_KEY are required when MEETING_MEDIA_STORAGE_DRIVER=minio.",
      );
    }

    this.minioClient = new MinioClient({
      endPoint: this.config.meetingMedia.minioEndPoint,
      port: this.config.meetingMedia.minioPort,
      useSSL: this.config.meetingMedia.minioUseSSL,
      accessKey: this.config.meetingMedia.minioAccessKey,
      secretKey: this.config.meetingMedia.minioSecretKey,
      region: this.config.meetingMedia.minioRegion,
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.config.meetingMedia.driver === "minio") {
      await this.ensureBucketReady();
    }
  }

  async storeUploadedMeetingAudio(
    meetingId: string,
    file: StoredMeetingAudioFile,
  ): Promise<string> {
    if (this.config.meetingMedia.driver === "minio") {
      return this.storeInMinio(meetingId, file);
    }

    return this.storeLocally(meetingId, file);
  }

  async readMeetingAudio(audioLocation: string): Promise<Buffer> {
    if (isMinioUri(audioLocation)) {
      return this.readFromMinio(audioLocation);
    }

    return this.readFromLocal(audioLocation);
  }

  async deleteMeetingAudio(audioLocation: string): Promise<boolean> {
    try {
      if (isMinioUri(audioLocation)) {
        return this.deleteFromMinio(audioLocation);
      }

      return this.deleteFromLocal(audioLocation);
    } catch (error) {
      this.logger.warn("Meeting media delete failed", {
        audioLocation,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async storeLocally(
    meetingId: string,
    file: StoredMeetingAudioFile,
  ): Promise<string> {
    const fileExtension = inferExtension(file.originalname, file.mimetype);
    const meetingDirectory = path.join(this.config.meetingMedia.localDir, meetingId);
    const storedFilePath = path.join(meetingDirectory, `source${fileExtension}`);

    await fs.mkdir(meetingDirectory, { recursive: true });
    await fs.writeFile(storedFilePath, file.buffer);

    return storedFilePath;
  }

  private async storeInMinio(
    meetingId: string,
    file: StoredMeetingAudioFile,
  ): Promise<string> {
    await this.ensureBucketReady();

    const bucket = this.config.meetingMedia.minioBucket;
    const objectKey = this.buildObjectKey(meetingId, file);
    await this.getMinioClient().putObject(
      bucket,
      objectKey,
      file.buffer,
      file.size,
      {
        "Content-Type": file.mimetype,
        "X-Amz-Meta-Meeting-Id": meetingId,
        "X-Amz-Meta-Origin-Name": file.originalname,
      },
    );

    return `${MINIO_URI_PREFIX}${bucket}/${objectKey}`;
  }

  private async readFromLocal(audioLocation: string): Promise<Buffer> {
    const normalizedRoot = path.resolve(this.config.meetingMedia.localDir);
    const normalizedLocation = path.resolve(audioLocation);

    if (
      normalizedLocation !== normalizedRoot &&
      !normalizedLocation.startsWith(`${normalizedRoot}${path.sep}`)
    ) {
      throw new Error("Meeting media path is outside the managed local storage root.");
    }

    return fs.readFile(normalizedLocation);
  }

  private async readFromMinio(audioLocation: string): Promise<Buffer> {
    const { bucket, objectKey } = this.parseMinioLocation(audioLocation);
    const objectStream = (await this.getMinioClient().getObject(
      bucket,
      objectKey,
    )) as Readable;

    return streamToBuffer(objectStream);
  }

  private async deleteFromLocal(audioLocation: string): Promise<boolean> {
    const normalizedRoot = path.resolve(this.config.meetingMedia.localDir);
    const normalizedLocation = path.resolve(audioLocation);

    if (
      normalizedLocation !== normalizedRoot &&
      !normalizedLocation.startsWith(`${normalizedRoot}${path.sep}`)
    ) {
      this.logger.info("Skipping unmanaged local meeting media delete", {
        audioLocation,
      });
      return false;
    }

    await fs.rm(path.dirname(normalizedLocation), {
      recursive: true,
      force: true,
    });
    return true;
  }

  private async deleteFromMinio(audioLocation: string): Promise<boolean> {
    const { bucket, objectKey } = this.parseMinioLocation(audioLocation);

    if (bucket !== this.config.meetingMedia.minioBucket) {
      this.logger.info("Skipping unmanaged MinIO meeting media delete", {
        audioLocation,
      });
      return false;
    }

    await this.getMinioClient().removeObject(bucket, objectKey);
    return true;
  }

  private async ensureBucketReady(): Promise<void> {
    if (!this.bucketReadyPromise) {
      this.bucketReadyPromise = (async () => {
        const client = this.getMinioClient();
        const bucket = this.config.meetingMedia.minioBucket;
        const exists = await client.bucketExists(bucket);

        if (exists) {
          this.logger.info("Meeting media MinIO bucket is ready", {
            bucket,
          });
          return;
        }

        if (this.config.meetingMedia.minioRegion) {
          await client.makeBucket(bucket, this.config.meetingMedia.minioRegion);
        } else {
          await client.makeBucket(bucket);
        }

        this.logger.info("Created meeting media MinIO bucket", {
          bucket,
        });
      })().catch((error) => {
        this.bucketReadyPromise = null;
        throw error;
      });
    }

    await this.bucketReadyPromise;
  }

  private getMinioClient(): MinioClient {
    if (!this.minioClient) {
      throw new Error("MinIO client is not configured for meeting media storage.");
    }

    return this.minioClient;
  }

  private buildObjectKey(
    meetingId: string,
    file: StoredMeetingAudioFile,
  ): string {
    const extension = inferExtension(file.originalname, file.mimetype);

    return `meetings/${meetingId}/source${extension}`;
  }

  private parseMinioLocation(audioLocation: string): MinioLocation {
    const withoutScheme = audioLocation.slice(MINIO_URI_PREFIX.length);
    const pathSeparatorIndex = withoutScheme.indexOf("/");

    if (pathSeparatorIndex <= 0) {
      throw new Error(`Invalid MinIO meeting media location: ${audioLocation}`);
    }

    const bucket = withoutScheme.slice(0, pathSeparatorIndex);
    const objectKey = withoutScheme.slice(pathSeparatorIndex + 1);

    if (!bucket || !objectKey) {
      throw new Error(`Invalid MinIO meeting media location: ${audioLocation}`);
    }

    return {
      bucket,
      objectKey,
    };
  }
}
