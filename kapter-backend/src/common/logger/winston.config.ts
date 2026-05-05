import * as path from "node:path";
import { mkdirSync } from "node:fs";

import type { WinstonModuleOptions } from "nest-winston";
import { utilities as nestWinstonUtilities } from "nest-winston";
import { format, transports, type transport } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

import type { AppConfig } from "../../config/app.config";

function ensureLogDirectory(logDir: string): string {
  const resolvedLogDir = path.resolve(process.cwd(), logDir);

  mkdirSync(resolvedLogDir, { recursive: true });

  return resolvedLogDir;
}

const createJsonFormat = () =>
  format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  );

const createConsoleFormat = () =>
  format.combine(
    format.timestamp(),
    format.ms(),
    format.errors({ stack: true }),
    nestWinstonUtilities.format.nestLike("KapterBackend", {
      colors: true,
      prettyPrint: true,
    }),
  );

export const createWinstonOptions = (
  config: AppConfig,
): WinstonModuleOptions => {
  const isProduction = config.nodeEnv === "production";
  const resolvedLogDir = ensureLogDirectory(config.logDir);
  const loggerTransports: transport[] = [
    new transports.Console({
      level: config.logLevel,
      format: isProduction ? createJsonFormat() : createConsoleFormat(),
    }),
  ];

  if (isProduction) {
    loggerTransports.push(
      new DailyRotateFile({
        dirname: resolvedLogDir,
        filename: "%DATE%-combined.log",
        datePattern: "YYYY-MM-DD",
        maxFiles: "14d",
        zippedArchive: true,
        level: config.logLevel,
        format: createJsonFormat(),
      }),
      new DailyRotateFile({
        dirname: resolvedLogDir,
        filename: "%DATE%-error.log",
        datePattern: "YYYY-MM-DD",
        maxFiles: "30d",
        zippedArchive: true,
        level: "error",
        format: createJsonFormat(),
      }),
    );
  }

  return {
    level: config.logLevel,
    transports: loggerTransports,
    exitOnError: false,
  };
};
