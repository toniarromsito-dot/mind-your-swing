/**
 * Silueta de golfista en mitad del swing — no existe como icono en
 * lucide-react, así que se dibuja a mano en su mismo estilo (trazo
 * redondeado, sin relleno) para el acceso "Jugar" de Home.
 */
export function GolferSwingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="13.5" cy="4.2" r="1.5" />
      <path d="M12.5 6.3l-1 5.2" />
      <path d="M11.5 11.5l5.5-6.5" />
      <path d="M11.5 11.5l-3 6.5" />
      <path d="M11.5 11.5l4 5.5" />
    </svg>
  );
}
