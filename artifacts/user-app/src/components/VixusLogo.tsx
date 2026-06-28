interface VixusLogoProps {
  className?: string;
}

export function VixusLogo({ className }: VixusLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="VIXUS AI logo"
    >
      <defs>
        <linearGradient id="vixus-grad" x1="20" y1="14" x2="80" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="55%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      {/* Q ring — open at the lower-right where the tail emerges */}
      <path
        d="M68 79 A38 38 0 1 0 50 88"
        stroke="url(#vixus-grad)"
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      />
      {/* upward growth arrow forming the Q tail */}
      <path
        d="M44 62 L44 39 L67 39 L58.5 47.5 L82 71 L74.8 78.2 L51.3 54.7 Z"
        fill="url(#vixus-grad)"
      />
    </svg>
  );
}
