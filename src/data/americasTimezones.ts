export type AmericasRegion = 'north' | 'central' | 'south'

export type AmericasTimeZoneOption = {
  id: string
  labelEs: string
}

export type AmericasRegionGroup = {
  id: AmericasRegion
  labelEs: string
  zones: AmericasTimeZoneOption[]
}

export const DEFAULT_USER_TIME_ZONE = 'America/Bogota'

export const AMERICAS_TIMEZONE_GROUPS: AmericasRegionGroup[] = [
  {
    id: 'north',
    labelEs: 'América del Norte',
    zones: [
      { id: 'America/New_York', labelEs: 'Nueva York / Este (EE. UU.)' },
      { id: 'America/Chicago', labelEs: 'Chicago / Centro (EE. UU.)' },
      { id: 'America/Denver', labelEs: 'Denver / Montaña (EE. UU.)' },
      { id: 'America/Phoenix', labelEs: 'Phoenix (sin horario de verano)' },
      { id: 'America/Los_Angeles', labelEs: 'Los Ángeles / Pacífico (EE. UU.)' },
      { id: 'America/Toronto', labelEs: 'Toronto / Canadá' },
    ],
  },
  {
    id: 'central',
    labelEs: 'América Central y Caribe',
    zones: [
      { id: 'America/Mexico_City', labelEs: 'Ciudad de México' },
      { id: 'America/Guatemala', labelEs: 'Guatemala' },
      { id: 'America/Costa_Rica', labelEs: 'Costa Rica' },
      { id: 'America/Panama', labelEs: 'Panamá' },
      { id: 'America/Bogota', labelEs: 'Bogotá / Colombia' },
      { id: 'America/Havana', labelEs: 'La Habana / Cuba' },
    ],
  },
  {
    id: 'south',
    labelEs: 'América del Sur',
    zones: [
      { id: 'America/Lima', labelEs: 'Lima / Perú' },
      { id: 'America/Caracas', labelEs: 'Caracas / Venezuela' },
      { id: 'America/Santiago', labelEs: 'Santiago / Chile' },
      { id: 'America/Buenos_Aires', labelEs: 'Buenos Aires / Argentina' },
      { id: 'America/Montevideo', labelEs: 'Montevideo / Uruguay' },
      { id: 'America/Sao_Paulo', labelEs: 'São Paulo / Brasil' },
    ],
  },
]

const ALLOWED_SET = new Set(
  AMERICAS_TIMEZONE_GROUPS.flatMap((g) => g.zones.map((z) => z.id)),
)

export function isAllowedAmericasTimeZone(tz: string): boolean {
  return ALLOWED_SET.has(tz)
}

export function getRegionForTimeZone(timeZone: string): AmericasRegion {
  for (const group of AMERICAS_TIMEZONE_GROUPS) {
    if (group.zones.some((z) => z.id === timeZone)) return group.id
  }
  return 'central'
}

export function getZonesForRegion(region: AmericasRegion): AmericasTimeZoneOption[] {
  return AMERICAS_TIMEZONE_GROUPS.find((g) => g.id === region)?.zones ?? []
}

export function getTimeZoneLabel(timeZone: string): string {
  for (const group of AMERICAS_TIMEZONE_GROUPS) {
    const found = group.zones.find((z) => z.id === timeZone)
    if (found) return found.labelEs
  }
  return timeZone
}

export function guessTimeZoneFromBrowser(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (resolved && isAllowedAmericasTimeZone(resolved)) return resolved
  } catch {
    /* ignore */
  }
  return DEFAULT_USER_TIME_ZONE
}

export function normalizeAmericasTimeZone(
  timeZone: string | null | undefined,
  fallbackRegion?: AmericasRegion,
): string {
  if (timeZone && isAllowedAmericasTimeZone(timeZone)) return timeZone
  const region = fallbackRegion ?? 'central'
  return getZonesForRegion(region)[0]?.id ?? DEFAULT_USER_TIME_ZONE
}
