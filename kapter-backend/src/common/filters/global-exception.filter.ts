import type { ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Inject } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { BaseExceptionFilter } from "@nestjs/core";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Request, Response } from "express";
import type { Logger } from "winston";

import { appConfig } from "../../config/app.config";

type HttpExceptionResponse = {
  message?: string | string[];
  error?: string;
};

@Catch()
export class GlobalExceptionFilter extends BaseExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {
    super();
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception);
    const path = request.originalUrl ?? request.url;

    this.logger.error("Request failed", {
      statusCode,
      path,
      method: request.method,
      message,
      stack:
        this.config.nodeEnv !== "production" && exception instanceof Error
          ? exception.stack
          : undefined,
    });

    if (response.headersSent) {
      return;
    }

    response.status(statusCode).json({
      statusCode,
      timestamp: new Date().toISOString(),
      path,
      message,
    });
  }

  private extractMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === "string") {
        return response;
      }

      const { message, error } = response as HttpExceptionResponse;

      return message ?? error ?? exception.message;
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return "Internal server error";
  }
}
