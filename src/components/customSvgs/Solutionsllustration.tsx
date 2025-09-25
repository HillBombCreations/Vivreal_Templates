export const Solutionsllustration = (
  props: React.SVGProps<SVGSVGElement>
) => (
  <svg
    viewBox="0 0 160 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Background */}
    <rect width="160" height="120" rx="12" fill="#F9FAFB" />
    <rect x="1" y="1" width="158" height="118" rx="11" stroke="#E5E7EB" strokeWidth="2" />

    {/* Left half: Content Hub (block style) */}
    <rect x="12" y="16" width="62" height="16" rx="4" fill="#3B82F6" />
    <rect x="12" y="40" width="62" height="12" rx="3" fill="#D1D5DB" />
    <rect x="12" y="58" width="50" height="12" rx="3" fill="#E5E7EB" />
    <rect x="12" y="76" width="58" height="12" rx="3" fill="#D1D5DB" />

    {/* Right half: Nested Tabs (steps or list style) */}
    <circle cx="115" cy="26" r="10" fill="#3B82F6" />
    <text
      x="115"
      y="30"
      textAnchor="middle"
      fill="white"
      fontSize="12"
      fontWeight="bold"
      fontFamily="Arial, sans-serif"
    >
      1
    </text>
    <rect x="130" y="20" width="25" height="12" rx="3" fill="#E5E7EB" />

    <circle cx="115" cy="56" r="10" fill="#3B82F6" />
    <text
      x="115"
      y="60"
      textAnchor="middle"
      fill="white"
      fontSize="12"
      fontWeight="bold"
      fontFamily="Arial, sans-serif"
    >
      2
    </text>
    <rect x="130" y="50" width="20" height="12" rx="3" fill="#E5E7EB" />

    <circle cx="115" cy="86" r="10" fill="#3B82F6" />
    <text
      x="115"
      y="90"
      textAnchor="middle"
      fill="white"
      fontSize="12"
      fontWeight="bold"
      fontFamily="Arial, sans-serif"
    >
      3
    </text>
    <rect x="130" y="80" width="15" height="12" rx="3" fill="#E5E7EB" />
  </svg>
);
