import * as React from "react"

import { cn } from "@/lib/utils"

interface AppShellContainerProps extends React.ComponentProps<"div"> {
  width?: "default" | "narrow" | "full"
}

const widthClasses: Record<
  NonNullable<AppShellContainerProps["width"]>,
  string
> = {
  default: "max-w-[min(80rem,100vw-2rem)]",
  narrow: "max-w-[min(72rem,100vw-2rem)]",
  full: "max-w-full",
}

export function AppShellContainer({
  className,
  width = "default",
  ...props
}: AppShellContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        widthClasses[width],
        className
      )}
      {...props}
    />
  )
}
