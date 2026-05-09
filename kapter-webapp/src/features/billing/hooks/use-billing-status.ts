import * as React from "react"
import { useAuth } from "@clerk/react-router"
import type { BillingPlan, QuotaSnapshot } from "@kapter/contracts"

import { fetchBillingPlans, fetchBillingStatus } from "../api/billing-api"

type BillingRequestStatus = "loading" | "ready" | "error"

export function useBillingStatus() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [plans, setPlans] = React.useState<BillingPlan[]>([])
  const [quota, setQuota] = React.useState<QuotaSnapshot | null>(null)
  const [status, setStatus] =
    React.useState<BillingRequestStatus>("loading")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!isLoaded) {
      return
    }

    setStatus((currentStatus) =>
      currentStatus === "ready" ? currentStatus : "loading"
    )
    setErrorMessage(null)

    try {
      if (isSignedIn) {
        const sessionToken = await getToken()

        if (!sessionToken) {
          throw new Error("Unable to mint a Clerk session token for billing.")
        }

        const response = await fetchBillingStatus(sessionToken)

        setPlans(response.plans)
        setQuota(response.quota)
      } else {
        const response = await fetchBillingPlans()

        setPlans(response.plans)
        setQuota(null)
      }

      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load billing."
      )
    }
  }, [getToken, isLoaded, isSignedIn])

  React.useEffect(() => {
    let isCancelled = false

    const run = async () => {
      if (isCancelled) {
        return
      }

      await refresh()
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [refresh])

  return {
    plans,
    quota,
    status,
    errorMessage,
    refresh,
  }
}
