import { useState } from 'react'
import type { MatchDoc, RoomDoc } from '../types/predictions'
import type { StandingRow } from '../services/standingsService'
import { fetchAllPredictionsForRoom } from '../services/predictionsService'
import { buildRoomClosureReport } from './buildRoomClosureReport'
import { downloadRoomClosurePdf } from './downloadRoomClosurePdf'

type Props = {
  roomId: string
  room: RoomDoc
  standings: StandingRow[]
  matches: (MatchDoc & { id: string })[]
  participantsRegistered: number
  teamLabel: (id: string | null | undefined) => string
  enabledQuestionIds: Set<string> | null
}

export function StandingsClosurePdfButton({
  roomId,
  room,
  standings,
  matches,
  participantsRegistered,
  teamLabel,
  enabledQuestionIds,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const predictions = await fetchAllPredictionsForRoom(roomId)
      const report = await buildRoomClosureReport({
        room,
        roomId,
        standings,
        matches,
        predictions,
        participantsRegistered,
        teamLabel,
        enabledQuestionIds,
      })
      downloadRoomClosurePdf(report)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="standings-closure-pdf">
      <p className="standings-closure-pdf__lead app-muted">
        El plazo de edición cerró. Descargá el acta con el estado inicial de la sala: pronósticos de todos
        los participantes, total de usuarios y premios configurados. El pie de página incluye un hash SHA-256
        para verificar que el contenido no fue alterado.
      </p>
      <button
        type="button"
        className="standings-closure-pdf__btn"
        onClick={() => void handleDownload()}
        disabled={busy || standings.length === 0}
      >
        {busy ? 'Generando acta PDF…' : 'Descargar acta de cierre (PDF)'}
      </button>
      {error ? <p className="auth-error standings-closure-pdf__error">{error}</p> : null}
    </div>
  )
}
