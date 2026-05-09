import { z } from "zod"

import type {
  DashboardMeetingDetail,
  SaveMeetingReviewRequest,
  UpdateMeetingMetadataRequest,
} from "../types"

export const actionItemStatuses = ["TODO", "IN_PROGRESS", "DONE"] as const

const localDatePattern = /^\d{4}-\d{2}-\d{2}$/

const baseMeetingMetadataFormSchema = z.object({
  title: z.string(),
  externalMeetingId: z.string().max(160),
  projectId: z.string(),
})

const baseMeetingReviewActionItemSchema = z.object({
  taskContent: z.string().max(2000),
  deadline: z
    .string()
    .regex(localDatePattern, "Invalid date")
    .or(z.literal("")),
  assigneeId: z.string(),
  status: z.enum(actionItemStatuses),
})

const baseMeetingReviewFormSchema = z.object({
  summary: z.string(),
  actionItems: z.array(baseMeetingReviewActionItemSchema),
})

export type MeetingMetadataFormValues = z.infer<
  typeof baseMeetingMetadataFormSchema
>

export type MeetingReviewActionItemFormValues = z.infer<
  typeof baseMeetingReviewActionItemSchema
>

export type MeetingReviewFormValues = z.infer<
  typeof baseMeetingReviewFormSchema
>

export const UNASSIGNED_ASSIGNEE_VALUE = "__unassigned__"

export const buildMeetingMetadataFormSchema = (titleRequiredMessage: string) =>
  baseMeetingMetadataFormSchema.extend({
    title: z.string().trim().min(1, titleRequiredMessage).max(160),
  })

export const buildMeetingReviewFormSchema = (summaryRequiredMessage: string) =>
  baseMeetingReviewFormSchema.extend({
    summary: z.string().trim().min(1, summaryRequiredMessage),
  })

export const mapMeetingMetadataToFormValues = (
  meeting: DashboardMeetingDetail
): MeetingMetadataFormValues => ({
  title: meeting.title,
  externalMeetingId: meeting.externalMeetingId ?? "",
  projectId: meeting.projectId ?? "",
})

export const createEmptyReviewActionItem =
  (): MeetingReviewActionItemFormValues => ({
    taskContent: "",
    deadline: "",
    assigneeId: "",
    status: "TODO",
  })

export const mapMeetingReviewToFormValues = (
  meeting: DashboardMeetingDetail
): MeetingReviewFormValues => ({
  summary: meeting.summary ?? "",
  actionItems: meeting.actionItems.map((actionItem) => ({
    taskContent: actionItem.taskContent,
    deadline: toDateInputValue(actionItem.deadline),
    assigneeId: actionItem.assigneeId ?? "",
    status: actionItem.status,
  })),
})

export const toMeetingMetadataPayload = (
  values: MeetingMetadataFormValues,
  canReassignProject: boolean
): UpdateMeetingMetadataRequest => {
  const payload: UpdateMeetingMetadataRequest = {
    title: values.title.trim(),
    externalMeetingId: values.externalMeetingId.trim(),
  }

  if (canReassignProject && values.projectId) {
    payload.projectId = values.projectId
  }

  return payload
}

export const buildMeetingReviewPayload = (
  values: MeetingReviewFormValues
): SaveMeetingReviewRequest => ({
  summary: values.summary.trim(),
  actionItems: values.actionItems
    .map((task) => ({
      taskContent: task.taskContent.trim(),
      deadline: task.deadline ? `${task.deadline}T00:00:00.000Z` : null,
      assigneeId: task.assigneeId || null,
      status: task.status,
    }))
    .filter((task) => task.taskContent.length > 0),
})

export const toDateInputValue = (value: string | null): string =>
  value ? value.slice(0, 10) : ""

export const toLocalDateValue = (value: Date) => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, "0")
  const day = `${value.getDate()}`.padStart(2, "0")

  return `${year}-${month}-${day}`
}

export const fromLocalDateValue = (value: string) =>
  value ? new Date(`${value}T00:00:00`) : undefined
