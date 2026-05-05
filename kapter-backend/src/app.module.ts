import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import path from "node:path";

import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { AppLoggerModule } from "./common/logger/logger.module";
import { appConfig, BACKEND_ROOT_DIR } from "./config/app.config";
import { envValidationSchema } from "./config/env.validation";
import { AiWorkerModule } from "./modules/ai-worker/ai-worker.module";
import { AudioStreamModule } from "./modules/audio-stream/audio-stream.module";
import { ClerkModule } from "./modules/clerk/clerk.module";
import { HealthModule } from "./modules/health/health.module";
import { LlmModule } from "./modules/llm/llm.module";
import { MeetingsModule } from "./modules/meetings/meetings.module";
import { NotionModule } from "./modules/notion/notion.module";
import { ProjectsModule } from "./modules/projects/projects.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        path.join(BACKEND_ROOT_DIR, ".env.local"),
        path.join(BACKEND_ROOT_DIR, ".env"),
      ],
      load: [appConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    AppLoggerModule,
    HealthModule,
    ClerkModule,
    AiWorkerModule,
    MeetingsModule,
    ProjectsModule,
    AudioStreamModule,
    NotionModule,
    LlmModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
