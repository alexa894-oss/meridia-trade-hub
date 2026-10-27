import type { IllustrationKey } from "@/lib/public/industries";

// Ilustraciones de línea sobre azul marino para las industrias (sin fotos de banco por ahora).
const paths: Record<IllustrationKey, React.ReactNode> = {
  build: (
    <>
      <path d="M8 56h48M14 56V26l18-12 18 12v30" />
      <path d="M26 56V40h12v16M22 30h6M36 30h6" />
    </>
  ),
  door: (
    <>
      <rect x="14" y="6" width="22" height="52" />
      <circle cx="31" cy="34" r="1.6" fill="currentColor" />
      <rect x="40" y="14" width="16" height="22" />
      <path d="M48 14v22M40 25h16" />
    </>
  ),
  floor: (
    <>
      <path d="M6 44l26-14 26 14-26 14z" />
      <path d="M19 37l26 14M32 30l-13 21M45 37L19 51" />
      <path d="M6 44v-6l26-14 26 14v6" />
    </>
  ),
};

export function Illustration({ name, className = "" }: { name: IllustrationKey; className?: string }) {
  return (
    <div
      aria-hidden
      className={`grid place-items-center bg-[radial-gradient(120%_90%_at_20%_10%,var(--color-navy-600),var(--color-navy-950))] text-gold-500 ${className}`}
    >
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" className="h-auto w-[34%] max-w-40 opacity-90">
        {paths[name]}
      </svg>
    </div>
  );
}
