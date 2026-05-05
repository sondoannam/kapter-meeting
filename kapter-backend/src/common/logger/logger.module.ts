import { Module } from "@nestjs/common";
import { WinstonModule } from "nest-winston";

import { appConfig, AppConfig } from "../../config/app.config";
import { createWinstonOptions } from "./winston.config";

@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: AppConfig) => createWinstonOptions(config),
    }),
  ],
})
export class AppLoggerModule {}
