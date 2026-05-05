export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  DASHBOARD_MEETING_DETAIL: "/dashboard/meetings/:meetingId",
  EXTENSION_BRIDGE: "/extension-bridge",
}

export function buildMeetingDetailRoute(meetingId: string) {
  return `/dashboard/meetings/${meetingId}`
}
