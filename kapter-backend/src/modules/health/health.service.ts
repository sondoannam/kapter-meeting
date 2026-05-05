import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { AiWorkerClient } from "../ai-worker/ai-worker.client";
import { LlmService, type LlmHealthStatus } from "../llm/llm.service";

type DependencyStatus = "ok" | "error";
type ReadinessStatus = "ok" | "degraded";

export interface BasicHealthStatus {
  status: "ok";
  timestamp: string;
  service: "kapter-backend";
  uptimeSeconds: number;
}

export interface DependencyHealthStatus {
  status: DependencyStatus;
  latencyMs?: number;
  message?: string;
  endpoint?: string;
  code?: string;
}

export type ReadinessHealthStatus = Omit<BasicHealthStatus, "status"> & {
  status: ReadinessStatus;
  checks: {
    database: DependencyHealthStatus;
    aiWorker: DependencyHealthStatus;
    llm: LlmHealthStatus;
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiWorkerClient: AiWorkerClient,
    private readonly llmService: LlmService,
  ) {}

  getStatus(): BasicHealthStatus {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "kapter-backend",
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  async getReadinessStatus(): Promise<ReadinessHealthStatus> {
    const [database, aiWorker, llm] = await Promise.all([
      this.checkDatabase(),
      this.checkAiWorker(),
      this.llmService.getHealthStatus(),
    ]);

    return {
      ...this.getStatus(),
      status:
        database.status === "ok" &&
        aiWorker.status === "ok" &&
        llm.status === "ok"
          ? "ok"
          : "degraded",
      checks: {
        database,
        aiWorker,
        llm,
      },
    };
  }

  private async checkDatabase(): Promise<DependencyHealthStatus> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRawUnsafe("SELECT 1");

      return {
        status: "ok",
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: "error",
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkAiWorker(): Promise<DependencyHealthStatus> {
    const startTime = Date.now();
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(
      () => abortController.abort(),
      this.aiWorkerClient.getTimeoutMs(),
    );
    const endpoint = new URL(
      "/health",
      this.aiWorkerClient.getBaseUrl(),
    ).toString();

    try {
      const response = await fetch(endpoint, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        return {
          status: "error",
          latencyMs: Date.now() - startTime,
          endpoint,
          code: String(response.status),
          message: `AI worker health probe failed with ${response.status}.`,
        };
      }

      return {
        status: "ok",
        latencyMs: Date.now() - startTime,
        endpoint,
      };
    } catch (error) {
      return {
        status: "error",
        latencyMs: Date.now() - startTime,
        endpoint,
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
