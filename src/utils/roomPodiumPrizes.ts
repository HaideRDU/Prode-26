import type { PrivateRoomPodiumPrizes } from '../types/predictions'

export function roomHasPodiumPrizes(prizes?: PrivateRoomPodiumPrizes | null): boolean {
  if (!prizes) return false
  return Boolean(prizes.first?.trim() || prizes.second?.trim() || prizes.third?.trim())
}
