import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { Request } from "express";
import {
  verifyWebhook,
  type UserWebhookEvent,
  type WebhookEvent,
} from "@clerk/backend/webhooks";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { appConfig } from "src/config/app.config";
import {
  normalizeClerkUserEvent,
  type ClerkUserEventPayload,
} from "./clerk-user.mapper";
import { ClerkLocalUserService } from "./clerk-local-user.service";

@Injectable()
export class ClerkWebhookService {
  constructor(
    private readonly clerkLocalUserService: ClerkLocalUserService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async verifyRequest(request: RawBodyRequest<Request>): Promise<WebhookEvent> {
    if (!request.rawBody) {
      throw new BadRequestException("Missing raw webhook body.");
    }

    const webhookRequest = new Request(this.buildRequestUrl(request), {
      method: request.method,
      headers: this.buildHeaders(request.headers),
      body: request.rawBody.toString("utf8"),
    });

    try {
      return await verifyWebhook(webhookRequest, {
        signingSecret: this.config.clerk.webhookSigningSecret,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      this.logger.warn("Failed to verify Clerk webhook request", {
        message,
        path: request.originalUrl,
      });

      throw new BadRequestException("Invalid Clerk webhook signature.");
    }
  }

  async handleEvent(event: WebhookEvent): Promise<void> {
    if (!this.isUserWebhookEvent(event)) {
      this.logger.debug("Ignoring unsupported Clerk webhook event", {
        eventType: event.type,
      });
      return;
    }

    await this.syncUser(event);
  }

  private async syncUser(event: UserWebhookEvent): Promise<void> {
    const normalizedUser = normalizeClerkUserEvent(
      event as ClerkUserEventPayload,
    );
    await this.clerkLocalUserService.syncNormalizedUser(normalizedUser);
  }

  private buildRequestUrl(request: RawBodyRequest<Request>): string {
    const protocolHeader = request.headers["x-forwarded-proto"];
    const forwardedProtocol = Array.isArray(protocolHeader)
      ? protocolHeader[0]
      : protocolHeader;
    const protocol = forwardedProtocol ?? request.protocol ?? "http";
    const hostHeader =
      request.get("host") ?? request.headers.host ?? "localhost";
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;

    return new URL(request.originalUrl, `${protocol}://${host}`).toString();
  }

  private buildHeaders(headers: Request["headers"]): Headers {
    const normalizedHeaders = new Headers();

    for (const [headerName, headerValue] of Object.entries(headers)) {
      if (Array.isArray(headerValue)) {
        for (const value of headerValue) {
          normalizedHeaders.append(headerName, value);
        }
        continue;
      }

      if (typeof headerValue === "string") {
        normalizedHeaders.set(headerName, headerValue);
      }
    }

    return normalizedHeaders;
  }

  private isUserWebhookEvent(event: WebhookEvent): event is UserWebhookEvent {
    return (
      event.type === "user.created" ||
      event.type === "user.updated" ||
      event.type === "user.deleted"
    );
  }
}
