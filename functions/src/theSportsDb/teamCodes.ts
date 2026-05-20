/**
 * Mapeos TheSportsDB ↔ ISO-3 FIFA (código interno de Firestore).
 * Fuentes: respuesta real de /eventsseason.php?id=4429&s=2026
 */

/** Nombre en inglés (TheSportsDB) → ISO-3 (Firestore) */
export const TSDB_NAME_TO_ISO3: Readonly<Record<string, string>> = {
  // Grupo A
  Mexico: 'MEX',
  'South Africa': 'RSA',
  'South Korea': 'KOR',
  'Czech Republic': 'CZE',
  // Grupo B
  Canada: 'CAN',
  'Bosnia-Herzegovina': 'BIH',
  'Bosnia and Herzegovina': 'BIH',
  Qatar: 'QAT',
  Switzerland: 'SUI',
  // Grupo C
  Brazil: 'BRA',
  Morocco: 'MAR',
  Haiti: 'HAI',
  Scotland: 'SCO',
  // Grupo D
  USA: 'USA',
  Paraguay: 'PAR',
  Australia: 'AUS',
  Turkey: 'TUR',
  // Grupo E
  Germany: 'GER',
  'Curaçao': 'CUW',
  Curacao: 'CUW',
  'Ivory Coast': 'CIV',
  "Cote D'Ivoire": 'CIV',
  Ecuador: 'ECU',
  // Grupo F
  Netherlands: 'NED',
  Japan: 'JPN',
  Sweden: 'SWE',
  Tunisia: 'TUN',
  // Grupo G
  Belgium: 'BEL',
  Egypt: 'EGY',
  Iran: 'IRN',
  'New Zealand': 'NZL',
  // Grupo H
  Spain: 'ESP',
  'Cape Verde': 'CPV',
  'Saudi Arabia': 'KSA',
  Uruguay: 'URU',
  // Grupo I
  France: 'FRA',
  Senegal: 'SEN',
  Iraq: 'IRQ',
  Norway: 'NOR',
  // Grupo J
  Argentina: 'ARG',
  Algeria: 'ALG',
  Austria: 'AUT',
  Jordan: 'JOR',
  // Grupo K
  Portugal: 'POR',
  'DR Congo': 'COD',
  'Congo DR': 'COD',
  'Democratic Republic of the Congo': 'COD',
  Uzbekistan: 'UZB',
  Colombia: 'COL',
  // Grupo L
  England: 'ENG',
  Croatia: 'CRO',
  Ghana: 'GHA',
  Panama: 'PAN',
}

/**
 * TheSportsDB idTeam → ISO-3 (48 selecciones WC 2026).
 * Fuentes: eventsseason.php + eventsday.php (liga 4429) y páginas de selección en TSDB.
 */
export const TSDB_ID_TO_ISO3: Readonly<Record<string, string>> = {
  // Grupo A
  '134497': 'MEX',
  '136482': 'RSA',
  '134517': 'KOR',
  '133904': 'CZE',
  // Grupo B
  '140073': 'CAN',
  '134510': 'BIH',
  '136472': 'QAT',
  '134506': 'SUI',
  // Grupo C
  '134496': 'BRA',
  '136139': 'MAR',
  '140175': 'HAI',
  '136450': 'SCO',
  // Grupo D
  '134514': 'USA',
  '136471': 'PAR',
  '134500': 'AUS',
  '135985': 'TUR',
  // Grupo E
  '133907': 'GER',
  '140271': 'CUW',
  '134502': 'CIV',
  '134507': 'ECU',
  // Grupo F
  '133905': 'NED',
  '134503': 'JPN',
  '133916': 'SWE',
  '136142': 'TUN',
  // Grupo G
  '134515': 'BEL',
  '136138': 'EGY',
  '134511': 'IRN',
  '137449': 'NZL',
  // Grupo H
  '133909': 'ESP',
  '136477': 'CPV',
  '136137': 'KSA',
  '134504': 'URU',
  // Grupo I
  '133913': 'FRA',
  '136143': 'SEN',
  '140148': 'IRQ',
  '136516': 'NOR',
  // Grupo J
  '134509': 'ARG',
  '134516': 'ALG',
  '135986': 'AUT',
  '140145': 'JOR',
  // Grupo K
  '133908': 'POR',
  '140112': 'COD',
  '140151': 'UZB',
  '134501': 'COL',
  // Grupo L
  '133914': 'ENG',
  '133912': 'CRO',
  '134513': 'GHA',
  '136165': 'PAN',
}

/** Resuelve ISO-3 a partir del idTeam o del nombre, con fallback entre ambos. */
export function iso3FromTsdb(idTeam: string, name: string): string | null {
  return TSDB_ID_TO_ISO3[idTeam] ?? TSDB_NAME_TO_ISO3[name] ?? null
}
