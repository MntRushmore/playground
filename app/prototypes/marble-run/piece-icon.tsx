import type { PieceType } from "./types";

/** Line icons for the piece tray, drawn in currentColor (UI chrome follows the theme). */
export function PieceIcon({ type, className }: { type: PieceType; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[type]}
    </svg>
  );
}

const ICONS: Record<PieceType, React.ReactNode> = {
  dropper: (
    <>
      <ellipse cx="12" cy="5" rx="7" ry="2" />
      <path d="M5 5l4.5 6.5V20h5v-8.5L19 5" />
    </>
  ),
  ramp: (
    <>
      <path d="M3 8.5l18 6" strokeWidth={3} />
      <circle cx="7" cy="5.5" r="1.4" />
    </>
  ),
  curve: <path d="M19.5 4a14 14 0 0 1-14 14" strokeWidth={3} />,
  funnel: (
    <>
      <ellipse cx="12" cy="7" rx="9" ry="2.6" />
      <path d="M3 7l7 7.5V20h4v-5.5L21 7" />
    </>
  ),
  switch: (
    <>
      <path d="M4 7.5l16 6" strokeWidth={2.6} />
      <path d="M12 10.5l-3.5 8.5h7z" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        return <path key={a} d={`M${12 + Math.cos(r) * 4} ${12 + Math.sin(r) * 4}L${12 + Math.cos(r) * 9.5} ${12 + Math.sin(r) * 9.5}`} />;
      })}
    </>
  ),
  bumper: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  spring: (
    <>
      <path d="M5 5h14" strokeWidth={2.6} />
      <path d="M12 6l-4 2.5 8 2.5-8 2.5 8 2.5-4 2" />
      <path d="M7 20h10" strokeWidth={2.6} />
    </>
  ),
  lift: (
    <>
      <path d="M7 3v18M17 3v18" />
      <path d="M7 7.5h10M7 12h10M7 16.5h10" />
    </>
  ),
  cup: (
    <>
      <path d="M4 9v7.5A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5V9" />
      <circle cx="9.5" cy="15.5" r="1.6" />
      <circle cx="14.5" cy="15.5" r="1.6" />
    </>
  ),
};
