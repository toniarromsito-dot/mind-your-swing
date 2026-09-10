export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" fill="none" className={className} aria-hidden>
      <path
        d="M2 22 L2 4 L11 16 L16 8 L21 16 L30 4 L30 22"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
