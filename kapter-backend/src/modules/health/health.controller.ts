import {
  Controller,
  Get,
  HttpStatus,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Public } from "../clerk/public.decorator";
import { HealthService } from "./health.service";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Health check endpoint" })
  getHealth() {
    return this.healthService.getStatus();
  }

  @Get("ready")
  @ApiOperation({
    summary:
      "Readiness check endpoint with database, AI worker, and LLM provider probes",
  })
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const status = await this.healthService.getReadinessStatus();

    response.status(
      status.status === "ok"
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return status;
  }
}
