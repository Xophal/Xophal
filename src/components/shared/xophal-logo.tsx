import { useId } from "react";

type LogoVariant =
  | "primary"
  | "horizontal"
  | "stacked"
  | "mark"
  | "wordmark"
  | "dark"
  | "light"
  | "monochrome"
  | "certificate"
  | "watermark";

type LogoSize = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<LogoSize, number> = {
  sm: 0.9,
  md: 1,
  lg: 1.25,
  xl: 1.5,
};

function getPalette(variant: LogoVariant) {
  const isDark = variant === "dark" || variant === "watermark";
  const isLight = variant === "light" || variant === "certificate";
  const isMono = variant === "monochrome";

  return {
    xPrimary: isMono ? "#111827" : "#00B4FF",
    xSecondary: isMono ? "#111827" : "#8B5CF6",
    cap: isMono ? "#111827" : isDark ? "#F8FAFF" : "#0B183B",
    text: isMono ? "#111827" : isLight ? "#0B183B" : "#F8FAFF",
    subText: isMono ? "#111827" : isDark ? "#D9E7FF" : "#1E40AF",
  };
}

function Mark({ variant, className = "" }: { variant: LogoVariant; className?: string }) {
  const id = useId().replace(/:/g, "");
  const palette = getPalette(variant);

  return (
    <svg
      viewBox="0 0 360 270"
      role="img"
      aria-label="Xophal brand mark"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={`${id}-mark-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.xPrimary} />
          <stop offset="45%" stopColor={palette.xPrimary} />
          <stop offset="100%" stopColor={palette.xSecondary} />
        </linearGradient>
        <filter id={`${id}-mark-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={variant === "monochrome" ? 0 : 7} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${id}-mark-glow)`}>
        <path d="M74 18H126L210 204H159L74 18Z" fill={`url(#${id}-mark-gradient)`} opacity="0.98" />
        <path d="M166 18H214L130 204H82L166 18Z" fill={`url(#${id}-mark-gradient)`} opacity="0.82" />
        <path d="M226 18H274L192 204H142L226 18Z" fill={palette.xSecondary} opacity="0.8" />
        <path d="M126 18H166L230 204H189L126 18Z" fill={palette.xSecondary} opacity="0.56" />

        <g transform="translate(118 0)">
          <path d="M30 28H78L123 78H75L30 28Z" fill={palette.cap} />
          <path d="M18 16H87L97 28H8L18 16Z" fill={palette.cap} opacity="0.9" />
          <path d="M6 78H105L92 98H19L6 78Z" fill={palette.cap} opacity="0.8" />
          <path d="M25 98H82L72 118H35L25 98Z" fill={palette.cap} opacity="0.72" />
          <path d="M42 24H72L64 74H52L42 24Z" fill={palette.cap} opacity="0.9" />
        </g>
      </g>
    </svg>
  );
}

export default function XophalLogo({
  variant = "primary",
  size = "md",
  className = "",
  alt = "Xophal",
  animated = false,
}: {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  alt?: string;
  animated?: boolean;
}) {
  const scale = sizeMap[size];
  const palette = getPalette(variant);
  const isMarkOnly = variant === "mark";
  const isStacked = variant === "stacked";

  const commonStyle = animated ? { animation: "xophal-logo-pulse 2.4s ease-in-out infinite" } : undefined;

  if (isMarkOnly) {
    return (
      <div className={className} aria-label={alt} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 0, ...commonStyle }}>
        <Mark variant={variant} className="h-10 w-10 sm:h-12 sm:w-12" />
      </div>
    );
  }

  if (isStacked) {
    return (
      <div className={className} aria-label={alt} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", ...commonStyle }}>
        <svg viewBox="0 0 560 340" role="img" aria-label={alt} style={{ display: "block", width: "100%", height: "auto" }}>
          <g transform="translate(160 12)">
            <Mark variant={variant} className="h-28 w-28" />
          </g>
          <text x="82" y="240" fill={palette.text} fontSize={84 * scale} fontWeight={900} fontFamily="Segoe UI, Inter, Arial, sans-serif" letterSpacing={-3.2}>Xophal</text>
          <text x="128" y="294" fill={palette.subText} fontSize={22 * scale} fontWeight={700} fontFamily="Segoe UI, Inter, Arial, sans-serif" letterSpacing={8}>MOCK TESTS</text>
        </svg>
      </div>
    );
  }

  if (variant === "wordmark") {
    return (
      <div className={className} aria-label={alt} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", ...commonStyle }}>
        <svg viewBox="0 0 360 120" role="img" aria-label={alt} style={{ display: "block", width: "100%", height: "auto" }}>
          <text x="0" y="84" fill={palette.text} fontSize={90 * scale} fontWeight={900} fontFamily="Segoe UI, Inter, Arial, sans-serif" letterSpacing={-3.4}>Xophal</text>
        </svg>
      </div>
    );
  }

  return (
    <div className={className} aria-label={alt} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 0, ...commonStyle }}>
      <svg viewBox="0 0 820 200" role="img" aria-label={alt} style={{ display: "block", width: "100%", height: "auto" }}>
        <g transform="translate(10 18) scale(0.81)">
          <Mark variant={variant === "dark" || variant === "light" || variant === "certificate" ? "dark" : variant} />
        </g>
        <text x="200" y="120" fill={palette.text} fontSize={122 * scale} fontWeight={900} fontFamily="Segoe UI, Inter, Arial, sans-serif" letterSpacing={-5}>Xophal</text>
        <text x="214" y="168" fill={palette.subText} fontSize={28 * scale} fontWeight={700} fontFamily="Segoe UI, Inter, Arial, sans-serif" letterSpacing={12}>MOCK TESTS</text>
      </svg>
    </div>
  );
}
