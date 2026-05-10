import { createBrowserRouter } from "react-router"

import DashboardLayout from "@/layouts/dashboard-layout"
import LandingLayout from "@/layouts/landing-layout"
import RootLayout from "@/layouts/root-layout"
import { Landing } from "@/pages/landing"
import { PricingPage } from "@/pages/pricing"
import Dashboard from "@/pages/dashboard"
import MeetingDetailPage from "@/pages/meeting-detail"
import ExtensionBridgePage from "@/pages/extension-bridge"

import { ROUTES } from "./routes.constants"

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { 
        element: <LandingLayout />,
        children: [
          { path: ROUTES.HOME, element: <Landing /> },
          { path: ROUTES.PRICING, element: <PricingPage /> },
        ]
      },
      {
        element: <DashboardLayout />,
        children: [
          {
            path: ROUTES.DASHBOARD,
            element: <Dashboard />,
          },
          {
            path: ROUTES.DASHBOARD_PRICING,
            element: <PricingPage />,
          },
          {
            path: ROUTES.DASHBOARD_MEETING_DETAIL,
            element: <MeetingDetailPage />,
          },
        ],
      },
      {
        path: ROUTES.EXTENSION_BRIDGE,
        element: <ExtensionBridgePage />,
      },
    ],
  },
])
