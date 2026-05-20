import type { TsdbPlayerItem } from './types'
import { ISO3_TO_TSDB_SEARCH_NAME } from './teamSearchNames'

const EXCLUDED_STATUS = new Set(['coaching', 'staff', 'retired', 'inactive'])

/** Alias extra por ISO-3 para validar strTeam en lookup_all_players */
const ISO3_TEAM_NAME_ALIASES: Readonly<Record<string, readonly string[]>> = {
  KOR: ['South Korea', 'Korea Republic', 'Korea'],
  USA: ['USA', 'United States'],
  CIV: ['Ivory Coast', "Cote D'Ivoire"],
  COD: ['DR Congo', 'Congo DR', 'Democratic Republic of the Congo'],
  CUW: ['Curaçao', 'Curacao'],
  KSA: ['Saudi Arabia'],
  BIH: ['Bosnia-Herzegovina', 'Bosnia and Herzegovina'],
}

/** Jugadores de plantel (excluye cuerpo técnico y estados no jugables). */
export function filterRosterPlayers(players: TsdbPlayerItem[]): TsdbPlayerItem[] {
  return players.filter((p) => {
    if (!p.idPlayer || !p.strPlayer?.trim()) return false
    const status = (p.strStatus ?? '').trim().toLowerCase()
    if (status && EXCLUDED_STATUS.has(status)) return false
    const sport = (p.strSport ?? 'soccer').toLowerCase()
    if (sport !== 'soccer') return false
    return true
  })
}

export function expectedTeamNamesForIso3(iso3: string): string[] {
  const base = ISO3_TO_TSDB_SEARCH_NAME[iso3]
  const aliases = ISO3_TEAM_NAME_ALIASES[iso3] ?? []
  return [...new Set([base, ...aliases].filter((x): x is string => Boolean(x)))]
}

/**
 * Comprueba que el plantel devuelto por TSDB corresponde a la selección (strTeam).
 * Evita importar datos de otro equipo cuando idTeam es incorrecto.
 */
export function rosterBelongsToTeam(players: TsdbPlayerItem[], iso3: string): boolean {
  if (players.length === 0) return false
  const needles = expectedTeamNamesForIso3(iso3).map((n) => n.toLowerCase())
  if (needles.length === 0) return true

  const sample = players.slice(0, Math.min(8, players.length))
  let matches = 0
  for (const p of sample) {
    const team = (p.strTeam ?? '').toLowerCase()
    if (needles.some((n) => team.includes(n) || n.includes(team))) matches += 1
  }
  return matches >= Math.ceil(sample.length * 0.5)
}
