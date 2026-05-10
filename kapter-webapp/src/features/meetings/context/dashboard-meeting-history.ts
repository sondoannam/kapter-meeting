import * as React from "react"

import { useMeetingHistory } from "@/features/meetings/hooks/use-meeting-history"

export type DashboardMeetingHistoryContextValue = ReturnType<
  typeof useMeetingHistory
>

export const DashboardMeetingHistoryContext =
  React.createContext<DashboardMeetingHistoryContextValue | null>(null)

export function useDashboardMeetingHistory() {
  const context = React.useContext(DashboardMeetingHistoryContext)

  if (!context) {
    throw new Error(
      "useDashboardMeetingHistory must be used within DashboardMeetingHistoryProvider."
    )
  }

  return context
}
