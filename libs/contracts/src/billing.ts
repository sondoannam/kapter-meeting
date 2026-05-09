export const PLAN_TIER = {
  FREE: "FREE",
  PRO: "PRO",
  TEAM: "TEAM",
} as const;

export type PlanTier = (typeof PLAN_TIER)[keyof typeof PLAN_TIER];

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "ACTIVE",
  TRIALING: "TRIALING",
  PAST_DUE: "PAST_DUE",
  CANCELED: "CANCELED",
} as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export interface BillingPlan {
  tier: PlanTier;
  name: string;
  description: string;
  monthlyQuotaMinutes: number;
  priceMonthlyUsd: number;
  featured: boolean;
  features: string[];
}

export interface QuotaSnapshot {
  tier: PlanTier;
  status: SubscriptionStatus;
  periodStart: string;
  periodEnd: string;
  monthlyQuotaMinutes: number;
  usedSeconds: number;
  remainingSeconds: number;
  canRecord: boolean;
  reason: string | null;
}

export interface BillingStatusResponse {
  plans: BillingPlan[];
  quota: QuotaSnapshot;
}
