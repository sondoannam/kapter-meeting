import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function scrollToSection(sectionId: string): void {
  const section = document.getElementById(sectionId)

  if (!section) {
    console.warn(`Section with id "${sectionId}" not found.`)
    return
  }

  section.scrollIntoView({
    behavior: "smooth",
    block: "start",
  })
}
