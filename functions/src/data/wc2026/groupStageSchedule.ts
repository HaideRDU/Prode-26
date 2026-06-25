/**
 * Fase de grupos — 72 partidos (12 grupos × 6).
 *
 * Fuente oficial de verdad deportiva (calendario / emparejamientos):
 * - FIFA Digital Hub — documento «FWC26 Match Schedule» (inglés), p. ej.:
 *   https://digitalhub.fifa.com/m/1be9ce37eb98fcc5/original/FWC26-Match-Schedule/_English.pdf
 * - Sorteo final: 5 de diciembre de 2025 (asignación de equipos a posiciones por grupo).
 *
 * Este archivo es una transcripción manual a datos versionados (no scraping de fifa.com).
 * Los `scheduledAt` son ISO 8601 UTC aproximados por slot; revisar horas locales exactas
 * en el PDF FIFA y ajustar en un PR si difieren.
 *
 * Códigos de equipo: ISO 3166-1 alpha-3 (FIFA), p. ej. MEX, RSA, KOR.
 */

export interface GroupStageMatchRow {
  /** ID estable en Firestore: convención wc26-{Grupo}-{número} */
  matchId: string
  groupId: string
  teamHomeId: string
  teamAwayId: string
  /** Inicio del partido (UTC) */
  scheduledAt: string
}

/**
 * Partidos de fase de grupos en orden por grupo (A→L) y dentro de cada grupo por fecha lógica.
 * Emparejamientos: posiciones 1–4 del sorteo FIFA; MD1 (1v2, 3v4), MD2 (1v3, 4v2), MD3 (1v4, 2v3).
 */
export const GROUP_STAGE_SCHEDULE: readonly GroupStageMatchRow[] = [
  // —— Group A ——
  { matchId: 'wc26-A-01', groupId: 'A', teamHomeId: 'MEX', teamAwayId: 'RSA', scheduledAt: '2026-06-11T19:00:00Z' },
  { matchId: 'wc26-A-02', groupId: 'A', teamHomeId: 'KOR', teamAwayId: 'CZE', scheduledAt: '2026-06-12T02:00:00Z' },
  { matchId: 'wc26-A-03', groupId: 'A', teamHomeId: 'CZE', teamAwayId: 'RSA', scheduledAt: '2026-06-18T16:00:00Z' },
  { matchId: 'wc26-A-04', groupId: 'A', teamHomeId: 'MEX', teamAwayId: 'KOR', scheduledAt: '2026-06-19T01:00:00Z' },
  { matchId: 'wc26-A-05', groupId: 'A', teamHomeId: 'MEX', teamAwayId: 'CZE', scheduledAt: '2026-06-25T01:00:00Z' },
  { matchId: 'wc26-A-06', groupId: 'A', teamHomeId: 'KOR', teamAwayId: 'RSA', scheduledAt: '2026-06-25T01:00:00Z' },
  // —— Group B ——
  { matchId: 'wc26-B-01', groupId: 'B', teamHomeId: 'CAN', teamAwayId: 'BIH', scheduledAt: '2026-06-12T19:00:00Z' },
  { matchId: 'wc26-B-02', groupId: 'B', teamHomeId: 'QAT', teamAwayId: 'SUI', scheduledAt: '2026-06-13T19:00:00Z' },
  { matchId: 'wc26-B-03', groupId: 'B', teamHomeId: 'CAN', teamAwayId: 'QAT', scheduledAt: '2026-06-18T22:00:00Z' },
  { matchId: 'wc26-B-04', groupId: 'B', teamHomeId: 'SUI', teamAwayId: 'BIH', scheduledAt: '2026-06-18T19:00:00Z' },
  { matchId: 'wc26-B-05', groupId: 'B', teamHomeId: 'CAN', teamAwayId: 'SUI', scheduledAt: '2026-06-24T19:00:00Z' },
  { matchId: 'wc26-B-06', groupId: 'B', teamHomeId: 'BIH', teamAwayId: 'QAT', scheduledAt: '2026-06-24T19:00:00Z' },
  // —— Group C ——
  { matchId: 'wc26-C-01', groupId: 'C', teamHomeId: 'BRA', teamAwayId: 'MAR', scheduledAt: '2026-06-13T22:00:00Z' },
  { matchId: 'wc26-C-02', groupId: 'C', teamHomeId: 'HAI', teamAwayId: 'SCO', scheduledAt: '2026-06-14T01:00:00Z' },
  { matchId: 'wc26-C-03', groupId: 'C', teamHomeId: 'BRA', teamAwayId: 'HAI', scheduledAt: '2026-06-20T00:30:00Z' },
  { matchId: 'wc26-C-04', groupId: 'C', teamHomeId: 'SCO', teamAwayId: 'MAR', scheduledAt: '2026-06-19T22:00:00Z' },
  { matchId: 'wc26-C-05', groupId: 'C', teamHomeId: 'BRA', teamAwayId: 'SCO', scheduledAt: '2026-06-24T22:00:00Z' },
  { matchId: 'wc26-C-06', groupId: 'C', teamHomeId: 'MAR', teamAwayId: 'HAI', scheduledAt: '2026-06-24T22:00:00Z' },
  // —— Group D ——
  { matchId: 'wc26-D-01', groupId: 'D', teamHomeId: 'USA', teamAwayId: 'PAR', scheduledAt: '2026-06-13T01:00:00Z' },
  { matchId: 'wc26-D-02', groupId: 'D', teamHomeId: 'AUS', teamAwayId: 'TUR', scheduledAt: '2026-06-14T04:00:00Z' },
  { matchId: 'wc26-D-03', groupId: 'D', teamHomeId: 'USA', teamAwayId: 'AUS', scheduledAt: '2026-06-19T19:00:00Z' },
  { matchId: 'wc26-D-04', groupId: 'D', teamHomeId: 'TUR', teamAwayId: 'PAR', scheduledAt: '2026-06-20T03:00:00Z' },
  { matchId: 'wc26-D-05', groupId: 'D', teamHomeId: 'USA', teamAwayId: 'TUR', scheduledAt: '2026-06-26T02:00:00Z' },
  { matchId: 'wc26-D-06', groupId: 'D', teamHomeId: 'PAR', teamAwayId: 'AUS', scheduledAt: '2026-06-26T02:00:00Z' },
  // —— Group E ——
  { matchId: 'wc26-E-01', groupId: 'E', teamHomeId: 'GER', teamAwayId: 'CUW', scheduledAt: '2026-06-14T17:00:00Z' },
  { matchId: 'wc26-E-02', groupId: 'E', teamHomeId: 'CIV', teamAwayId: 'ECU', scheduledAt: '2026-06-14T23:00:00Z' },
  { matchId: 'wc26-E-03', groupId: 'E', teamHomeId: 'GER', teamAwayId: 'CIV', scheduledAt: '2026-06-20T20:00:00Z' },
  { matchId: 'wc26-E-04', groupId: 'E', teamHomeId: 'ECU', teamAwayId: 'CUW', scheduledAt: '2026-06-21T00:00:00Z' },
  { matchId: 'wc26-E-05', groupId: 'E', teamHomeId: 'GER', teamAwayId: 'ECU', scheduledAt: '2026-06-25T20:00:00Z' },
  { matchId: 'wc26-E-06', groupId: 'E', teamHomeId: 'CUW', teamAwayId: 'CIV', scheduledAt: '2026-06-25T20:00:00Z' },
  // —— Group F ——
  { matchId: 'wc26-F-01', groupId: 'F', teamHomeId: 'NED', teamAwayId: 'JPN', scheduledAt: '2026-06-14T20:00:00Z' },
  { matchId: 'wc26-F-02', groupId: 'F', teamHomeId: 'SWE', teamAwayId: 'TUN', scheduledAt: '2026-06-15T02:00:00Z' },
  { matchId: 'wc26-F-03', groupId: 'F', teamHomeId: 'NED', teamAwayId: 'SWE', scheduledAt: '2026-06-20T17:00:00Z' },
  { matchId: 'wc26-F-04', groupId: 'F', teamHomeId: 'TUN', teamAwayId: 'JPN', scheduledAt: '2026-06-21T04:00:00Z' },
  { matchId: 'wc26-F-05', groupId: 'F', teamHomeId: 'NED', teamAwayId: 'TUN', scheduledAt: '2026-06-25T23:00:00Z' },
  { matchId: 'wc26-F-06', groupId: 'F', teamHomeId: 'JPN', teamAwayId: 'SWE', scheduledAt: '2026-06-25T23:00:00Z' },
  // —— Group G ——
  { matchId: 'wc26-G-01', groupId: 'G', teamHomeId: 'BEL', teamAwayId: 'EGY', scheduledAt: '2026-06-15T19:00:00Z' },
  { matchId: 'wc26-G-02', groupId: 'G', teamHomeId: 'IRN', teamAwayId: 'NZL', scheduledAt: '2026-06-16T01:00:00Z' },
  { matchId: 'wc26-G-03', groupId: 'G', teamHomeId: 'BEL', teamAwayId: 'IRN', scheduledAt: '2026-06-21T19:00:00Z' },
  { matchId: 'wc26-G-04', groupId: 'G', teamHomeId: 'NZL', teamAwayId: 'EGY', scheduledAt: '2026-06-22T01:00:00Z' },
  { matchId: 'wc26-G-05', groupId: 'G', teamHomeId: 'BEL', teamAwayId: 'NZL', scheduledAt: '2026-06-27T03:00:00Z' },
  { matchId: 'wc26-G-06', groupId: 'G', teamHomeId: 'EGY', teamAwayId: 'IRN', scheduledAt: '2026-06-27T03:00:00Z' },
  // —— Group H ——
  { matchId: 'wc26-H-01', groupId: 'H', teamHomeId: 'ESP', teamAwayId: 'CPV', scheduledAt: '2026-06-15T16:00:00Z' },
  { matchId: 'wc26-H-02', groupId: 'H', teamHomeId: 'KSA', teamAwayId: 'URU', scheduledAt: '2026-06-15T22:00:00Z' },
  { matchId: 'wc26-H-03', groupId: 'H', teamHomeId: 'ESP', teamAwayId: 'KSA', scheduledAt: '2026-06-21T16:00:00Z' },
  { matchId: 'wc26-H-04', groupId: 'H', teamHomeId: 'URU', teamAwayId: 'CPV', scheduledAt: '2026-06-21T22:00:00Z' },
  { matchId: 'wc26-H-05', groupId: 'H', teamHomeId: 'ESP', teamAwayId: 'URU', scheduledAt: '2026-06-27T00:00:00Z' },
  { matchId: 'wc26-H-06', groupId: 'H', teamHomeId: 'CPV', teamAwayId: 'KSA', scheduledAt: '2026-06-27T00:00:00Z' },
  // —— Group I ——
  { matchId: 'wc26-I-01', groupId: 'I', teamHomeId: 'FRA', teamAwayId: 'SEN', scheduledAt: '2026-06-16T19:00:00Z' },
  { matchId: 'wc26-I-02', groupId: 'I', teamHomeId: 'IRQ', teamAwayId: 'NOR', scheduledAt: '2026-06-16T22:00:00Z' },
  { matchId: 'wc26-I-03', groupId: 'I', teamHomeId: 'FRA', teamAwayId: 'IRQ', scheduledAt: '2026-06-22T21:00:00Z' },
  { matchId: 'wc26-I-04', groupId: 'I', teamHomeId: 'NOR', teamAwayId: 'SEN', scheduledAt: '2026-06-23T00:00:00Z' },
  { matchId: 'wc26-I-05', groupId: 'I', teamHomeId: 'FRA', teamAwayId: 'NOR', scheduledAt: '2026-06-26T19:00:00Z' },
  { matchId: 'wc26-I-06', groupId: 'I', teamHomeId: 'SEN', teamAwayId: 'IRQ', scheduledAt: '2026-06-26T19:00:00Z' },
  // —— Group J ——
  { matchId: 'wc26-J-01', groupId: 'J', teamHomeId: 'ARG', teamAwayId: 'ALG', scheduledAt: '2026-06-17T01:00:00Z' },
  { matchId: 'wc26-J-02', groupId: 'J', teamHomeId: 'AUT', teamAwayId: 'JOR', scheduledAt: '2026-06-17T04:00:00Z' },
  { matchId: 'wc26-J-03', groupId: 'J', teamHomeId: 'ARG', teamAwayId: 'AUT', scheduledAt: '2026-06-22T17:00:00Z' },
  { matchId: 'wc26-J-04', groupId: 'J', teamHomeId: 'JOR', teamAwayId: 'ALG', scheduledAt: '2026-06-23T03:00:00Z' },
  { matchId: 'wc26-J-05', groupId: 'J', teamHomeId: 'ARG', teamAwayId: 'JOR', scheduledAt: '2026-06-28T02:00:00Z' },
  { matchId: 'wc26-J-06', groupId: 'J', teamHomeId: 'ALG', teamAwayId: 'AUT', scheduledAt: '2026-06-28T02:00:00Z' },
  // —— Group K ——
  { matchId: 'wc26-K-01', groupId: 'K', teamHomeId: 'POR', teamAwayId: 'COD', scheduledAt: '2026-06-17T17:00:00Z' },
  { matchId: 'wc26-K-02', groupId: 'K', teamHomeId: 'UZB', teamAwayId: 'COL', scheduledAt: '2026-06-18T02:00:00Z' },
  { matchId: 'wc26-K-03', groupId: 'K', teamHomeId: 'POR', teamAwayId: 'UZB', scheduledAt: '2026-06-23T17:00:00Z' },
  { matchId: 'wc26-K-04', groupId: 'K', teamHomeId: 'COL', teamAwayId: 'COD', scheduledAt: '2026-06-24T02:00:00Z' },
  { matchId: 'wc26-K-05', groupId: 'K', teamHomeId: 'POR', teamAwayId: 'COL', scheduledAt: '2026-06-27T23:30:00Z' },
  { matchId: 'wc26-K-06', groupId: 'K', teamHomeId: 'COD', teamAwayId: 'UZB', scheduledAt: '2026-06-27T23:30:00Z' },
  // —— Group L ——
  { matchId: 'wc26-L-01', groupId: 'L', teamHomeId: 'ENG', teamAwayId: 'CRO', scheduledAt: '2026-06-17T20:00:00Z' },
  { matchId: 'wc26-L-02', groupId: 'L', teamHomeId: 'GHA', teamAwayId: 'PAN', scheduledAt: '2026-06-17T23:00:00Z' },
  { matchId: 'wc26-L-03', groupId: 'L', teamHomeId: 'ENG', teamAwayId: 'GHA', scheduledAt: '2026-06-23T20:00:00Z' },
  { matchId: 'wc26-L-04', groupId: 'L', teamHomeId: 'PAN', teamAwayId: 'CRO', scheduledAt: '2026-06-23T23:00:00Z' },
  { matchId: 'wc26-L-05', groupId: 'L', teamHomeId: 'ENG', teamAwayId: 'PAN', scheduledAt: '2026-06-27T21:00:00Z' },
  { matchId: 'wc26-L-06', groupId: 'L', teamHomeId: 'CRO', teamAwayId: 'GHA', scheduledAt: '2026-06-27T21:00:00Z' },
] as const

export const GROUP_STAGE_MATCH_COUNT = GROUP_STAGE_SCHEDULE.length
