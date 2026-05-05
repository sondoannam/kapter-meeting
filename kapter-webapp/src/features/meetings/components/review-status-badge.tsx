import type { MeetingArtifactReviewStatus } from "@/features/meetings/types"
import { useTranslation } from "react-i18next"

import { StatusBadge } from "@/components/ui/status-badge"

const tones: Record<
  MeetingArtifactReviewStatus,
  "info" | "warning" | "danger" | "success"
> = {
  PENDING: "info",
  READY: "warning",
  FAILED: "danger",
  APPROVED: "success",
}

interface ReviewStatusBadgeProps {
  reviewStatus: MeetingArtifactReviewStatus
  className?: string
}

export function ReviewStatusBadge({
  reviewStatus,
  className,
}: ReviewStatusBadgeProps) {
  const { t } = useTranslation("meeting")

  return (
    <StatusBadge className={className} tone={tones[reviewStatus]}>
      {t(`reviewStatus.${reviewStatus}`)}
    </StatusBadge>
  )
}
