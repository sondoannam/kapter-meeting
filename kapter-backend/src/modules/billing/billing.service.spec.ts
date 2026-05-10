import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { ForbiddenException } from "@nestjs/common";

import { BillingService } from "./billing.service";

const createService = (usedSeconds = 0, subscription: unknown = null) => {
  const prisma = {
    user: {
      findFirst: mock.fn(async () => ({
        id: "user_1",
        subscription,
      })),
    },
    subscription: {
      findUnique: mock.fn(async () => subscription),
    },
    usageLedger: {
      aggregate: mock.fn(async () => ({
        _sum: {
          usedSeconds,
        },
      })),
      upsert: mock.fn(async () => undefined),
    },
    meeting: {
      findUnique: mock.fn(async () => ({
        id: "meeting_1",
        userId: "user_1",
        createdAt: new Date("2026-05-09T00:00:00.000Z"),
        audioBatches: [
          {
            durationMs: 120_000,
            sourceType: "TAB_MIX",
          },
          {
            durationMs: 90_000,
            sourceType: "SELF_MIC",
          },
        ],
      })),
    },
  };

  return {
    prisma,
    service: new BillingService(
      prisma as unknown as ConstructorParameters<typeof BillingService>[0],
    ),
  };
};

void describe("BillingService", () => {
  void it("returns a free quota snapshot when no subscription row exists", async () => {
    const { service } = createService(600);

    const billing = await service.getBillingStatus("clerk_user_1");

    assert.equal(billing.quota.tier, "FREE");
    assert.equal(billing.quota.monthlyQuotaMinutes, 60);
    assert.equal(billing.quota.usedSeconds, 600);
    assert.equal(billing.quota.remainingSeconds, 3_000);
    assert.equal(billing.quota.canRecord, true);
    assert.ok(billing.plans.length >= 3);
  });

  void it("blocks capture starts when monthly quota is exhausted", async () => {
    const { service } = createService(3_600);

    await assert.rejects(
      () => service.ensureCanStartRecording("user_1"),
      (error) =>
        error instanceof ForbiddenException &&
        /quota/i.test(error.message),
    );
  });

  void it("records one chargeable duration per meeting without double-counting dual lanes", async () => {
    const { prisma, service } = createService();

    await service.recordMeetingUsage("meeting_1");

    assert.equal(prisma.usageLedger.upsert.mock.callCount(), 1);
    const upsertCalls = prisma.usageLedger.upsert.mock.calls as unknown as Array<{
      arguments: [{ create: { usedSeconds: number } }];
    }>;
    const upsertInput = upsertCalls[0]?.arguments[0];

    assert.ok(upsertInput);
    assert.equal(
      upsertInput.create.usedSeconds,
      120,
    );
  });
});
