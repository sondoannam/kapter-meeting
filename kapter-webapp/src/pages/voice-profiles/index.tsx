import * as React from "react"
import {
  LoaderCircle,
  Mic2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { AppShellContainer } from "@/components/app-shell-container"
import { VoiceProfilesSkeleton } from "@/components/voice-profiles/voice-profiles-skeleton"
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
import { StatusBadge } from "@/components/ui/status-badge"
import { useVoiceProfiles } from "@/features/voice-profiles/hooks/use-voice-profiles"
import type {
  CreateVoiceProfileInput,
  VoiceProfile,
} from "@/features/voice-profiles/types"

type EditorState = {
  displayName: string
  position: string
  department: string
  isActive: boolean
}

const emptyEditorState: EditorState = {
  displayName: "",
  position: "",
  department: "",
  isActive: true,
}

const syncStatusTone = {
  PENDING: "info",
  SYNCED: "success",
  FAILED: "warning",
} as const

export default function VoiceProfilesPage() {
  const { t } = useTranslation("voiceProfiles")
  const {
    voiceProfiles,
    status,
    errorMessage,
    refresh,
    createVoiceProfile,
    updateVoiceProfile,
    deleteVoiceProfile,
    uploadEnrollment,
  } = useVoiceProfiles()
  const [isEditorOpen, setIsEditorOpen] = React.useState(false)
  const [editingProfile, setEditingProfile] = React.useState<VoiceProfile | null>(
    null
  )
  const [editorState, setEditorState] =
    React.useState<EditorState>(emptyEditorState)
  const [editorError, setEditorError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [deletingProfileId, setDeletingProfileId] = React.useState<string | null>(
    null
  )
  const [uploadingProfileId, setUploadingProfileId] = React.useState<string | null>(
    null
  )

  const openCreateDialog = () => {
    setEditingProfile(null)
    setEditorState(emptyEditorState)
    setEditorError(null)
    setIsEditorOpen(true)
  }

  const openEditDialog = (voiceProfile: VoiceProfile) => {
    setEditingProfile(voiceProfile)
    setEditorState({
      displayName: voiceProfile.displayName,
      position: voiceProfile.position ?? "",
      department: voiceProfile.department ?? "",
      isActive: voiceProfile.isActive,
    })
    setEditorError(null)
    setIsEditorOpen(true)
  }

  const closeDialog = () => {
    setIsEditorOpen(false)
    setEditorError(null)
    setIsSaving(false)
  }

  const handleEditorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editorState.displayName.trim()) {
      setEditorError(t("editor.displayNameRequired"))
      return
    }

    const payload: CreateVoiceProfileInput = {
      displayName: editorState.displayName,
      position: editorState.position || null,
      department: editorState.department || null,
      isActive: editorState.isActive,
    }

    try {
      setIsSaving(true)
      setEditorError(null)

      if (editingProfile) {
        await updateVoiceProfile(editingProfile.id, payload)
      } else {
        await createVoiceProfile(payload)
      }

      closeDialog()
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : t("editor.saveError")
      )
      setIsSaving(false)
    }
  }

  const handleDeleteProfile = async (voiceProfileId: string) => {
    try {
      setDeletingProfileId(voiceProfileId)
      await deleteVoiceProfile(voiceProfileId)
    } finally {
      setDeletingProfileId(null)
    }
  }

  const handleEnrollmentUpload = async (
    voiceProfileId: string,
    fileList: FileList | null
  ) => {
    const file = fileList?.[0]

    if (!file) {
      return
    }

    try {
      setUploadingProfileId(voiceProfileId)
      await uploadEnrollment(voiceProfileId, file)
    } finally {
      setUploadingProfileId(null)
    }
  }

  if (status === "loading" && voiceProfiles.length === 0) {
    return <VoiceProfilesSkeleton />
  }

  return (
    <AppShellContainer className="space-y-5 py-6">
      <Card className="border-border/70 bg-background/92 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="space-y-1.5">
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {t("header.eyebrow")}
            </p>
            <h1 className="font-heading text-3xl text-foreground">
              {t("header.title")}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("header.description")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void refresh()} type="button" variant="outline">
              {t("actions.refresh")}
            </Button>
            <Button onClick={openCreateDialog} type="button">
              <Plus />
              {t("actions.create")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {voiceProfiles.length === 0 ? (
        <Card className="border-border/70 bg-background/92 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))]">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary">
              <Mic2 className="size-6" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">
                {t("empty.title")}
              </p>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                {t("empty.description")}
              </p>
            </div>
            <Button onClick={openCreateDialog} type="button">
              <Plus />
              {t("actions.create")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {voiceProfiles.map((voiceProfile) => (
            <Card
              className="border-border/70 bg-background/92 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))]"
              key={voiceProfile.id}
            >
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{voiceProfile.displayName}</CardTitle>
                    <CardDescription>
                      {voiceProfile.position || voiceProfile.department
                        ? [voiceProfile.position, voiceProfile.department]
                            .filter(Boolean)
                            .join(" · ")
                        : t("card.noMetadata")}
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={syncStatusTone[voiceProfile.workerCacheStatus]}>
                      {t(`syncStatus.${voiceProfile.workerCacheStatus}`)}
                    </StatusBadge>
                    <StatusBadge tone={voiceProfile.isActive ? "success" : "neutral"}>
                      {voiceProfile.isActive ? t("card.active") : t("card.inactive")}
                    </StatusBadge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricTile
                    label={t("card.samples")}
                    value={String(voiceProfile.sampleCount)}
                  />
                  <MetricTile
                    label={t("card.lastSyncedAt")}
                    value={voiceProfile.lastSyncedAt?.slice(0, 16) ?? t("card.notSynced")}
                  />
                  <MetricTile
                    label={t("card.latestSample")}
                    value={
                      voiceProfile.samples[0]?.createdAt.slice(0, 16) ??
                      t("card.noSamples")
                    }
                  />
                </div>

                {voiceProfile.workerCacheError ? (
                  <div className="rounded-[1.15rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                    {voiceProfile.workerCacheError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => openEditDialog(voiceProfile)}
                    type="button"
                    variant="outline"
                  >
                    <Pencil />
                    {t("actions.edit")}
                  </Button>

                  <Button
                    disabled={deletingProfileId === voiceProfile.id}
                    onClick={() => void handleDeleteProfile(voiceProfile.id)}
                    type="button"
                    variant="destructive"
                  >
                    {deletingProfileId === voiceProfile.id ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                    {t("actions.delete")}
                  </Button>

                  <label className="inline-flex">
                    <input
                      accept="audio/*"
                      className="hidden"
                      disabled={uploadingProfileId === voiceProfile.id}
                      onChange={(event) => {
                        void handleEnrollmentUpload(
                          voiceProfile.id,
                          event.currentTarget.files
                        )
                        event.currentTarget.value = ""
                      }}
                      type="file"
                    />
                    <Button
                      asChild
                      disabled={uploadingProfileId === voiceProfile.id}
                      type="button"
                      variant="outline"
                    >
                      <span>
                        {uploadingProfileId === voiceProfile.id ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Upload />
                        )}
                        {t("actions.upload")}
                      </span>
                    </Button>
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? t("editor.editTitle") : t("editor.createTitle")}
            </DialogTitle>
            <DialogDescription>{t("editor.description")}</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleEditorSubmit}>
            <label className="space-y-2 text-sm text-foreground">
              <span className="font-medium">{t("editor.displayName")}</span>
              <Input
                value={editorState.displayName}
                onChange={(event) =>
                  setEditorState((currentState) => ({
                    ...currentState,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-2 text-sm text-foreground">
              <span className="font-medium">{t("editor.position")}</span>
              <Input
                value={editorState.position}
                onChange={(event) =>
                  setEditorState((currentState) => ({
                    ...currentState,
                    position: event.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-2 text-sm text-foreground">
              <span className="font-medium">{t("editor.department")}</span>
              <Input
                value={editorState.department}
                onChange={(event) =>
                  setEditorState((currentState) => ({
                    ...currentState,
                    department: event.target.value,
                  }))
                }
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-3 text-sm text-foreground dark:border-white/10">
              <input
                checked={editorState.isActive}
                onChange={(event) =>
                  setEditorState((currentState) => ({
                    ...currentState,
                    isActive: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>{t("editor.active")}</span>
            </label>

            {editorError ? (
              <div className="rounded-[1.15rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {editorError}
              </div>
            ) : null}

            <DialogFooter>
              <Button onClick={closeDialog} type="button" variant="outline">
                {t("actions.cancel")}
              </Button>
              <Button disabled={isSaving} type="submit">
                {isSaving ? <LoaderCircle className="animate-spin" /> : <Plus />}
                {editingProfile ? t("actions.save") : t("actions.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShellContainer>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-border/70 bg-background/85 px-4 py-3 dark:border-white/10 dark:bg-slate-950/55">
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
