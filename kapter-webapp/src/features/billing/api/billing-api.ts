import type { BillingPlan, BillingStatusResponse } from "@kapter/contracts"

import {
  apiClient,
  createAuthHeaders,
  toApiErrorMessage,
} from "@/lib/api-client"

export interface BillingPlansResponse {
  plans: BillingPlan[]
}

export async function fetchBillingPlans() {
  try {
    const response = await apiClient.get<BillingPlansResponse>(
      "/api/billing/plans"
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to load subscription plans.")
    )
  }
}

export async function fetchBillingStatus(sessionToken: string) {
  try {
    const response = await apiClient.get<BillingStatusResponse>(
      "/api/billing",
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to load the subscription status.")
    )
  }
}
