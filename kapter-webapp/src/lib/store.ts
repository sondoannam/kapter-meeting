import { create } from "zustand"

type Theme = "light" | "dark"

interface AppState {
  theme: Theme
  setTheme: (theme: Theme) => void
  activeProject: string
  setActiveProject: (projectId: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: (localStorage.getItem("theme") as Theme) || "light",
  setTheme: (theme) => {
    localStorage.setItem("theme", theme)
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    set({ theme })
  },
  activeProject: "all",
  setActiveProject: (projectId) => set({ activeProject: projectId }),
}))
