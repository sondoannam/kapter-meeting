import * as React from "react"
import { FileAudio, LoaderCircle, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DashboardMeetingSummary } from "@/features/meetings/types"
import type { DashboardProjectSummary } from "@/features/projects/types"

const EMPTY_PROJECT_VALUE = "__draft_project__"

const isMp3File = (file: File): boolean => {
  const normalizedMimeType = file.type.trim().toLowerCase()
  const normalizedFileName = file.name.trim().toLowerCase()

  return (
    normalizedMimeType === "audio/mpeg" ||
    normalizedMimeType === "audio/mp3" ||
    normalizedFileName.endsWith(".mp3")
  )
}

const deriveTitleFromFileName = (fileName: string): string => {
  const trimmedFileName = fileName.trim()
  const extensionIndex = trimmedFileName.lastIndexOf(".")

  return extensionIndex > 0
    ? trimmedFileName.slice(0, extensionIndex)
    : trimmedFileName
}

type MeetingUploadDialogProps = {
  projects: DashboardProjectSummary[]
  defaultProjectId?: string | null
  isSubmitting: boolean
  onSubmit: (input: {
    file: File
    title?: string
    projectId?: string
  }) => Promise<DashboardMeetingSummary>
  onAccepted: (meeting: DashboardMeetingSummary) => void | Promise<void>
  trigger: React.ReactNode
}

export function MeetingUploadDialog({
  projects,
  defaultProjectId,
  isSubmitting,
  onSubmit,
  onAccepted,
  trigger,
}: MeetingUploadDialogProps) {
  const { t } = useTranslation(["dashboard", "meeting", "common"])
  const [open, setOpen] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [title, setTitle] = React.useState("")
  const [titleDirty, setTitleDirty] = React.useState(false)
  const [selectedProjectId, setSelectedProjectId] = React.useState(
    EMPTY_PROJECT_VALUE
  )
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const resetForm = React.useCallback(() => {
    setFile(null)
    setTitle("")
    setTitleDirty(false)
    setSelectedProjectId(
      defaultProjectId && projects.some((project) => project.id === defaultProjectId)
        ? defaultProjectId
        : EMPTY_PROJECT_VALUE
    )
    setSubmitError(null)
  }, [defaultProjectId, projects])

  React.useEffect(() => {
    if (open) {
      resetForm()
    }
  }, [open, resetForm])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null

    setFile(nextFile)
    setSubmitError(null)

    if (!nextFile) {
      if (!titleDirty) {
        setTitle("")
      }

      return
    }

    if (!titleDirty) {
      setTitle(deriveTitleFromFileName(nextFile.name))
    }
  }

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value)
    setTitleDirty(true)
    setSubmitError(null)
  }

  const handleSubmit = async () => {
    if (!file) {
      setSubmitError(t("uploadDialog.fileRequired", { ns: "dashboard" }))
      return
    }

    if (!isMp3File(file)) {
      setSubmitError(t("uploadDialog.fileTypeError", { ns: "dashboard" }))
      return
    }

    try {
      const meeting = await onSubmit({
        file,
        title: title.trim() || undefined,
        projectId:
          selectedProjectId === EMPTY_PROJECT_VALUE ? undefined : selectedProjectId,
      })

      setOpen(false)
      await onAccepted(meeting)
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("uploadDialog.submitError", { ns: "dashboard" })
      )
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t("uploadDialog.title", { ns: "dashboard" })}
          </DialogTitle>
          <DialogDescription>
            {t("uploadDialog.description", { ns: "dashboard" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-[1.3rem] border border-border/80 bg-muted/25 p-4 dark:border-white/10 dark:bg-white/4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-border/80 bg-background p-2.5 dark:border-white/10 dark:bg-slate-950/50">
                <FileAudio className="size-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t("uploadDialog.supportedFormatsTitle", { ns: "dashboard" })}
                </p>
                <p className="text-xs leading-6 text-muted-foreground">
                  {t("uploadDialog.supportedFormatsDescription", {
                    ns: "dashboard",
                  })}
                </p>
              </div>
            </div>
          </div>

          <label className="space-y-2 text-sm text-foreground">
            <span className="font-medium">
              {t("uploadDialog.fileLabel", { ns: "dashboard" })}
            </span>
            <Input
              accept=".mp3,audio/mpeg,audio/mp3"
              className="h-auto min-h-11 rounded-2xl border-border bg-background px-4 py-3 file:mr-3 file:rounded-full file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/15 dark:border-white/10 dark:bg-slate-950/50"
              onChange={handleFileChange}
              type="file"
            />
            <p className="text-xs text-muted-foreground">
              {file?.name ||
                t("uploadDialog.fileHint", {
                  ns: "dashboard",
                })}
            </p>
          </label>

          <label className="space-y-2 text-sm text-foreground">
            <span className="font-medium">
              {t("uploadDialog.titleLabel", { ns: "dashboard" })}
            </span>
            <Input
              className="h-11 rounded-2xl border-border bg-background px-4 dark:border-white/10 dark:bg-slate-950/50"
              onChange={handleTitleChange}
              placeholder={t("uploadDialog.titlePlaceholder", {
                ns: "dashboard",
              })}
              value={title}
            />
          </label>

          <label className="space-y-2 text-sm text-foreground">
            <span className="font-medium">
              {t("uploadDialog.projectLabel", { ns: "dashboard" })}
            </span>
            <Select
              onValueChange={(value) => {
                setSelectedProjectId(value)
                setSubmitError(null)
              }}
              value={selectedProjectId}
            >
              <SelectTrigger className="h-11 rounded-2xl border-border bg-background px-4 dark:border-white/10 dark:bg-slate-950/50">
                <SelectValue
                  placeholder={t("uploadDialog.projectPlaceholder", {
                    ns: "dashboard",
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_PROJECT_VALUE}>
                  {t("uploadDialog.projectDraftOption", { ns: "dashboard" })}
                </SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {submitError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
              {submitError}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {t("actions.cancel", { ns: "common" })}
          </Button>
          <Button disabled={isSubmitting} onClick={() => void handleSubmit()} type="button">
            {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Upload />}
            {isSubmitting
              ? t("uploadDialog.submitting", { ns: "dashboard" })
              : t("uploadDialog.submit", { ns: "dashboard" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
