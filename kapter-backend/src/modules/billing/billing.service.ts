import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BillingStatusResponse,
  PlanTier,
  QuotaSnapshot,
  SubscriptionStatus,
} from "@kapter/contracts";

import { PrismaService } from "../../database/prisma.service";
import { BILLING_PLANS, FREE_PLAN_TIER, getBillingPlan } from "./billing-plans";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  "ACTIVE",
  "TRIALING",
]);

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function toContractTier(value?: string | null): PlanTier {
  if (value === "PRO" || value === "TEAM") {
    return value;
  }

  return FREE_PLAN_TIER;
}

function toContractStatus(value?: string | null): SubscriptionStatus {
  if (
    value === "ACTIVE" ||
    value === "TRIALING" ||
    value === "PAST_DUE" ||
    value === "CANCELED"
  ) {
    return value;
  }

  return "ACTIVE";
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getBillingStatus(clerkUserId: string): Promise<BillingStatusResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        clerkId: clerkUserId,
        deletedAt: null,
      },
      select: {
        id: true,
        subscription: {
          select: {
            tier: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    return {
      plans: BILLING_PLANS,
      quota: await this.buildQuotaSnapshot(user.id, user.subscription),
    };
  }

  async ensureCanStartRecording(userId: string): Promise<QuotaSnapshot> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: {
        tier: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    });
    const quota = await this.buildQuotaSnapshot(userId, subscription);

    if (!quota.canRecord) {
      throw new ForbiddenException(
        quota.reason ??
          "Recording quota is exhausted for the current billing period.",
      );
    }

    return quota;
  }

  async recordMeetingUsage(
    meetingId: string,
    source = "meeting_capture",
  ): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        audioBatches: {
          select: {
            durationMs: true,
            sourceType: true,
          },
        },
      },
    });

    if (!meeting || meeting.audioBatches.length === 0) {
      return;
    }

    const sourceDurations = new Map<string, number>();

    for (const batch of meeting.audioBatches) {
      const sourceType = batch.sourceType ?? "TAB_MIX";
      sourceDurations.set(
        sourceType,
        (sourceDurations.get(sourceType) ?? 0) + batch.durationMs,
      );
    }

    const chargeableDurationMs = Math.max(...sourceDurations.values());
    const usedSeconds = Math.max(1, Math.ceil(chargeableDurationMs / 1000));
    const periodStart = startOfUtcMonth(meeting.createdAt);
    const periodEnd = startOfNextUtcMonth(meeting.createdAt);

    await this.prisma.usageLedger.upsert({
      where: { meetingId: meeting.id },
      create: {
        userId: meeting.userId,
        meetingId: meeting.id,
        periodStart,
        periodEnd,
        usedSeconds,
        source,
      },
      update: {
        periodStart,
        periodEnd,
        usedSeconds,
        source,
      },
    });
  }

  private async buildQuotaSnapshot(
    userId: string,
    subscription?: {
      tier: string;
      status: string;
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
    } | null,
  ): Promise<QuotaSnapshot> {
    const now = new Date();
    const periodStart = startOfUtcMonth(now);
    const periodEnd = startOfNextUtcMonth(now);
    const status = toContractStatus(subscription?.status);
    const tier = ACTIVE_SUBSCRIPTION_STATUSES.has(status)
      ? toContractTier(subscription?.tier)
      : FREE_PLAN_TIER;
    const plan = getBillingPlan(tier);
    const usage = await this.prisma.usageLedger.aggregate({
      where: {
        userId,
        periodStart,
        periodEnd,
      },
      _sum: {
        usedSeconds: true,
      },
    });
    const usedSeconds = usage._sum.usedSeconds ?? 0;
    const quotaSeconds = plan.monthlyQuotaMinutes * 60;
    const remainingSeconds = Math.max(0, quotaSeconds - usedSeconds);
    const canRecord = remainingSeconds > 0;

    return {
      tier,
      status,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      monthlyQuotaMinutes: plan.monthlyQuotaMinutes,
      usedSeconds,
      remainingSeconds,
      canRecord,
      reason: canRecord
        ? null
        : "Recording quota is exhausted for the current billing period.",
    };
  }
}
