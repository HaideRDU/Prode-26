/** Marca + icono de copa (referencia temática Mundial / 2026, sin logotipo oficial de terceros). */
export function BrandLogo() {
  return (
    <div className="auth-wc26-logo" aria-hidden="false">
      <svg
        className="auth-wc26-logo__mark"
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Copa del mundo"
      >
        <circle cx="22" cy="22" r="20" fill="#fff" stroke="#1d4ed8" strokeWidth="1.25" />
        <ellipse cx="22" cy="14" rx="9" ry="3" fill="#fde68a" stroke="#b45309" strokeWidth="0.75" />
        <path
          fill="#fbbf24"
          stroke="#b45309"
          strokeWidth="0.75"
          d="M22 6c-5.2 0-9.5 3.4-9.5 8v1.2h19V14c0-4.6-4.3-8-9.5-8Z"
        />
        <path
          stroke="#b45309"
          strokeWidth="0.85"
          fill="none"
          strokeLinecap="round"
          d="M12.5 15.2c0 5.2 3.8 9.3 9.5 9.3s9.5-4.1 9.5-9.3"
        />
        <path
          fill="#fbbf24"
          stroke="#b45309"
          strokeWidth="0.6"
          d="M7 14.5h5v1.4H7v-1.4Zm25 0h5v1.4h-5v-1.4Z"
        />
        <path fill="#94a3b8" d="M18 26h8v7h-8v-7Z" />
        <path fill="#64748b" d="M15 33h14v3H15v-3Z" />
        <path
          stroke="#1d4ed8"
          strokeWidth="0.65"
          fill="none"
          opacity="0.55"
          d="M22 8v4M18.5 9.5l3 2.2M25.5 9.5l-3 2.2"
        />
      </svg>
      <div className="auth-wc26-logo__text">
        <span className="auth-wc26-logo__title">Prode 26</span>
        <span className="auth-wc26-logo__sub">Mundial 2026</span>
      </div>
    </div>
  )
}
