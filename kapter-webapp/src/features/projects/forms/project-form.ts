import { z } from "zod"

import type { DashboardProjectDetail, UpdateProjectInput } from "../types"

const baseProjectFormSchema = z.object({
  title: z.string(),
  description: z.string().max(800),
  contextMarkdown: z.string().max(8000),
})

export type ProjectFormValues = z.infer<typeof baseProjectFormSchema>

export const emptyProjectFormValues: ProjectFormValues = {
  title: "",
  description: "",
  contextMarkdown: "",
}

export const buildProjectFormSchema = (titleRequiredMessage: string) =>
  baseProjectFormSchema.extend({
    title: z.string().trim().min(1, titleRequiredMessage).max(120),
  })

export const mapProjectDetailToFormValues = (
  project: DashboardProjectDetail
): ProjectFormValues => ({
  title: project.title,
  description: project.description ?? project.context?.initialDescription ?? "",
  contextMarkdown: project.context?.contextMarkdown ?? "",
})

export const toProjectMutationInput = (
  values: ProjectFormValues
): UpdateProjectInput => ({
  title: values.title.trim(),
  description: values.description,
  initialDescription: values.description,
  contextMarkdown: values.contextMarkdown,
})
