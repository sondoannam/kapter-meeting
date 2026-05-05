import * as React from "react"
import { useAuth } from "@clerk/react-router"

import {
  clearProjectNotionDestination,
  configureProjectNotionDestination,
  createNotionAuthorizationUrl,
  fetchNotionConnection,
  searchNotionPages,
} from "../api/notion-api"
import { createProject, fetchProjects } from "../api/projects-api"
import type {
  ConfigureProjectNotionDestinationInput,
  CreateProjectInput,
  DashboardProjectSummary,
  NotionConnectionStatus,
  NotionPageSearchResult,
  ProjectsRequestStatus,
} from "../types"

function upsertProject(
  currentProjects: DashboardProjectSummary[],
  nextProject: DashboardProjectSummary
) {
  const remainingProjects = currentProjects.filter(
    (project) => project.id !== nextProject.id
  )

  return [nextProject, ...remainingProjects]
}

export function useProjects() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [projects, setProjects] = React.useState<DashboardProjectSummary[]>([])
  const [status, setStatus] = React.useState<ProjectsRequestStatus>("loading")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [notionConnection, setNotionConnection] =
    React.useState<NotionConnectionStatus | null>(null)
  const [notionStatus, setNotionStatus] =
    React.useState<ProjectsRequestStatus>("loading")
  const [notionErrorMessage, setNotionErrorMessage] = React.useState<
    string | null
  >(null)
  const [isConnectingNotion, setIsConnectingNotion] = React.useState(false)
  const [activeNotionProjectId, setActiveNotionProjectId] = React.useState<
    string | null
  >(null)
  const authErrorMessage =
    isLoaded && !isSignedIn
      ? "Clerk session is not available for project data."
      : null

  const refresh = React.useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    try {
      setStatus((currentStatus) =>
        currentStatus === "ready" ? currentStatus : "loading"
      )
      setErrorMessage(null)

      const sessionToken = await getToken()

      if (!sessionToken) {
        throw new Error("Unable to mint a Clerk session token for projects.")
      }

      const response = await fetchProjects(sessionToken)

      setProjects(response.projects)
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load projects."
      )
    }
  }, [getToken, isLoaded, isSignedIn])

  const refreshNotionConnection = React.useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    try {
      setNotionStatus((currentStatus) =>
        currentStatus === "ready" ? currentStatus : "loading"
      )
      setNotionErrorMessage(null)

      const sessionToken = await getToken()

      if (!sessionToken) {
        throw new Error(
          "Unable to mint a Clerk session token for the Notion connection."
        )
      }

      const response = await fetchNotionConnection(sessionToken)

      setNotionConnection(response.notion)
      setNotionStatus("ready")
    } catch (error) {
      setNotionStatus("error")
      setNotionErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the Notion connection status."
      )
    }
  }, [getToken, isLoaded, isSignedIn])

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    let isCancelled = false

    const run = async () => {
      if (isCancelled) {
        return
      }

      await Promise.all([refresh(), refreshNotionConnection()])
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [isLoaded, isSignedIn, refresh, refreshNotionConnection])

  const submitProject = React.useCallback(
    async (input: CreateProjectInput) => {
      if (!isLoaded || !isSignedIn) {
        throw new Error("Clerk session is not available for project creation.")
      }

      setIsCreating(true)
      setErrorMessage(null)

      try {
        const sessionToken = await getToken()

        if (!sessionToken) {
          throw new Error(
            "Unable to mint a Clerk session token for project creation."
          )
        }

        const response = await createProject(sessionToken, input)
        const nextProject = response.project

        setProjects((currentProjects) =>
          upsertProject(currentProjects, nextProject)
        )
        setStatus("ready")

        return nextProject
      } catch (error) {
        const nextError =
          error instanceof Error
            ? error.message
            : "Unable to create the project."

        setStatus("error")
        setErrorMessage(nextError)
        throw new Error(nextError)
      } finally {
        setIsCreating(false)
      }
    },
    [getToken, isLoaded, isSignedIn]
  )

  const connectNotion = React.useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      throw new Error(
        "Clerk session is not available for the Notion authorization flow."
      )
    }

    setIsConnectingNotion(true)
    setNotionErrorMessage(null)

    try {
      const sessionToken = await getToken()

      if (!sessionToken) {
        throw new Error(
          "Unable to mint a Clerk session token for the Notion authorization flow."
        )
      }

      const response = await createNotionAuthorizationUrl(sessionToken)

      window.location.assign(response.authUrl)
    } catch (error) {
      const nextError =
        error instanceof Error
          ? error.message
          : "Unable to start the Notion authorization flow."

      setNotionStatus("error")
      setNotionErrorMessage(nextError)
      throw new Error(nextError)
    } finally {
      setIsConnectingNotion(false)
    }
  }, [getToken, isLoaded, isSignedIn])

  const searchSharedNotionPages = React.useCallback(
    async (query: string): Promise<NotionPageSearchResult[]> => {
      if (!isLoaded || !isSignedIn) {
        throw new Error("Clerk session is not available for Notion search.")
      }

      const sessionToken = await getToken()

      if (!sessionToken) {
        throw new Error(
          "Unable to mint a Clerk session token for Notion search."
        )
      }

      const response = await searchNotionPages(sessionToken, query)

      return response.pages
    },
    [getToken, isLoaded, isSignedIn]
  )

  const saveProjectNotionDestination = React.useCallback(
    async (
      projectId: string,
      input: ConfigureProjectNotionDestinationInput
    ) => {
      if (!isLoaded || !isSignedIn) {
        throw new Error(
          "Clerk session is not available for project destination updates."
        )
      }

      setActiveNotionProjectId(projectId)
      setNotionErrorMessage(null)

      try {
        const sessionToken = await getToken()

        if (!sessionToken) {
          throw new Error(
            "Unable to mint a Clerk session token for project destination updates."
          )
        }

        const response = await configureProjectNotionDestination(
          sessionToken,
          projectId,
          input
        )
        const nextProject = response.project

        setProjects((currentProjects) =>
          upsertProject(currentProjects, nextProject)
        )

        return nextProject
      } catch (error) {
        const nextError =
          error instanceof Error
            ? error.message
            : "Unable to save the Notion destination for this project."

        setNotionStatus("error")
        setNotionErrorMessage(nextError)
        throw new Error(nextError)
      } finally {
        setActiveNotionProjectId(null)
      }
    },
    [getToken, isLoaded, isSignedIn]
  )

  const resetProjectNotionDestination = React.useCallback(
    async (projectId: string) => {
      if (!isLoaded || !isSignedIn) {
        throw new Error(
          "Clerk session is not available for project destination updates."
        )
      }

      setActiveNotionProjectId(projectId)
      setNotionErrorMessage(null)

      try {
        const sessionToken = await getToken()

        if (!sessionToken) {
          throw new Error(
            "Unable to mint a Clerk session token for project destination updates."
          )
        }

        const response = await clearProjectNotionDestination(
          sessionToken,
          projectId
        )
        const nextProject = response.project

        setProjects((currentProjects) =>
          upsertProject(currentProjects, nextProject)
        )

        return nextProject
      } catch (error) {
        const nextError =
          error instanceof Error
            ? error.message
            : "Unable to clear the Notion destination for this project."

        setNotionStatus("error")
        setNotionErrorMessage(nextError)
        throw new Error(nextError)
      } finally {
        setActiveNotionProjectId(null)
      }
    },
    [getToken, isLoaded, isSignedIn]
  )

  return {
    projects,
    status: authErrorMessage ? "error" : status,
    errorMessage: authErrorMessage || errorMessage,
    isCreating,
    refresh,
    createProject: submitProject,
    notionConnection,
    notionStatus,
    notionErrorMessage,
    isConnectingNotion,
    activeNotionProjectId,
    refreshNotionConnection,
    connectNotion,
    searchNotionPages: searchSharedNotionPages,
    configureProjectNotionDestination: saveProjectNotionDestination,
    clearProjectNotionDestination: resetProjectNotionDestination,
  }
}
