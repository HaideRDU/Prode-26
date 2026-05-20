export interface PaniniPlayerRow {
  stickerCode: string
  name: string
  paniniSlot: number
}

export interface PaniniRostersFile {
  source: 'panini_fifa_wc_2026'
  version: string
  teams: Record<string, PaniniPlayerRow[]>
}

export interface Wc2026TeamRow {
  teamId: string
  groupId: string
  nameEs: string
}
