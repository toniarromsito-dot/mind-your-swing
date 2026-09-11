import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-6",
  md: "size-9",
  lg: "size-16",
} as const;

/**
 * Marca visual propia de Mind: una media luna suave (dos círculos
 * superpuestos), no un cerebro/robot/chispa de IA. Pensada como avatar del
 * compañero — en el nav, el chat, el acceso durante Focus Mode y el
 * análisis post-vuelta — para que Mind se sienta como "alguien", no como
 * un botón de inteligencia artificial.
 */
export function MindMark({
  size = "md",
  thinking = false,
  className,
}: {
  size?: keyof typeof SIZES;
  thinking?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
        SIZES[size],
        thinking && "animate-[mind-breathe_1.6s_ease-in-out_infinite]",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" aria-hidden="true">
        <path
          d="M14.5 4.5a8 8 0 1 0 5 12.9A9.5 9.5 0 0 1 14.5 4.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
