import type { BillingPlan, PlanTier } from "@kapter/contracts";

export const BILLING_PLANS = [
  {
    tier: "FREE",
    name: "Free",
    description: "For validating Kapter with a small monthly recording budget.",
    monthlyQuotaMinutes: 60,
    priceMonthlyUsd: 0,
    featured: false,
    features: [
      "60 recording minutes per month",
      "Google Meet capture",
      "Dashboard review workflow",
      "Manual Notion sync",
    ],
  },
  {
    tier: "PRO",
    name: "Pro",
    description: "For individuals and small teams running regular reviews.",
    monthlyQuotaMinutes: 600,
    priceMonthlyUsd: 19,
    featured: true,
    features: [
      "600 recording minutes per month",
      "Dual-lane Meet capture diagnostics",
      "Project memory extraction",
      "Approved action-item sync",
    ],
  },
  {
    tier: "TEAM",
    name: "Team",
    description: "For shared team workflows with a larger capture allowance.",
    monthlyQuotaMinutes: 1800,
    priceMonthlyUsd: 49,
    featured: false,
    features: [
      "1,800 recording minutes per month",
      "Shared project workspaces",
      "Notion destination setup",
      "Priority quota expansion path",
    ],
  },
] satisfies BillingPlan[];

export const FREE_PLAN_TIER: PlanTier = "FREE";

export function getBillingPlan(tier: PlanTier): BillingPlan {
  return (
    BILLING_PLANS.find((plan) => plan.tier === tier) ??
    BILLING_PLANS.find((plan) => plan.tier === FREE_PLAN_TIER)!
  );
}
