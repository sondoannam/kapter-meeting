import type { ReactNode } from "react"

import { useMeetingHistory } from "@/features/meetings/hooks/use-meeting-history"
import { DashboardMeetingHistoryContext } from "@/features/meetings/context/dashboard-meeting-history"

export function DashboardMeetingHistoryProvider({
  children,
}: {
  children: ReactNode
}) {
  const value = useMeetingHistory()

  return (
    <DashboardMeetingHistoryContext.Provider value={value}>
      {children}
    </DashboardMeetingHistoryContext.Provider>
  )
}
