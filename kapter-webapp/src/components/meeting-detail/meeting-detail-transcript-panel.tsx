import { MessageSquareText, Radio } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatSegmentRange } from "@/features/meetings/lib/formatters"
import type { DashboardMeetingTranscriptTurn } from "@/features/meetings/types"

interface MeetingDetailTranscriptPanelProps {
  turns: DashboardMeetingTranscriptTurn[]
  isLive: boolean
  rawTranscriptSegmentCount: number
}

export function MeetingDetailTranscriptPanel({
  turns,
  isLive,
  rawTranscriptSegmentCount,
}: MeetingDetailTranscriptPanelProps) {
  const { t } = useTranslation("meeting")
  const selfMicTurnCount = turns.filter((turn) =>
    turn.sourceTypes.includes("self_mic")
  ).length
  const flaggedTurnCount = turns.filter(
    (turn) => turn.mergeStrategies.length > 0
  ).length

  return (
    <Card className="flex h-full flex-col border-border/70 bg-background/92 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.72)]">
      <CardHeader>
        <CardTitle>{t("transcript.title")}</CardTitle>
        <CardDescription>
          {isLive
            ? t("transcript.descriptionLive")
            : t("transcript.descriptionStatic")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 grow flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <TranscriptStat label={t("transcript.visibleTurns")} value={String(turns.length)} />
          <TranscriptStat
            label={t("transcript.storedFragments")}
            value={String(rawTranscriptSegmentCount)}
          />
          <TranscriptStat
            label={t("transcript.selfMicTurns")}
            value={String(selfMicTurnCount)}
          />
          <TranscriptStat
            label={t("transcript.mergeFlags")}
            value={String(flaggedTurnCount)}
          />
        </div>

        <ScrollArea className="min-h-0 grow rounded-[1.5rem] border border-border/80 bg-muted/20 dark:border-white/10 dark:bg-white/4">
          <div className="space-y-3 p-3">
            {turns.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-background/80 p-6 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-slate-950/55">
                {isLive
                  ? t("transcript.emptyLive")
                  : t("transcript.emptyStatic")}
              </div>
            ) : (
              turns.map((turn) => (
                <div
                  className="rounded-[1.45rem] border border-border/80 bg-background px-4 py-4 dark:border-white/10 dark:bg-slate-950/55"
                  key={turn.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    <span className="inline-flex items-center gap-2 text-foreground">
                      <MessageSquareText className="size-4 text-muted-foreground" />
                      {turn.realName || turn.aiLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Radio className="size-3.5" />
                      {formatSegmentRange(turn.startTime, turn.endTime)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-foreground">
                    {turn.content}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {turn.sourceSegmentCount > 1 ? (
                      <ProvenancePill tone="neutral">
                        {t("transcript.mergedFragments", {
                          count: turn.sourceSegmentCount,
                        })}
                      </ProvenancePill>
                    ) : null}
                    {turn.sourceTypes.map((sourceType) => (
                      <ProvenancePill
                        key={`${turn.id}-${sourceType}`}
                        tone={sourceType === "self_mic" ? "success" : "info"}
                      >
                        {t("transcript.lane", {
                          value:
                            sourceType === "self_mic"
                              ? t("transcript.selfMic")
                              : t("transcript.tabMix"),
                        })}
                      </ProvenancePill>
                    ))}
                    {turn.mergeStrategies.map((mergeStrategy) => (
                      <ProvenancePill
                        key={`${turn.id}-${mergeStrategy}`}
                        tone={
                          mergeStrategy === "AMBIGUOUS_OVERLAP"
                            ? "warning"
                            : "success"
                        }
                      >
                        {t(`transcript.mergeStrategies.${mergeStrategy}`)}
                      </ProvenancePill>
                    ))}
                    {turn.mergeSourceTypes.map((sourceType) => (
                      <ProvenancePill
                        key={`${turn.id}-merge-${sourceType}`}
                        tone="neutral"
                      >
                        {t("transcript.comparedWith", {
                          value:
                            sourceType === "self_mic"
                              ? t("transcript.selfMic")
                              : t("transcript.tabMix"),
                        })}
                      </ProvenancePill>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function TranscriptStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-border/70 bg-background/85 px-4 py-3 dark:border-white/10 dark:bg-slate-950/55">
      <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function ProvenancePill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: "neutral" | "info" | "warning" | "success"
}) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : tone === "info"
          ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
          : "border-border/70 bg-muted/40 text-muted-foreground dark:border-white/10 dark:bg-white/6"

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClassName}`}
    >
      {children}
    </span>
  )
}
