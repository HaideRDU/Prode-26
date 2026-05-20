/** Lee --team=ISO3 de process.argv (npm run script -- --team=KOR). */
export function parseTeamArg(argv: readonly string[] = process.argv): string | null {
  const arg = argv.find((a) => a.startsWith('--team='))
  if (!arg) return null
  const iso = arg.split('=')[1]?.trim().toUpperCase()
  return iso && iso.length === 3 ? iso : null
}
