const GOOGLE_MEET_HOSTNAME = "meet.google.com";
const GOOGLE_MEET_ID_PATTERN = /^\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:\/|$)/i;

export function isGoogleMeetUrl(url: string): boolean {
  try {
    const candidate = new URL(url);
    return (
      candidate.protocol === "https:" &&
      candidate.hostname === GOOGLE_MEET_HOSTNAME
    );
  } catch {
    return false;
  }
}

export function extractGoogleMeetId(url: string): string | null {
  if (!isGoogleMeetUrl(url)) {
    return null;
  }

  try {
    const candidate = new URL(url);
    const match = GOOGLE_MEET_ID_PATTERN.exec(candidate.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
