/**
 * ISO 3166-1 alpha-3 (FIFA) → alpha-2 para imágenes en flagcdn.com (w20/w40 o 24x18; no usar w24).
 * Casos especiales: selecciones que usan códigos distintos en banderas.
 */
export const TEAM_ISO3_TO_FLAG_ALPHA2: Readonly<Record<string, string>> = {
  MEX: 'mx',
  RSA: 'za',
  KOR: 'kr',
  CZE: 'cz',
  CAN: 'ca',
  BIH: 'ba',
  QAT: 'qa',
  SUI: 'ch',
  BRA: 'br',
  MAR: 'ma',
  HAI: 'ht',
  SCO: 'gb-sct',
  USA: 'us',
  PAR: 'py',
  AUS: 'au',
  TUR: 'tr',
  GER: 'de',
  CUW: 'cw',
  CIV: 'ci',
  ECU: 'ec',
  NED: 'nl',
  JPN: 'jp',
  SWE: 'se',
  TUN: 'tn',
  BEL: 'be',
  EGY: 'eg',
  IRN: 'ir',
  NZL: 'nz',
  ESP: 'es',
  CPV: 'cv',
  KSA: 'sa',
  URU: 'uy',
  FRA: 'fr',
  SEN: 'sn',
  IRQ: 'iq',
  NOR: 'no',
  ARG: 'ar',
  ALG: 'dz',
  AUT: 'at',
  JOR: 'jo',
  POR: 'pt',
  COD: 'cd',
  UZB: 'uz',
  COL: 'co',
  ENG: 'gb-eng',
  CRO: 'hr',
  GHA: 'gh',
  PAN: 'pa',
}

/** Tamaños válidos en flagcdn: w20|w40|… o 24x18|48x36|… (no existe w24). */
function flagcdnSizeParam(width: 20 | 24 | 40): string {
  if (width === 24) return '24x18'
  return `w${width}`
}

export function flagImageUrl(iso3: string, width: 20 | 24 | 40 = 40): string {
  const key = iso3.trim().toUpperCase()
  const a2 = TEAM_ISO3_TO_FLAG_ALPHA2[key]
  if (!a2) return ''
  return `https://flagcdn.com/${flagcdnSizeParam(width)}/${a2}.png`
}
