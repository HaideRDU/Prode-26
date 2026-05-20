/** Códigos API-Sports distintos de nuestro ISO-3 en Firestore */
const API_CODE_TO_ISO3: Record<string, string> = {
  // Ampliar si la API devuelve códigos distintos al seed FIFA
}

const ISO3_OVERRIDES_BY_API_TEAM_ID: Record<number, string> = {}

export function normalizeIso3(code: string | null | undefined): string | null {
  if (!code) return null
  const upper = code.trim().toUpperCase()
  if (!upper) return null
  return API_CODE_TO_ISO3[upper] ?? upper
}

export function iso3FromApiTeam(
  teamId: number,
  code: string | null | undefined,
): string | null {
  const override = ISO3_OVERRIDES_BY_API_TEAM_ID[teamId]
  if (override) return override
  return normalizeIso3(code)
}
