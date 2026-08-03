import { cn } from "@/lib/utils";

/** Marca visual do JAX — identidade própria (não usa ícone genérico de IA). */
export function JaxMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
        <path
          d="M4 7.5 9.2 12 4 16.5"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 7.5 20 16.5M20 7.5 13.5 16.5"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
