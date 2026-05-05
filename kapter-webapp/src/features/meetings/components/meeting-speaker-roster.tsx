import { Users } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { DashboardMeetingSpeaker } from "../types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface MeetingSpeakerRosterProps {
  speakers: DashboardMeetingSpeaker[]
}

export function MeetingSpeakerRoster({ speakers }: MeetingSpeakerRosterProps) {
  const { t } = useTranslation("meeting")

  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
      <CardHeader>
        <CardTitle>{t("speakerRoster.title")}</CardTitle>
        <CardDescription>
          {t("speakerRoster.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px] min-h-0 pr-3">
          {speakers.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/35 p-6 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/4">
              {t("speakerRoster.empty")}
            </div>
          ) : (
            speakers.map((speaker, index) => (
              <div
                key={`${speaker.id}-${index}`}
                className={cn(
                  "rounded-lg border border-border/80 bg-background p-4 dark:border-white/10 dark:bg-slate-950/55",
                  index !== 0 && "mt-3"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                      <Users className="size-4 text-muted-foreground" />
                      {speaker.realName || speaker.aiLabel}
                    </p>
                    <p className="mt-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
                      {speaker.realName
                        ? speaker.aiLabel
                        : t("speakerRoster.awaitingNameMapping")}
                    </p>
                  </div>

                  <div className="text-right text-xs text-muted-foreground">
                    <p>
                      {t("speakerRoster.segments", {
                        count: speaker.segmentCount,
                      })}
                    </p>
                    <p className="mt-1">
                      {t("speakerRoster.actionItems", {
                        count: speaker.actionItemCount,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
