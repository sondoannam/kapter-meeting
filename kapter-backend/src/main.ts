import "reflect-metadata";

import { ValidationPipe, type LoggerService } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import type { ConfigType } from "@nestjs/config";

import { AppModule } from "./app.module";
import { appConfig } from "./config/app.config";
import { parseCorsOrigins } from "./config/cors.util";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.useLogger(logger);
  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.enableCors({
    origin: parseCorsOrigins(config.corsOrigin),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Kapter Backend API")
    .setDescription("Orchestrator API for the Kapter AI Meeting Assistant")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(config.port);
  logger.log(`Kapter backend listening on ${await app.getUrl()}`);
}

void bootstrap();
