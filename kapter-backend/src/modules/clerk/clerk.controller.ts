import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request } from "express";

import { Public } from "./public.decorator";
import { ClerkWebhookService } from "./clerk-webhook.service";

@ApiExcludeController()
@Public()
@Controller("clerk/webhooks")
export class ClerkController {
  constructor(private readonly clerkWebhookService: ClerkWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() request: RawBodyRequest<Request>) {
    const event = await this.clerkWebhookService.verifyRequest(request);
    await this.clerkWebhookService.handleEvent(event);

    return { received: true };
  }
}
