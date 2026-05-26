import './seed-load-env.ts'
import { applicationDefault, getApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { WC2026_TEAMS_BY_GROUP } from '../src/data/wc2026/teamsByGroup.ts'
import type { TeamPlayerDoc } from '../functions/src/lib/types/predictions.js'

const WIKI_PAGE = '2026_FIFA_World_Cup_squads'
const WIKI_API = 'https://en.wikipedia.org/w/api.php'

const WIKI_TEAM_NAME_TO_TEAM_ID: Record<string, string> = {
  // Group A
  Mexico: 'MEX',
  'South Africa': 'RSA',
  'South Korea': 'KOR',
  'Czech Republic': 'CZE',
  // Group B
  Canada: 'CAN',
  'Bosnia and Herzegovina': 'BIH',
  Qatar: 'QAT',
  Switzerland: 'SUI',
  // Group C
  Brazil: 'BRA',
  Morocco: 'MAR',
  Haiti: 'HAI',
  Scotland: 'SCO',
  // Group D
  'United States': 'USA',
  Paraguay: 'PAR',
  Australia: 'AUS',
  Turkey: 'TUR',
  // Group E
  Germany: 'GER',
  Curaçao: 'CUW',
  Curacao: 'CUW',
  'Ivory Coast': 'CIV',
  "Côte d'Ivoire": 'CIV',
  Ecuador: 'ECU',
  // Group F
  Netherlands: 'NED',
  Japan: 'JPN',
  Sweden: 'SWE',
  Tunisia: 'TUN',
  // Group G
  Belgium: 'BEL',
  Egypt: 'EGY',
  Iran: 'IRN',
  'New Zealand': 'NZL',
  // Group H
  Spain: 'ESP',
  'Cape Verde': 'CPV',
  'Saudi Arabia': 'KSA',
  Uruguay: 'URU',
  // Group I
  France: 'FRA',
  Senegal: 'SEN',
  Iraq: 'IRQ',
  Norway: 'NOR',
  // Group J
  Argentina: 'ARG',
  Algeria: 'ALG',
  Austria: 'AUT',
  Jordan: 'JOR',
  // Group K
  Portugal: 'POR',
  'DR Congo': 'COD',
  'Democratic Republic of the Congo': 'COD',
  Uzbekistan: 'UZB',
  Colombia: 'COL',
  // Group L
  England: 'ENG',
  Croatia: 'CRO',
  Ghana: 'GHA',
  Panama: 'PAN',
}

const dryRun = process.argv.includes('--dry-run')
const teamArg = process.argv.find((x) => x.startsWith('--team='))?.slice('--team='.length).trim().toUpperCase()

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT

if (!dryRun) {
  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  })
}

type WikiPlayer = { name: string; number?: string; position?: string }
type TeamRoster = { wikiTeamName: string; teamId: string; players: WikiPlayer[] }

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function slug(s: string): string {
  const normalized = s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'player'
}

function playerDocId(player: WikiPlayer): string {
  const num = player.number?.trim()
  return num ? `${num}-${slug(player.name)}` : slug(player.name)
}

async function fetchJson(params: Record<string, string>): Promise<any> {
  const url = `${WIKI_API}?${new URLSearchParams(params).toString()}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Prode-26-RosterSeeder/1.0' } })
  if (!res.ok) throw new Error(`Wikipedia API HTTP ${res.status} en ${params.action ?? 'request'}`)
  return res.json()
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<sup[\s\S]*?<\/sup>/gi, '')
      .replace(/<ref[\s\S]*?<\/ref>/gi, '')
      .replace(/<ref[^/>]*\/>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\[[^\]]*]/g, '')
      .replace(/\(captain\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

async function fetchWholePageHtml(): Promise<string> {
  const parsed = await fetchJson({
    action: 'parse',
    page: WIKI_PAGE,
    format: 'json',
    prop: 'text',
  })
  const html = parsed?.parse?.text?.['*']
  if (typeof html !== 'string' || html.trim() === '') {
    throw new Error('Wikipedia devolvió HTML vacío para la página completa')
  }
  return html
}

function parsePlayersFromHtmlTable(tableHtml: string): WikiPlayer[] {
  const out: WikiPlayer[] = []
  const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
  for (const row of rows) {
    if (!/<td/i.test(row)) continue
    const cells: string[] = []
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let cm: RegExpExecArray | null
    while ((cm = cellRegex.exec(row)) !== null) {
      cells.push(stripTags(cm[1]))
    }
    if (cells.length < 2) continue
    if (cells.some((c) => /date of birth|caps|goals|club/i.test(c))) continue

    let number = ''
    let position = ''
    let name = ''
    let posIdx = -1

    for (let i = 0; i < cells.length; i++) {
      const cell = (cells[i] ?? '').trim()
      const compact = cell.match(/^(\d+)\s*(GK|DF|MF|FW)$/i)
      if (compact) {
        number = compact[1]
        position = compact[2].toUpperCase()
        posIdx = i
        break
      }
    }
    if (posIdx < 0) {
      for (let i = 1; i < cells.length; i++) {
        const cPrev = (cells[i - 1] ?? '').trim()
        const cCur = (cells[i] ?? '').trim()
        if (/^\d+$/.test(cPrev) && /^(GK|DF|MF|FW)$/i.test(cCur)) {
          number = cPrev
          position = cCur.toUpperCase()
          posIdx = i
          break
        }
      }
    }
    if (posIdx < 0) continue
    for (let i = posIdx + 1; i < cells.length; i++) {
      const candidate = (cells[i] ?? '').trim()
      if (!candidate) continue
      if (/^(GK|DF|MF|FW)$/i.test(candidate)) continue
      if (/^\d+$/.test(candidate)) continue
      if (/\d{4}-\d{2}-\d{2}/.test(candidate)) continue
      name = candidate
      break
    }
    if (!name) continue
    out.push({ name, number: number || undefined, position })
  }
  return out
}

function parseRostersFromHtml(html: string): TeamRoster[] {
  const rosters: TeamRoster[] = []
  const headingRegex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi
  const tableRegex = /<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/gi
  const headings: Array<{ name: string; index: number; end: number }> = []
  let hm: RegExpExecArray | null
  while ((hm = headingRegex.exec(html)) !== null) {
    headings.push({
      name: stripTags(hm[1]),
      index: hm.index,
      end: headingRegex.lastIndex,
    })
  }

  for (let i = 0; i < headings.length; i++) {
    const current = headings[i]
    const teamId = WIKI_TEAM_NAME_TO_TEAM_ID[current.name]
    if (!teamId) continue
    const nextIndex = i + 1 < headings.length ? headings[i + 1].index : html.length
    const block = html.slice(current.end, nextIndex)
    const tables = block.match(tableRegex) ?? []
    if (tables.length === 0) continue
    let best: WikiPlayer[] = []
    for (const t of tables) {
      const parsed = parsePlayersFromHtmlTable(t)
      if (parsed.length > best.length) best = parsed
    }
    rosters.push({
      wikiTeamName: current.name,
      teamId,
      players: best,
    })
  }

  if (rosters.length > 0) return rosters

  // Fallback por nombre + mejor tabla cercana
  for (const [wikiTeamName, teamId] of Object.entries(WIKI_TEAM_NAME_TO_TEAM_ID)) {
    const idx = html.search(new RegExp(`\\b${wikiTeamName.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&')}\\b`, 'i'))
    if (idx < 0) continue
    const block = html.slice(idx)
    const tables = block.match(tableRegex) ?? []
    let best: WikiPlayer[] = []
    for (const t of tables.slice(0, 4)) {
      const parsed = parsePlayersFromHtmlTable(t)
      if (parsed.length > best.length) best = parsed
    }
    rosters.push({
      wikiTeamName,
      teamId,
      players: best,
    })
  }

  return rosters
}

async function replaceTeamRoster(
  db: Firestore,
  teamId: string,
  players: WikiPlayer[],
): Promise<{ deleted: number; written: number }> {
  const teamRef = db.collection('teams').doc(teamId)
  const playersSnap = await teamRef.collection('players').get()

  const writer = db.bulkWriter()
  for (const doc of playersSnap.docs) writer.delete(doc.ref)

  const syncedAt = new Date()
  writer.set(
    teamRef,
    {
      rosterSyncedAt: syncedAt,
      rosterPlayerCount: players.length,
      rosterSource: 'manual',
    },
    { merge: true },
  )

  for (const p of players) {
    const ref = teamRef.collection('players').doc(playerDocId(p))
    const payload: TeamPlayerDoc = {
      name: p.name,
      ...(p.position ? { position: p.position } : {}),
      ...(p.number ? { number: p.number } : {}),
      syncedAt,
    }
    writer.set(ref, payload)
  }

  await writer.close()
  return { deleted: playersSnap.size, written: players.length }
}

async function main(): Promise<void> {
  const label = dryRun ? 'check:wikipedia-group-l-final-rosters' : 'seed:wikipedia-group-l-final-rosters'
  console.log(`[${label}] Fuente: https://en.wikipedia.org/wiki/${WIKI_PAGE}`)
  if (!dryRun) {
    console.log(`[${label}] projectId:`, getApp().options.projectId ?? projectId)
  }

  const fullHtml = await fetchWholePageHtml()
  let rosters = parseRostersFromHtml(fullHtml)
  if (teamArg) rosters = rosters.filter((x) => x.teamId === teamArg)

  const knownTeams = new Set(WC2026_TEAMS_BY_GROUP.map((t) => t.teamId))
  rosters = rosters.filter((x) => knownTeams.has(x.teamId))

  if (rosters.length === 0) {
    console.log(`[${label}] No se encontraron selecciones del Mundial para procesar.`)
    return
  }

  const db = dryRun ? null : getFirestore()
  let imported = 0
  let skipped = 0
  let deletedTotal = 0

  for (const roster of rosters) {
    const count = roster.players.length
    if (count !== 26) {
      skipped += 1
      console.log(`- ${roster.teamId} (${roster.wikiTeamName}): omitido, lista actual=${count} (no final de 26)`)
      continue
    }

    if (dryRun) {
      imported += 1
      console.log(`○ ${roster.teamId} (${roster.wikiTeamName}): listo para importar (${count} jugadores)`)
      continue
    }

    const { deleted, written } = await replaceTeamRoster(db!, roster.teamId, roster.players)
    imported += 1
    deletedTotal += deleted
    console.log(`✓ ${roster.teamId} (${roster.wikiTeamName}): importados=${written}, borrados_previos=${deleted}`)
  }

  console.log('\nResumen:', { imported, skipped, deletedPlayers: deletedTotal, dryRun })
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('default credentials')) {
    console.error(
      '[seed:wikipedia-group-l-final-rosters] Sin credenciales Firebase Admin. Ejecuta: gcloud auth application-default login',
    )
  } else {
    console.error('[seed:wikipedia-group-l-final-rosters] ERROR:', e)
  }
  process.exit(1)
})

