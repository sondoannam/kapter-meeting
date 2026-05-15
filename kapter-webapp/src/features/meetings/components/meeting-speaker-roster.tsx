import * as React from "react"
import { LoaderCircle, Mic2, UserRoundPlus, Users } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import { cn } from "@/lib/utils"

import type {
  DashboardMeetingSpeaker,
  MeetingSpeakerPromotionRequest,
} from "../types"
import type {
  VoiceProfile,
  VoiceProfilesRequestStatus,
} from "@/features/voice-profiles/types"

interface MeetingSpeakerRosterProps {
  speakers: DashboardMeetingSpeaker[]
  voiceProfiles?: VoiceProfile[]
  voiceProfilesStatus?: VoiceProfilesRequestStatus
  canManage?: boolean
  onLinkSpeaker?: (speakerId: string, voiceProfileId: string) => Promise<void>
  onPromoteSpeaker?: (
    speakerId: string,
    payload: MeetingSpeakerPromotionRequest
  ) => Promise<void>
  onClearSpeakerLink?: (speakerId: string) => Promise<void>
}

type PromotionDraft = {
  displayName: string
  position: string
  department: string
  isActive: boolean
}

const emptyPromotionDraft: PromotionDraft = {
  displayName: "",
  position: "",
  department: "",
  isActive: true,
}

export function MeetingSpeakerRoster({
  speakers,
  voiceProfiles = [],
  voiceProfilesStatus = "ready",
  canManage = false,
  onLinkSpeaker,
  onPromoteSpeaker,
  onClearSpeakerLink,
}: MeetingSpeakerRosterProps) {
  const { t } = useTranslation("meeting")
  const [selectedVoiceProfileIds, setSelectedVoiceProfileIds] = React.useState<
    Record<string, string>
  >({})
  const [activeMutationSpeakerId, setActiveMutationSpeakerId] = React.useState<
    string | null
  >(null)
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [promoteSpeaker, setPromoteSpeaker] =
    React.useState<DashboardMeetingSpeaker | null>(null)
  const [promotionDraft, setPromotionDraft] =
    React.useState<PromotionDraft>(emptyPromotionDraft)

  const isManagementEnabled =
    canManage &&
    Boolean(onLinkSpeaker) &&
    Boolean(onPromoteSpeaker) &&
    Boolean(onClearSpeakerLink)

  const handleLinkSpeaker = async (
    speakerId: string,
    voiceProfileId: string | null
  ) => {
    if (!voiceProfileId || !onLinkSpeaker) {
      return
    }

    try {
      setActiveMutationSpeakerId(speakerId)
      setMutationError(null)
      await onLinkSpeaker(speakerId, voiceProfileId)
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : t("speakerRoster.linkError")
      )
    } finally {
      setActiveMutationSpeakerId(null)
    }
  }

  const handleClearLink = async (speakerId: string) => {
    if (!onClearSpeakerLink) {
      return
    }

    try {
      setActiveMutationSpeakerId(speakerId)
      setMutationError(null)
      await onClearSpeakerLink(speakerId)
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : t("speakerRoster.clearError")
      )
    } finally {
      setActiveMutationSpeakerId(null)
    }
  }

  const openPromotionDialog = (speaker: DashboardMeetingSpeaker) => {
    setPromoteSpeaker(speaker)
    setPromotionDraft({
      displayName: speaker.realName ?? "",
      position: "",
      department: "",
      isActive: true,
    })
    setMutationError(null)
  }

  const closePromotionDialog = () => {
    setPromoteSpeaker(null)
    setPromotionDraft(emptyPromotionDraft)
  }

  const handlePromoteSpeaker = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!promoteSpeaker || !onPromoteSpeaker) {
      return
    }

    if (!promotionDraft.displayName.trim()) {
      setMutationError(t("speakerRoster.displayNameRequired"))
      return
    }

    try {
      setActiveMutationSpeakerId(promoteSpeaker.id)
      setMutationError(null)
      await onPromoteSpeaker(promoteSpeaker.id, {
        displayName: promotionDraft.displayName,
        position: promotionDraft.position || null,
        department: promotionDraft.department || null,
        isActive: promotionDraft.isActive,
      })
      closePromotionDialog()
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : t("speakerRoster.promoteError")
      )
    } finally {
      setActiveMutationSpeakerId(null)
    }
  }

  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
      <CardHeader>
        <CardTitle>{t("speakerRoster.title")}</CardTitle>
        <CardDescription>{t("speakerRoster.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isManagementEnabled ? (
          <div className="rounded-[1.15rem] border border-border/70 bg-background/85 px-4 py-3 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-slate-950/55">
            {t("speakerRoster.managementHint")}
          </div>
        ) : null}

        {mutationError ? (
          <div className="rounded-[1.15rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {mutationError}
          </div>
        ) : null}

        <ScrollArea className="h-[320px] min-h-0 pr-3">
          {speakers.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/35 p-6 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/4">
              {t("speakerRoster.empty")}
            </div>
          ) : (
            speakers.map((speaker, index) => {
              const selectedVoiceProfileId =
                selectedVoiceProfileIds[speaker.id] ?? speaker.voiceProfileId ?? ""
              const isMutating = activeMutationSpeakerId === speaker.id

              return (
                <div
                  key={speaker.id}
                  className={cn(
                    "rounded-lg border border-border/80 bg-background p-4 dark:border-white/10 dark:bg-slate-950/55",
                    index !== 0 && "mt-3"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                        <Users className="size-4 text-muted-foreground" />
                        {speaker.realName || speaker.aiLabel}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone={speaker.isMapped ? "success" : "neutral"}>
                          {speaker.isMapped
                            ? t("speakerRoster.mapped")
                            : t("speakerRoster.unmapped")}
                        </StatusBadge>
                        <StatusBadge
                          tone={speaker.promotionEligible ? "info" : "warning"}
                        >
                          {speaker.promotionEligible
                            ? t("speakerRoster.promotionReady")
                            : t("speakerRoster.promotionBlocked")}
                        </StatusBadge>
                      </div>
                      <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
                        {speaker.isMapped
                          ? `${speaker.aiLabel} · ${speaker.voiceProfileName}`
                          : t("speakerRoster.awaitingNameMapping")}
                      </p>
                      {!speaker.isMapped && speaker.recurringSuggestionLabel ? (
                        <p className="text-xs leading-5 text-muted-foreground">
                          {t("speakerRoster.recurringHint", {
                            label: speaker.recurringSuggestionLabel,
                          })}
                        </p>
                      ) : null}
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

                  {isManagementEnabled ? (
                    <div className="mt-4 space-y-3 rounded-[1.1rem] border border-border/70 bg-muted/20 p-3 dark:border-white/10 dark:bg-white/4">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <Select
                          disabled={voiceProfilesStatus === "loading" || isMutating}
                          value={selectedVoiceProfileId}
                          onValueChange={(value) =>
                            setSelectedVoiceProfileIds((currentState) => ({
                              ...currentState,
                              [speaker.id]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 w-full rounded-3xl bg-input/50">
                            <SelectValue
                              placeholder={t("speakerRoster.selectProfile")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {voiceProfiles.map((voiceProfile) => (
                              <SelectItem
                                key={voiceProfile.id}
                                value={voiceProfile.id}
                              >
                                {voiceProfile.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          disabled={!selectedVoiceProfileId || isMutating}
                          onClick={() =>
                            void handleLinkSpeaker(
                              speaker.id,
                              selectedVoiceProfileId || null
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          {isMutating ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Mic2 />
                          )}
                          {t("speakerRoster.linkAction")}
                        </Button>

                        <Button
                          disabled={isMutating || !speaker.isMapped}
                          onClick={() => void handleClearLink(speaker.id)}
                          type="button"
                          variant="outline"
                        >
                          {t("speakerRoster.clearAction")}
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={!speaker.promotionEligible || isMutating}
                          onClick={() => openPromotionDialog(speaker)}
                          type="button"
                        >
                          <UserRoundPlus />
                          {t("speakerRoster.promoteAction")}
                        </Button>
                        {voiceProfilesStatus === "loading" ? (
                          <p className="text-sm text-muted-foreground">
                            {t("speakerRoster.loadingProfiles")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </ScrollArea>
      </CardContent>

      <Dialog open={promoteSpeaker !== null} onOpenChange={(open) => !open && closePromotionDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("speakerRoster.promoteDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("speakerRoster.promoteDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handlePromoteSpeaker}>
            <label className="space-y-2 text-sm text-foreground">
              <span className="font-medium">{t("speakerRoster.displayName")}</span>
              <Input
                value={promotionDraft.displayName}
                onChange={(event) =>
                  setPromotionDraft((currentDraft) => ({
                    ...currentDraft,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-2 text-sm text-foreground">
              <span className="font-medium">{t("speakerRoster.position")}</span>
              <Input
                value={promotionDraft.position}
                onChange={(event) =>
                  setPromotionDraft((currentDraft) => ({
                    ...currentDraft,
                    position: event.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-2 text-sm text-foreground">
              <span className="font-medium">{t("speakerRoster.department")}</span>
              <Input
                value={promotionDraft.department}
                onChange={(event) =>
                  setPromotionDraft((currentDraft) => ({
                    ...currentDraft,
                    department: event.target.value,
                  }))
                }
              />
            </label>

            <DialogFooter>
              <Button onClick={closePromotionDialog} type="button" variant="outline">
                {t("speakerRoster.cancelAction")}
              </Button>
              <Button
                disabled={activeMutationSpeakerId === promoteSpeaker?.id}
                type="submit"
              >
                {activeMutationSpeakerId === promoteSpeaker?.id ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <UserRoundPlus />
                )}
                {t("speakerRoster.confirmPromoteAction")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
