import { MessageSquareText } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { formatSegmentRange } from "../lib/formatters"
import type { DashboardMeetingTranscriptTurn } from "../types"

interface MeetingTranscriptFeedProps {
  turns: DashboardMeetingTranscriptTurn[]
  isLive: boolean
}

export function MeetingTranscriptFeed({
  turns,
  isLive,
}: MeetingTranscriptFeedProps) {
  const { t } = useTranslation("meeting")

  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
      <CardHeader>
        <CardTitle>{t("transcript.title")}</CardTitle>
        <CardDescription>
          {isLive
            ? t("transcript.descriptionLive")
            : t("transcript.descriptionStatic")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {turns.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/35 p-6 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/4">
            {isLive
              ? t("transcript.emptyLive")
              : t("transcript.emptyStatic")}
          </div>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className="rounded-[1.5rem] border border-border/80 bg-background p-4 dark:border-white/10 dark:bg-slate-950/55"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                <span className="inline-flex items-center gap-2 text-foreground">
                  <MessageSquareText className="size-4 text-muted-foreground" />
                  {turn.realName || turn.aiLabel}
                </span>
                <span>
                  {formatSegmentRange(turn.startTime, turn.endTime)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-foreground">
                {turn.content}
              </p>
              {turn.sourceSegmentCount > 1 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("transcript.mergedFragments", {
                    count: turn.sourceSegmentCount,
                  })}
                </p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
