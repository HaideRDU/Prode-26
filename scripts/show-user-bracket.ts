/**
 * Muestra el bracket predicho por andreslioc y su tabla de puntos.
 * Solo lectura, sin Firebase — usa datos del PDF hardcodeados.
 * Uso: npx tsx scripts/show-user-bracket.ts
 */
import { getPredictedKoLineupForMatch } from '../src/domain/koPredictedLineup.js'
import { WC26_KO_MATCHES } from '../src/data/wc2026/knockoutBracket.js'
import type { PredictionDoc, MatchPredictionPayload } from '../src/types/predictions.js'

// ── Predicciones de andreslioc extraídas del PDF ──────────────────────────
// [matchId, goalsHome, goalsAway]
const GROUP_PREDS: [string, number, number][] = [
  ['wc26-A-01', 2, 0], ['wc26-A-02', 2, 1], ['wc26-A-03', 2, 0],
  ['wc26-A-04', 1, 1], ['wc26-A-05', 2, 1], ['wc26-A-06', 2, 0],
  ['wc26-B-01', 2, 1], ['wc26-B-02', 0, 2], ['wc26-B-03', 3, 0],
  ['wc26-B-04', 1, 1], ['wc26-B-05', 1, 0], ['wc26-B-06', 2, 0],
  ['wc26-C-01', 2, 1], ['wc26-C-02', 0, 2], ['wc26-C-03', 4, 0],
  ['wc26-C-04', 0, 2], ['wc26-C-05', 2, 0], ['wc26-C-06', 3, 0],
  ['wc26-D-01', 2, 1], ['wc26-D-02', 1, 2], ['wc26-D-03', 2, 0],
  ['wc26-D-04', 1, 1], ['wc26-D-05', 1, 1], ['wc26-D-06', 1, 0],
  ['wc26-E-01', 4, 0], ['wc26-E-02', 1, 1], ['wc26-E-03', 2, 1],
  ['wc26-E-04', 3, 0], ['wc26-E-05', 2, 1], ['wc26-E-06', 0, 2],
  ['wc26-F-01', 2, 1], ['wc26-F-02', 1, 1], ['wc26-F-03', 2, 0],
  ['wc26-F-04', 0, 2], ['wc26-F-05', 3, 0], ['wc26-F-06', 2, 1],
  ['wc26-G-01', 2, 1], ['wc26-G-02', 1, 0], ['wc26-G-03', 2, 0],
  ['wc26-G-04', 0, 2], ['wc26-G-05', 3, 0], ['wc26-G-06', 1, 1],
  ['wc26-H-01', 4, 0], ['wc26-H-02', 0, 2], ['wc26-H-03', 3, 0],
  ['wc26-H-04', 2, 0], ['wc26-H-05', 2, 1], ['wc26-H-06', 1, 1],
  ['wc26-I-01', 2, 1], ['wc26-I-02', 0, 3], ['wc26-I-03', 3, 0],
  ['wc26-I-04', 1, 1], ['wc26-I-05', 2, 1], ['wc26-I-06', 2, 0],
  ['wc26-J-01', 2, 0], ['wc26-J-02', 2, 0], ['wc26-J-03', 2, 1],
  ['wc26-J-04', 0, 2], ['wc26-J-05', 3, 0], ['wc26-J-06', 1, 1],
  ['wc26-K-01', 3, 0], ['wc26-K-02', 0, 2], ['wc26-K-03', 2, 0],
  ['wc26-K-04', 2, 1], ['wc26-K-05', 1, 1], ['wc26-K-06', 1, 1],
  ['wc26-L-01', 2, 1], ['wc26-L-02', 1, 1], ['wc26-L-03', 2, 0],
  ['wc26-L-04', 0, 2], ['wc26-L-05', 3, 0], ['wc26-L-06', 2, 0],
]

// KO predictions [matchNum, goalsA, goalsB, penWinnerA (null=no pens)]
const KO_PREDS: [number, number, number, boolean | null][] = [
  [73, 2, 1, null],  // RSA vs CAN
  [74, 2, 0, null],  // BRA vs JPN
  [75, 2, 1, null],  // GER vs PAR
  [76, 2, 1, null],  // NED vs MAR
  [77, 3, 0, null],  // FRA vs 3ro (andreslioc escribió CIV vs NOR)
  [78, 1, 2, null],  // CIV vs NOR (andreslioc escribió FRA vs SWE)
  [79, 2, 1, null],  // MEX vs ECU
  [80, 1, 0, null],  // ENG vs COD
  [81, 1, 2, null],  // BEL vs SEN
  [82, 2, 1, null],  // ESP vs AUT (andreslioc escribió ESP vs AUT)
  [83, 1, 1, false], // POR vs CRO (pen B)
  [84, 2, 0, null],  // SUI vs ALG (andreslioc)
  [85, 1, 2, null],  // USA vs BIH
  [86, 2, 1, null],  // AUS vs EGY
  [87, 2, 0, null],  // ARG vs CPV
  [88, 1, 1, true],  // COL vs GHA (pen A)
  [89, 1, 2, null],
  [90, 1, 2, null],  // CAN vs PAR
  [91, 2, 1, null],
  [92, 1, 2, null],
  [93, 1, 2, null],
  [94, 1, 1, false], // pen B
  [95, 2, 1, null],
  [96, 1, 2, null],
  [97, 2, 1, null],
  [98, 2, 0, null],
  [99, 1, 1, true],  // pen A
  [100, 1, 2, null],
  [101, 1, 2, null],
  [102, 1, 1, true], // pen A
  [103, 2, 1, null],
  [104, 2, 1, null],
]

// Construir PredictionDocs mock
const preds: PredictionDoc[] = []
for (const [matchId, ga, gb] of GROUP_PREDS) {
  preds.push({
    userId: 'andreslioc',
    scope: 'match',
    matchId,
    payload: { goalsTeamA: ga, goalsTeamB: gb } as MatchPredictionPayload,
  } as PredictionDoc)
}
for (const [matchNum, ga, gb, penA] of KO_PREDS) {
  const matchId = `wc26-ko-${matchNum}`
  const payload: MatchPredictionPayload = { goalsTeamA: ga, goalsTeamB: gb } as MatchPredictionPayload
  if (penA !== null) {
    ;(payload as Record<string, unknown>).penaltiesWinnerTeamA = penA
    ;(payload as Record<string, unknown>).penaltiesWinnerTeamB = !penA
  }
  preds.push({
    userId: 'andreslioc',
    scope: 'match',
    matchId,
    payload,
  } as PredictionDoc)
}

// ── Nombres para display ───────────────────────────────────────────────────
const NAMES: Record<string, string> = {
  MEX:'México', RSA:'Sudáfrica', KOR:'Corea del Sur', CZE:'Chequia',
  SUI:'Suiza', CAN:'Canadá', BIH:'Bosnia', QAT:'Catar',
  BRA:'Brasil', MAR:'Marruecos', SCO:'Escocia', HAI:'Haití',
  USA:'EE.UU.', AUS:'Australia', PAR:'Paraguay', TUR:'Turquía',
  GER:'Alemania', CIV:'C.Marfil', ECU:'Ecuador', CUW:'Curazao',
  NED:'P.Bajos', JPN:'Japón', SWE:'Suecia', TUN:'Túnez',
  BEL:'Bélgica', EGY:'Egipto', IRN:'Irán', NZL:'N.Zelanda',
  ESP:'España', CPV:'Cabo Verde', URU:'Uruguay', KSA:'Arabia S.',
  FRA:'Francia', NOR:'Noruega', SEN:'Senegal', IRQ:'Irak',
  ARG:'Argentina', AUT:'Austria', ALG:'Argelia', JOR:'Jordania',
  COL:'Colombia', POR:'Portugal', COD:'RD Congo', UZB:'Uzbekistán',
  ENG:'Inglaterra', CRO:'Croacia', GHA:'Ghana', PAN:'Panamá',
}
const n = (id: string | null) => id ? (NAMES[id] ?? id) : '???'

// ── Resolver bracket predicho ─────────────────────────────────────────────
interface SlotInfo {
  matchNum: number
  round: string
  predA: string | null
  predB: string | null
  scoreA: number
  scoreB: number
  penStr: string
  winnerPred: string | null
}

const slots: SlotInfo[] = []

for (const m of WC26_KO_MATCHES) {
  const lineup = getPredictedKoLineupForMatch(preds, `wc26-ko-${m.matchNum}`)
  const koPred = KO_PREDS.find(k => k[0] === m.matchNum)
  const ga = koPred?.[1] ?? 0
  const gb = koPred?.[2] ?? 0
  const penA = koPred?.[3] ?? null

  let winnerPred: string | null = null
  if (ga > gb) winnerPred = lineup.predictedTeamAId
  else if (gb > ga) winnerPred = lineup.predictedTeamBId
  else if (penA === true) winnerPred = lineup.predictedTeamAId
  else if (penA === false) winnerPred = lineup.predictedTeamBId

  let penStr = ''
  if (penA === true) penStr = ' (pen A)'
  if (penA === false) penStr = ' (pen B)'

  slots.push({
    matchNum: m.matchNum,
    round: m.round,
    predA: lineup.predictedTeamAId,
    predB: lineup.predictedTeamBId,
    scoreA: ga,
    scoreB: gb,
    penStr,
    winnerPred,
  })
}

// ── Imprimir bracket por ronda ─────────────────────────────────────────────
const ROUND_NAMES: Record<string, string> = {
  r32: 'R32 (32avos)', r16: 'R16 (Octavos)', qf: 'Cuartos', sf: 'Semifinales', third: '3er Puesto', final: 'Final'
}
const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final']

console.log('\n╔══════════════════════════════════════════════════════════════════╗')
console.log('║        BRACKET PREDICHO — andreslioc                            ║')
console.log('╚══════════════════════════════════════════════════════════════════╝')

for (const round of ROUND_ORDER) {
  const roundSlots = slots.filter(s => s.round === round)
  if (!roundSlots.length) continue
  console.log(`\n── ${ROUND_NAMES[round] ?? round} ──`)
  for (const s of roundSlots) {
    const teamA = n(s.predA).padEnd(14)
    const teamB = n(s.predB).padEnd(14)
    const score = `${s.scoreA}-${s.scoreB}${s.penStr}`
    const winner = s.winnerPred ? `→ ${n(s.winnerPred)} avanza` : '→ ?'
    console.log(`  M${s.matchNum.toString().padEnd(4)} ${teamA} ${score.padEnd(10)} ${teamB}   ${winner}`)
  }
}

// ── Imprimir tabla de puntos (partidos conocidos vs predicciones) ──────────
console.log('\n\n╔══════════════════════════════════════════════════════════════════╗')
console.log('║        PUNTOS KO — partidos ya jugados                          ║')
console.log('╚══════════════════════════════════════════════════════════════════╝')

// Resultados reales conocidos de KO
const REAL_KO: Record<number, { a: string; b: string; ga: number; gb: number; penA?: boolean }> = {
  74: { a: 'BRA', b: 'JPN', ga: 2, gb: 1 },
  75: { a: 'GER', b: 'PAR', ga: 1, gb: 1, penA: false }, // PAR won pens
  76: { a: 'NED', b: 'MAR', ga: 1, gb: 1, penA: false }, // MAR won pens (wait - debería ser penA=false = teamB wins)
}

const RULESET_R32_WINNER = 6
const RULESET_R32_GOAL   = 2

for (const [numStr, real] of Object.entries(REAL_KO)) {
  const num = Number(numStr)
  const slot = slots.find(s => s.matchNum === num)!
  if (!slot) continue

  const realWinner = real.penA === undefined
    ? (real.ga > real.gb ? real.a : real.b)
    : real.penA ? real.a : real.b
  const predWinner = slot.winnerPred

  const correctPair = (slot.predA === real.a && slot.predB === real.b) || (slot.predA === real.b && slot.predB === real.a)
  let pts = 0
  const parts: string[] = []

  if (correctPair) {
    // Equipos correctos — scoring normal
    const predGoalForA = slot.predA === real.a ? slot.scoreA : slot.scoreB
    const predGoalForB = slot.predA === real.a ? slot.scoreB : slot.scoreA
    if (predWinner === realWinner) { pts += RULESET_R32_WINNER; parts.push(`+${RULESET_R32_WINNER} ganador`) }
    if (predGoalForA === real.ga) { pts += RULESET_R32_GOAL; parts.push(`+${RULESET_R32_GOAL} gol A`) }
    if (predGoalForB === real.gb) { pts += RULESET_R32_GOAL; parts.push(`+${RULESET_R32_GOAL} gol B`) }
  } else {
    // Equipos incorrectos — solo ganador
    if (predWinner === realWinner) { pts += RULESET_R32_WINNER; parts.push(`+${RULESET_R32_WINNER} ganador (rivals wrong)`) }
  }

  const realStr = `Real: ${n(real.a)} ${real.ga}-${real.gb} ${n(real.b)}${real.penA === undefined ? '' : real.penA ? ' (A pens)' : ' (B pens)'}`
  const predStr = `Pred: ${n(slot.predA)} ${slot.scoreA}-${slot.scoreB}${slot.penStr} ${n(slot.predB)}`
  const pairOk = correctPair ? '✅ equipos correctos' : '⚠️  equipos derivados ≠ reales'
  console.log(`\n  M${num}: ${pairOk}`)
  console.log(`    ${realStr}`)
  console.log(`    ${predStr}`)
  console.log(`    Ganador predicho: ${n(predWinner)} | Real: ${n(realWinner)} ${predWinner === realWinner ? '✅' : '❌'}`)
  console.log(`    PUNTOS: ${pts > 0 ? pts : 0}  ${parts.join(', ')}`)
}

console.log('\n[Nota: puntos de grupo fase no incluidos — requiere datos Firestore reales]')
