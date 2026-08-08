import { cn } from "@/lib/utils";

interface CricketSpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

// A spinning cricket ball with a tiger paw print that flashes and fades on
// its surface — the two brand elements (tiger + cricket) merged into one
// mark rather than sitting side by side. The ball spins; the paw print is
// a separate, non-rotating overlay, so it reads as a stamp appearing on
// the leather rather than spinning around with it. Used as the site's
// loading indicator wherever data is being fetched or calculated (booking
// cost calculation, page transitions, account/session checks) — kept to
// this one touch rather than spread across copy/language.
export function CricketSpinner({ size = 32, className, label }: CricketSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      <div className={cn("relative", className)} style={{ width: size, height: size }}>
        {/* Spinning ball layer */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          className="absolute inset-0 animate-spin"
          style={{ animationDuration: "900ms" }}
        >
          {/* Ball body */}
          <circle cx="24" cy="24" r="21" fill="#B3282D" stroke="#7A1C1F" strokeWidth="1.5" />
          {/* Leather sheen */}
          <circle cx="18" cy="17" r="7" fill="#C8383D" opacity="0.5" />
          {/* Seam — two narrow arcs meeting at the poles, curving through the
              interior (not along the ball's own outline) — the classic
              cricket-ball vesica shape */}
          <path
            d="M 24 3 A 9 21 0 0 1 24 45"
            fill="none"
            stroke="#F5EFE0"
            strokeWidth="1.6"
          />
          <path
            d="M 24 3 A 9 21 0 0 0 24 45"
            fill="none"
            stroke="#F5EFE0"
            strokeWidth="1.6"
          />
          {/* Stitch marks along the seam */}
          {Array.from({ length: 9 }).map((_, i) => {
            const t = i / 8;
            const y = 3 + t * 42;
            const curveOffset = Math.sin(t * Math.PI) * 9;
            return (
              <g key={`l-${i}`}>
                <line
                  x1={24 - curveOffset - 1.5}
                  y1={y}
                  x2={24 - curveOffset + 1.5}
                  y2={y}
                  stroke="#F5EFE0"
                  strokeWidth="1.1"
                />
                <line
                  x1={24 + curveOffset - 1.5}
                  y1={y}
                  x2={24 + curveOffset + 1.5}
                  y2={y}
                  stroke="#F5EFE0"
                  strokeWidth="1.1"
                />
              </g>
            );
          })}
        </svg>

        {/* Fixed tiger paw-print overlay — fades in/out independently of
            the ball's rotation, reading as a stamp on the leather */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          className="absolute inset-0 animate-paw-pulse"
        >
          <g fill="#F7C08A" opacity="0.9">
            <ellipse cx="24" cy="29.5" rx="6.2" ry="5.2" />
            <ellipse cx="16.5" cy="20.5" rx="2.7" ry="3.5" transform="rotate(-18 16.5 20.5)" />
            <ellipse cx="21" cy="15.5" rx="2.7" ry="3.7" transform="rotate(-6 21 15.5)" />
            <ellipse cx="27" cy="15.5" rx="2.7" ry="3.7" transform="rotate(6 27 15.5)" />
            <ellipse cx="31.5" cy="20.5" rx="2.7" ry="3.5" transform="rotate(18 31.5 20.5)" />
          </g>
        </svg>
      </div>
      {label && <p className="text-sm text-neutral-400">{label}</p>}
    </div>
  );
}
