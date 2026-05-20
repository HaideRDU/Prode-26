/** Fila de jugador en el JSON estático del álbum Panini FIFA WC 2026. */
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
