import i18n from "@/i18n"

function getCurrentLocale() {
  return i18n.resolvedLanguage ?? i18n.language ?? undefined
}

function formatWithOptions(
  value: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat(getCurrentLocale(), options).format(
    new Date(value)
  )
}

export function formatMeetingDate(isoDateTime: string) {
  return formatWithOptions(isoDateTime, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function formatMeetingTime(isoDateTime: string) {
  return formatWithOptions(isoDateTime, {
    timeStyle: "short",
  })
}

export function formatMeetingDateTime(isoDateTime: string) {
  return formatWithOptions(isoDateTime, {
    dateStyle: "medium",
    timeStyle: "medium",
  })
}

export function formatMeetingTimeline(
  startIsoDateTime: string,
  durationMs: number
) {
  const startDate = new Date(startIsoDateTime)
  const endDate = new Date(startDate.getTime() + durationMs)
  const formatter = new Intl.DateTimeFormat(getCurrentLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`
  }

  return `${seconds}s`
}

export function formatSegmentTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  const fractional = Math.round((seconds % 1) * 10)

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}.${fractional}`
}

export function formatSegmentRange(startTime: number, endTime: number) {
  return `${formatSegmentTime(startTime)} - ${formatSegmentTime(endTime)}`
}
