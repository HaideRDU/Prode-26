/**
 * Selecciones por grupo — Mundial 2026, fase de grupos.
 * Alineado con sorteo / calendario FIFA y con `groupStageSchedule.ts` (mismos ISO-3).
 */

export interface Wc2026TeamRow {
  /** Documento Firestore teams/{teamId} — ISO 3166-1 alpha-3 (FIFA) */
  teamId: string
  groupId: string
  nameEs: string
}

export const WC2026_TEAMS_BY_GROUP: readonly Wc2026TeamRow[] = [
  { teamId: 'MEX', groupId: 'A', nameEs: 'México' },
  { teamId: 'RSA', groupId: 'A', nameEs: 'Sudáfrica' },
  { teamId: 'KOR', groupId: 'A', nameEs: 'Corea del Sur' },
  { teamId: 'CZE', groupId: 'A', nameEs: 'Chequia' },

  { teamId: 'CAN', groupId: 'B', nameEs: 'Canadá' },
  { teamId: 'BIH', groupId: 'B', nameEs: 'Bosnia y Herzegovina' },
  { teamId: 'QAT', groupId: 'B', nameEs: 'Catar' },
  { teamId: 'SUI', groupId: 'B', nameEs: 'Suiza' },

  { teamId: 'BRA', groupId: 'C', nameEs: 'Brasil' },
  { teamId: 'MAR', groupId: 'C', nameEs: 'Marruecos' },
  { teamId: 'HAI', groupId: 'C', nameEs: 'Haití' },
  { teamId: 'SCO', groupId: 'C', nameEs: 'Escocia' },

  { teamId: 'USA', groupId: 'D', nameEs: 'EE. UU.' },
  { teamId: 'PAR', groupId: 'D', nameEs: 'Paraguay' },
  { teamId: 'AUS', groupId: 'D', nameEs: 'Australia' },
  { teamId: 'TUR', groupId: 'D', nameEs: 'Turquía' },

  { teamId: 'GER', groupId: 'E', nameEs: 'Alemania' },
  { teamId: 'CUW', groupId: 'E', nameEs: 'Curazao' },
  { teamId: 'CIV', groupId: 'E', nameEs: 'Costa de Marfil' },
  { teamId: 'ECU', groupId: 'E', nameEs: 'Ecuador' },

  { teamId: 'NED', groupId: 'F', nameEs: 'Países Bajos' },
  { teamId: 'JPN', groupId: 'F', nameEs: 'Japón' },
  { teamId: 'SWE', groupId: 'F', nameEs: 'Suecia' },
  { teamId: 'TUN', groupId: 'F', nameEs: 'Túnez' },

  { teamId: 'BEL', groupId: 'G', nameEs: 'Bélgica' },
  { teamId: 'EGY', groupId: 'G', nameEs: 'Egipto' },
  { teamId: 'IRN', groupId: 'G', nameEs: 'Irán' },
  { teamId: 'NZL', groupId: 'G', nameEs: 'Nueva Zelanda' },

  { teamId: 'ESP', groupId: 'H', nameEs: 'España' },
  { teamId: 'CPV', groupId: 'H', nameEs: 'Cabo Verde' },
  { teamId: 'KSA', groupId: 'H', nameEs: 'Arabia Saudí' },
  { teamId: 'URU', groupId: 'H', nameEs: 'Uruguay' },

  { teamId: 'FRA', groupId: 'I', nameEs: 'Francia' },
  { teamId: 'SEN', groupId: 'I', nameEs: 'Senegal' },
  { teamId: 'IRQ', groupId: 'I', nameEs: 'Irak' },
  { teamId: 'NOR', groupId: 'I', nameEs: 'Noruega' },

  { teamId: 'ARG', groupId: 'J', nameEs: 'Argentina' },
  { teamId: 'ALG', groupId: 'J', nameEs: 'Argelia' },
  { teamId: 'AUT', groupId: 'J', nameEs: 'Austria' },
  { teamId: 'JOR', groupId: 'J', nameEs: 'Jordania' },

  { teamId: 'POR', groupId: 'K', nameEs: 'Portugal' },
  { teamId: 'COD', groupId: 'K', nameEs: 'RD del Congo' },
  { teamId: 'UZB', groupId: 'K', nameEs: 'Uzbekistán' },
  { teamId: 'COL', groupId: 'K', nameEs: 'Colombia' },

  { teamId: 'ENG', groupId: 'L', nameEs: 'Inglaterra' },
  { teamId: 'CRO', groupId: 'L', nameEs: 'Croacia' },
  { teamId: 'GHA', groupId: 'L', nameEs: 'Ghana' },
  { teamId: 'PAN', groupId: 'L', nameEs: 'Panamá' },
] as const

export const WC2026_TEAM_COUNT = WC2026_TEAMS_BY_GROUP.length
