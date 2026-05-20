/** Selecciones a importar vía API-Football (plan Free, search + squads). */
export interface ApiSportsRosterTarget {
  teamId: string
  nameEs: string
  searchName: string
}

export const API_SPORTS_ROSTER_TARGETS: readonly ApiSportsRosterTarget[] = [
  { teamId: 'FRA', nameEs: 'Francia', searchName: 'France' },
  { teamId: 'BRA', nameEs: 'Brasil', searchName: 'Brazil' },
  { teamId: 'SUI', nameEs: 'Suiza', searchName: 'Switzerland' },
  { teamId: 'CIV', nameEs: 'Costa de Marfil', searchName: 'Ivory Coast' },
  { teamId: 'KOR', nameEs: 'Corea del Sur', searchName: 'South Korea' },
  { teamId: 'NZL', nameEs: 'Nueva Zelanda', searchName: 'New Zealand' },
] as const

export const MIN_API_ROSTER_SIZE = 5
