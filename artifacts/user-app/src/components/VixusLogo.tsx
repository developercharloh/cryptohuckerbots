interface VixusLogoProps {
  className?: string;
}

export function VixusLogo({ className }: VixusLogoProps) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icons/vixus-ai-192.png`}
      className={className}
      role="img"
      alt="Vixus logo"
    />
  );
}
