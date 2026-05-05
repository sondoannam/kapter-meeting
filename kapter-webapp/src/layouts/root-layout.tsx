import { ClerkProvider } from "@clerk/react-router"
import { Outlet } from "react-router"

import { TooltipProvider } from "@/components/ui/tooltip"
import { SilentExtensionBridge } from "@/components/auth/silent-extension-bridge"

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <TooltipProvider>
        <SilentExtensionBridge />
        <Outlet />
      </TooltipProvider>
    </ClerkProvider>
  )
}
