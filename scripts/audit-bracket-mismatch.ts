/**
 * AUDITORÍA: compara lo que el código PREDICE para R32 vs lo que REALMENTE ocurrió.
 * No modifica nada. Solo lectura.
 */
import { WC26_KO_MATCHES } from '../src/data/wc2026/knockoutBracket.js'

// Ganadores/segundos reales por grupo (teamsByGroup groupIds + resultados reales)
const groupWinners: Record<string, string> = {
  A: 'MEX', B: 'SUI', C: 'BRA', D: 'USA', E: 'GER', F: 'NED',
  G: 'BEL', H: 'ESP', I: 'FRA', J: 'ARG', K: 'COL', L: 'ENG',
}
const groupRunners: Record<string, string> = {
  A: 'RSA', B: 'CAN', C: 'MAR', D: 'AUS', E: 'CIV', F: 'JPN',
  G: 'EGY', H: 'CPV', I: 'NOR', J: 'AUT', K: 'POR', L: 'CRO',
}

// R32 REAL (Firestore / FIFA API)
const realMatches: Record<number, [string, string]> = {
  73: ['RSA', 'CAN'],
  74: ['BRA', 'JPN'],
  75: ['GER', 'PAR'],  // PAR = 3ro del Grupo D
  76: ['NED', 'MAR'],
  // 77..88 no los tenemos confirmados aún
}

const r32 = WC26_KO_MATCHES.filter((m) => m.round === 'r32')

console.log('═══ AUDITORÍA: BRACKET CÓDIGO vs REALIDAD ══════════════════════\n')
console.log('  M#   CÓDIGO PREDICE         REAL (Firestore)     ¿Coincide?')
console.log('  ──   ─────────────────────  ──────────────────   ──────────')

for (const m of r32) {
  const h = m.home as { kind: string; group?: string; matchNum?: number }
  const a = m.away as { kind: string; group?: string; matchNum?: number }
  const homeCode = h.kind === 'group_winner' ? `1°${h.group!}(${groupWinners[h.group!] ?? '?'})` :
                   h.kind === 'group_runner' ? `2°${h.group!}(${groupRunners[h.group!] ?? '?'})` :
                   `3ro[${(h as {matchNum:number}).matchNum}]`
  const awayCode = a.kind === 'group_winner' ? `1°${a.group!}(${groupWinners[a.group!] ?? '?'})` :
                   a.kind === 'group_runner' ? `2°${a.group!}(${groupRunners[a.group!] ?? '?'})` :
                   `3ro[${(a as {matchNum:number}).matchNum}]`
  const predictedHome = h.kind === 'group_winner' ? groupWinners[h.group!] :
                        h.kind === 'group_runner' ? groupRunners[h.group!] : '3ro'
  const predictedAway = a.kind === 'group_winner' ? groupWinners[a.group!] :
                        a.kind === 'group_runner' ? groupRunners[a.group!] : '3ro'

  const real = realMatches[m.matchNum]
  if (!real) {
    console.log(`  M${m.matchNum.toString().padEnd(3)} ${(homeCode+' vs '+awayCode).padEnd(22)} (sin dato real)`)
    continue
  }
  const matches = predictedHome && predictedAway && (
    (predictedHome === real[0] && predictedAway === real[1]) ||
    (predictedHome === real[1] && predictedAway === real[0])
  )
  const flag = matches ? '✅ OK' : '❌ MISMATCH'
  const realStr = real.join(' vs ')
  console.log(`  M${m.matchNum.toString().padEnd(3)} ${(homeCode+' vs '+awayCode).padEnd(25)} ${realStr.padEnd(20)} ${flag}`)
}

console.log('\n═══ IMPACTO EN PUNTUACIÓN ══════════════════════════════════════\n')
console.log('Cuando el código detecta mismatch de equipos en KO, usa scoreKnockoutWrongOpponents():')
console.log('  - El ganador predicho se toma de predictedLineup (equipos DERIVADOS del bracket)')
console.log('  - Si ese ganador ≠ ganador real → 0 puntos aunque el usuario predicho correctamente')
console.log('')
console.log('CASO M74 (BRA 2-1 JPN):')
console.log('  • El código deriva: M74 = winner(Grupo_E) = GER + 3ro_slot74')
console.log('  • Todos predijeron BRA vs JPN y Brasil ganando')
console.log('  • koPairMatchesOfficial(GER, 3ro, BRA, JPN) = FALSE → wrong opponents path')
console.log('  • koPredictedWinnerTeamId → GER (equipo local derivado, usuario predijo gol >0)')
console.log('  • koActualWinnerTeamId → BRA')
console.log('  • GER ≠ BRA → 0 pts para TODOS los usuarios en M74 ← bug')
console.log('')
console.log('CASO M76 (NED 1-1 MAR, MAR ganó pens):')
console.log('  • El código deriva: M76 = winner(Grupo_C) = BRA + runner(Grupo_F) = JPN')
console.log('  • koPairMatchesOfficial(BRA, JPN, NED, MAR) = FALSE → wrong opponents path')
console.log('  • Los usuarios que pusieron MAR o NED como ganador: podrían perder puntos también')
console.log('')
console.log('CAUSA RAÍZ:')
console.log('  knockoutBracket.ts tiene los grupos C, E, F MAL asignados a sus slots R32.')
console.log('  El archivo dice M74=winner(E), M75=winner(F), M76=winner(C)')
console.log('  Pero en el torneo real:')
console.log('    M74 recibe al winner de Grupo C (BRA) en teamsByGroup')
console.log('    M75 recibe al winner de Grupo E (GER) en teamsByGroup')
console.log('    M76 recibe al winner de Grupo F (NED) en teamsByGroup')
console.log('  → Los grupos C, E, F están rotados/intercambiados en knockoutBracket.ts')
