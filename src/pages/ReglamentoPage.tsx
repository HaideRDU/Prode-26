import { DEFAULT_RULESET, type KnockoutRoundId } from '../config/ruleset'
import {
  ADVANCEMENT_POINTS,
  GROUP_EXACT_SCORE_POINTS,
  GROUP_ONE_SCORE_POINTS,
  GROUP_WINNER_POINTS,
  KO_EXACT_SCORE_BY_ROUND,
  KO_ONE_SCORE_POINTS,
  KO_WINNER_POINTS,
  POINTS_BEST_GOALKEEPER_AVERAGE,
  POINTS_BONUS_QUESTION,
  POINTS_FOURTH_PLACE,
  POINTS_TOP_SCORER,
} from '../services/scoring'

const KO_ROUND_ORDER: KnockoutRoundId[] = ['r32', 'r16', 'qf', 'sf', 'third', 'final']

const KO_ROUND_LABEL_ES: Record<KnockoutRoundId, string> = {
  r32: 'Dieciseisavos de final',
  r16: 'Octavos de final',
  qf: 'Cuartos de final',
  sf: 'Semifinales',
  third: 'Tercer puesto',
  final: 'Final',
}

export function ReglamentoPage() {
  const koPickMin = DEFAULT_RULESET.lockWindows.knockoutPickMinutesBeforeKickoff

  return (
    <div>
      <div className="rules-page-card">
        <h1 className="app-page-title">Reglamento</h1>

        <h2>Fechas límite</h2>
        <ul>
          <li>
            Predicciones generales: se bloquean{' '}
            <strong>{DEFAULT_RULESET.lockWindows.generalPredictionsHoursBeforeTournament / 24} días</strong>{' '}
            antes del inicio del torneo.
          </li>
          <li>
            Dinámica KO por partido: cierre <strong>{koPickMin === 60 ? '1 hora' : `${koPickMin} minutos`}</strong>{' '}
            antes del inicio de cada encuentro.
          </li>
        </ul>

        <h2>Sistema de puntajes</h2>

        <h3>Fase de grupos (por partido)</h3>
        <ul>
          <li>
            Marcador exacto: <strong>{GROUP_EXACT_SCORE_POINTS}</strong> puntos.
          </li>
          <li>
            Acertar solo uno de los dos goles (sin marcador exacto): <strong>{GROUP_ONE_SCORE_POINTS}</strong> puntos.
          </li>
          <li>
            Sin marcador exacto pero acertar resultado (ganador o empate): <strong>{GROUP_WINNER_POINTS}</strong> punto(s).
          </li>
        </ul>

        <h3>Eliminatorias — enfrentamiento correcto</h3>
        <p>
          Cuando la pareja de equipos predicha coincide con la pareja real del partido (el orden de local/visitante o el
          intercambio equivalente no penaliza: cuenta como misma llave).
        </p>
        <ul>
          <li>
            Marcador exacto (90 minutos): puntos según la ronda:
            <ul>
              {KO_ROUND_ORDER.map((rid) => (
                <li key={rid}>
                  {KO_ROUND_LABEL_ES[rid]}: <strong>{KO_EXACT_SCORE_BY_ROUND[rid]}</strong>
                </li>
              ))}
            </ul>
          </li>
          <li>
            Sin marcador exacto: hasta <strong>{KO_ONE_SCORE_POINTS}</strong> por acertar los goles de uno de los equipos
            en el resultado oficial, y <strong>{KO_WINNER_POINTS}</strong> adicional si acertás resultado (1X2).
          </li>
        </ul>

        <h3>Eliminatorias — rival incorrecto</h3>
        <p>
          Si tu bracket predijo una pareja distinta a la que efectivamente se enfrentó en ese cruce (los dos equipos
          oficiales no coinciden con tus dos equipos predichos para ese partido), no aplican los puntos de “marcador
          exacto” ni la tabla normal anterior sobre ese choque. En su lugar:
        </p>
        <ul>
          <li>Marcador exacto del papel respecto al resultado oficial: <strong>0</strong> puntos.</li>
          <li>
            Por cada equipo oficial que también figuraba en tu predicción de ese partido, podés sumar hasta{' '}
            <strong>{KO_ONE_SCORE_POINTS}</strong> si acertaste sus goles en el resultado real.
          </li>
          <li>
            Si acertás el resultado (ganador o empate) entre los goles que pusiste: <strong>{KO_WINNER_POINTS}</strong>{' '}
            punto(s).
          </li>
          <li>
            Los puntos por <em>avance</em> en la tabla de posiciones del torneo se calculan en la sección Avance y no se
            duplican aquí por el mismo acierto.
          </li>
        </ul>

        <h3>Avance (pronósticos “quién llega”)</h3>
        <p>Puntos por acertar hasta qué instancia llega cada selección en tus pronósticos generales:</p>
        <ul>
          <li>
            A dieciseisavos: <strong>{ADVANCEMENT_POINTS.toR32}</strong>
          </li>
          <li>
            A octavos: <strong>{ADVANCEMENT_POINTS.toR16}</strong>
          </li>
          <li>
            A cuartos: <strong>{ADVANCEMENT_POINTS.toQf}</strong>
          </li>
          <li>
            A semifinales: <strong>{ADVANCEMENT_POINTS.toSf}</strong>
          </li>
          <li>
            A la final: <strong>{ADVANCEMENT_POINTS.toFinal}</strong>
          </li>
          <li>
            Tercer puesto: <strong>{ADVANCEMENT_POINTS.thirdPlace}</strong>
          </li>
          <li>
            Campeón: <strong>{ADVANCEMENT_POINTS.champion}</strong>
          </li>
          <li>
            Subcampeón: <strong>{ADVANCEMENT_POINTS.runnerUp}</strong>
          </li>
          <li>
            Cuarto lugar (cuando aplica la pregunta): <strong>{POINTS_FOURTH_PLACE}</strong>
          </li>
        </ul>

        <h3>Extras y preguntas especiales</h3>
        <ul>
          <li>
            Goleador: <strong>{POINTS_TOP_SCORER}</strong>
          </li>
          <li>
            Mejor promedio de arqueros: <strong>{POINTS_BEST_GOALKEEPER_AVERAGE}</strong>
          </li>
          <li>
            Cada acierto en las preguntas especiales que la sala tenga habilitadas:{' '}
            <strong>{POINTS_BONUS_QUESTION}</strong>
          </li>
        </ul>

        <h2>Desempates</h2>
        <ol>
          <li>Mayor cantidad de marcadores exactos.</li>
          <li>Mayor cantidad de aciertos en preguntas especiales.</li>
          <li>Acierto del campeón.</li>
          <li>Sorteo manual (si persiste el empate).</li>
        </ol>
      </div>
    </div>
  )
}
