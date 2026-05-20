/** True when a stored label is missing or is the Firebase uid placeholder. */
export function isUidPlaceholder(name: string | undefined, userId: string): boolean {
  const s = name?.trim()
  if (!s) return true
  return s === userId
}

/** Pick the best human-readable label for a player in a room. */
export function resolvePlayerLabel(
  userId: string,
  sources: {
    standingsDisplayName?: string
    memberDisplayName?: string
    username?: string
    email?: string
  },
): string {
  const emailLocal = sources.email?.split('@')[0]?.trim()
  const candidates = [
    sources.memberDisplayName,
    sources.standingsDisplayName,
    sources.username,
    emailLocal,
  ]
  for (const c of candidates) {
    const s = c?.trim()
    if (s && !isUidPlaceholder(s, userId)) return s
  }
  return userId
}
