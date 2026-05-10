export const ROUTES = {
  HOME: "/",
  PRICING: "/pricing",
  DASHBOARD: "/dashboard",
  DASHBOARD_PRICING: "/dashboard/pricing",
  DASHBOARD_MEETING_DETAIL: "/dashboard/meetings/:meetingId",
  EXTENSION_BRIDGE: "/extension-bridge",
}

export function buildMeetingDetailRoute(meetingId: string) {
  return `/dashboard/meetings/${meetingId}`
}
