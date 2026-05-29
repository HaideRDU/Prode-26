import { useEffect, useRef } from 'react'
import type { User } from 'firebase/auth'
import { saveTournamentPrediction } from '../services/predictionsService'
import { EXTRA_IDS } from '../data/questionIds'

export function PodiumExtrasSection({
  user,
  roomId,
  teamLabel,
  firstId,
  secondId,
  thirdId,
  fourthId,
  sectionIndex = 1,
  readOnly = false,
}: {
  user: User
  roomId: string
  teamLabel: (id: string) => string
  firstId: string | null
  secondId: string | null
  thirdId: string | null
  fourthId: string | null
  sectionIndex?: number
  /** Si true, solo muestra el podio sin escribir en Firestore (evita recalcular standings). */
  readOnly?: boolean
}) {
  const lastSyncedKey = useRef<string>('')

  useEffect(() => {
    if (readOnly) return
    if (!firstId || !secondId || !thirdId || !fourthId) return
    const key = `${firstId}|${secondId}|${thirdId}|${fourthId}`
    if (lastSyncedKey.current === key) return
    lastSyncedKey.current = key
    void (async () => {
      try {
        await Promise.all([
          saveTournamentPrediction(roomId, user.uid, EXTRA_IDS.champion, { kind: 'team', teamId: firstId }),
          saveTournamentPrediction(roomId, user.uid, EXTRA_IDS.runnerUp, { kind: 'team', teamId: secondId }),
          saveTournamentPrediction(roomId, user.uid, EXTRA_IDS.thirdPlace, { kind: 'team', teamId: thirdId }),
          saveTournamentPrediction(roomId, user.uid, EXTRA_IDS.fourthPlace, { kind: 'team', teamId: fourthId }),
        ])
      } catch {
        lastSyncedKey.current = ''
      }
    })()
  }, [readOnly, roomId, user.uid, firstId, secondId, thirdId, fourthId])

  function name(id: string | null) {
    return id ? teamLabel(id) : '—'
  }

  return (
    <section className="pred-podium-section">
      <h2 className="pred-section-title">{sectionIndex} · Podio</h2>
      <div className="pred-podium-grid pred-podium-grid--readonly">
        <div className="pred-podium-slot">
          <span className="pred-podium-rank">1º</span>
          <span className="pred-podium-name">{name(firstId)}</span>
        </div>
        <div className="pred-podium-slot">
          <span className="pred-podium-rank">2º</span>
          <span className="pred-podium-name">{name(secondId)}</span>
        </div>
        <div className="pred-podium-slot">
          <span className="pred-podium-rank">3º</span>
          <span className="pred-podium-name">{name(thirdId)}</span>
        </div>
        <div className="pred-podium-slot">
          <span className="pred-podium-rank">4º</span>
          <span className="pred-podium-name">{name(fourthId)}</span>
        </div>
      </div>
    </section>
  )
}
