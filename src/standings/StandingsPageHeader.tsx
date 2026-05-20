type Props = {
  lastUpdateLabel: string | null
  onHelpClick?: () => void
}

export function StandingsPageHeader({ lastUpdateLabel, onHelpClick }: Props) {
  return (
    <header className="standings-dashboard__header">
      <div className="standings-dashboard__header-main">
        <div>
          <h1 className="standings-dashboard__title">Bolsa de premios y ranking</h1>
          <p className="standings-dashboard__lead">
            Tabla en vivo con puntos, aciertos y movimiento de posiciones en esta sala.
          </p>
        </div>
        {lastUpdateLabel ? (
          <p className="standings-dashboard__update-badge" role="status">
            Última actualización: {lastUpdateLabel}
          </p>
        ) : null}
      </div>
      {onHelpClick ? (
        <button
          type="button"
          className="standings-dashboard__help-btn"
          aria-label="Cómo suman los puntos"
          title="Cómo suman los puntos"
          onClick={onHelpClick}
        >
          ?
        </button>
      ) : null}
    </header>
  )
}
