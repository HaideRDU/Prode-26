import { useState } from 'react'
import '../predictions/pred-theme.css'

function EyeOpenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.73 5.08A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.61 6.61A13.43 13.43 0 0 0 1 12s4 7 11 7a10.5 10.5 0 0 0 4.52-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M2 2 22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function InviteCodeQuickStrip({
  inviteCode,
  className,
}: {
  inviteCode: string
  className?: string
}) {
  const [visible, setVisible] = useState(false)
  const [copiedHint, setCopiedHint] = useState(false)
  const masked = '•'.repeat(Math.max(inviteCode.length, 4))

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopiedHint(true)
      window.setTimeout(() => setCopiedHint(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={['invite-code-quick-strip', className].filter(Boolean).join(' ')}>
      <div className="invite-code-quick-strip__row">
        <div className="invite-code-quick-strip__field">
          <input
            readOnly
            className="invite-code-quick-strip__input field-input"
            value={visible ? inviteCode : masked}
            aria-label={visible ? 'Código de invitación visible' : 'Código de invitación oculto'}
          />
        </div>
        <button
          type="button"
          className="invite-code-quick-strip__icon-btn room-standings-icon-btn"
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar código' : 'Mostrar código'}
          title={visible ? 'Ocultar código' : 'Mostrar código'}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOffIcon /> : <EyeOpenIcon />}
        </button>
        <button
          type="button"
          className="invite-code-quick-strip__icon-btn room-standings-icon-btn"
          aria-label="Copiar código de invitación"
          title="Copiar código"
          onClick={() => void copyCode()}
        >
          <CopyIcon />
        </button>
      </div>
      {copiedHint ? (
        <span className="invite-code-quick-strip__feedback" role="status">
          Copiado
        </span>
      ) : null}
    </div>
  )
}
