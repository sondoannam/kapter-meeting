import { MEETING_STATUS, type MeetingStatus } from "@kapter/contracts/domain"
import { useTranslation } from "react-i18next"

import { StatusBadge } from "@/components/ui/status-badge"

const statusTones: Record<MeetingStatus, "info" | "success" | "danger"> = {
  [MEETING_STATUS.RECORDING]: "danger",
  [MEETING_STATUS.PROCESSING]: "info",
  [MEETING_STATUS.COMPLETED]: "success",
  [MEETING_STATUS.FAILED]: "danger",
}

interface MeetingStatusBadgeProps {
  status: MeetingStatus
  className?: string
}

export function MeetingStatusBadge({
  status,
  className,
}: MeetingStatusBadgeProps) {
  const { t } = useTranslation("meeting")

  return (
    <StatusBadge className={className} tone={statusTones[status]}>
      {t(`status.${status}`)}
    </StatusBadge>
  )
}
