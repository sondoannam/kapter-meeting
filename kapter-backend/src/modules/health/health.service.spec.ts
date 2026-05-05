import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { HealthService } from "./health.service";

const createLlmHealthStatus = (status: "ok" | "degraded") => ({
  status,
  defaultProvider: "openai" as const,
  providers: {
    openai: {
      provider: "openai" as const,
      status: "ok" as const,
      configured: true,
      authStatus: "valid" as const,
      model: "gpt-4.1-mini",
    },
    gemini: {
      provider: "gemini" as const,
      status: "not_configured" as const,
      configured: false,
      authStatus: "not_configured" as const,
      model: "gemini-2.5-flash-lite",
    },
    ollama: {
      provider: "ollama" as const,
      status: "not_configured" as const,
      configured: false,
      authStatus: "not_configured" as const,
      model: "qwen3.5:9b",
    },
  },
});

const createService = (
  overrides: Partial<{
    databaseError: Error;
    aiWorkerStatus: number;
    aiWorkerBody: string;
    llmStatus: "ok" | "degraded";
  }> = {},
) => {
  const prisma = {
    $queryRawUnsafe: overrides.databaseError
      ? mock.fn(async () => {
          throw overrides.databaseError;
        })
      : mock.fn(async () => [{ "?column?": 1 }]),
  };
  const aiWorkerClient = {
    getBaseUrl: () => "http://127.0.0.1:8000",
    getTimeoutMs: () => 5_000,
  };
  const llmService = {
    getHealthStatus: mock.fn(async () =>
      createLlmHealthStatus(overrides.llmStatus ?? "ok"),
    ),
  };
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response(overrides.aiWorkerBody ?? '{"status":"ok"}', {
      status: overrides.aiWorkerStatus ?? 200,
      headers: {
        "content-type": "application/json",
      },
    });
  });
  const service = new HealthService(
    prisma as never,
    aiWorkerClient as never,
    llmService as never,
  );

  return {
    service,
    prisma,
    llmService,
    fetchMock,
  };
};

afterEach(() => {
  mock.restoreAll();
});

void describe("HealthService", () => {
  void it("returns a lightweight liveness payload", () => {
    const { service } = createService();

    const status = service.getStatus();

    assert.equal(status.status, "ok");
    assert.equal(status.service, "kapter-backend");
    assert.equal(typeof status.uptimeSeconds, "number");
  });

  void it("reports ready when dependencies and llm checks pass", async () => {
    const { service, prisma, llmService, fetchMock } = createService();

    const status = await service.getReadinessStatus();

    assert.equal(status.status, "ok");
    assert.equal(status.checks.database.status, "ok");
    assert.equal(status.checks.aiWorker.status, "ok");
    assert.equal(status.checks.llm.status, "ok");
    assert.equal(prisma.$queryRawUnsafe.mock.callCount(), 1);
    assert.equal(llmService.getHealthStatus.mock.callCount(), 1);
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  void it("reports degraded when a provider health probe fails", async () => {
    const { service } = createService({
      llmStatus: "degraded",
    });

    const status = await service.getReadinessStatus();

    assert.equal(status.status, "degraded");
    assert.equal(status.checks.llm.status, "degraded");
  });
});
