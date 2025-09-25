export const FeaturesIllustration = (
  props: React.SVGProps<SVGSVGElement>
) => (
  <svg
    viewBox="0 0 200 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect width="200" height="140" rx="12" fill="#F9FAFB" />
    <rect
      x="1"
      y="1"
      width="198"
      height="138"
      rx="11"
      stroke="#E5E7EB"
      strokeWidth="2"
    />

    {/* Header line */}
    <rect x="16" y="20" width="168" height="14" rx="3" fill="#D1D5DB" />

    {/* Left column: summary/statistics */}
    <rect x="16" y="44" width="40" height="40" rx="8" fill="#3B82F6" />
    <rect x="16" y="90" width="40" height="14" rx="3" fill="#E5E7EB" />
    <rect x="16" y="110" width="40" height="14" rx="3" fill="#E5E7EB" />

    {/* Right column: details */}
    <rect x="64" y="44" width="120" height="14" rx="3" fill="#D1D5DB" />
    <rect x="64" y="64" width="120" height="14" rx="3" fill="#E5E7EB" />
    <rect x="64" y="84" width="120" height="14" rx="3" fill="#D1D5DB" />
    <rect x="64" y="104" width="120" height="14" rx="3" fill="#E5E7EB" />
  </svg>
);
