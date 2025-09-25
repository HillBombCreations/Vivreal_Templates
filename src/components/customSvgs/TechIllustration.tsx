export const TechIllustration = () => (
  <svg
    viewBox="0 0 400 400"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full text-slate-800"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Server Stack */}
    <rect x="80" y="280" width="240" height="40" rx="6" />
    <rect x="80" y="230" width="240" height="40" rx="6" />
    <rect x="80" y="180" width="240" height="40" rx="6" />
    <circle cx="100" cy="200" r="4" fill="currentColor" />
    <circle cx="100" cy="250" r="4" fill="currentColor" />
    <circle cx="100" cy="300" r="4" fill="currentColor" />

    {/* Shield */}
    <path d="M200 150c20 0 40-12 40-12s0 32-10 48-30 20-30 20-20-4-30-20-10-48-10-48 20 12 40 12z" />

    {/* Rocket (speed) */}
    <path d="M200 60c10 10 20 40 20 40s-20 10-40 0c0 0 10-30 20-40z" />
    <line x1="200" y1="100" x2="200" y2="120" />
    <line x1="190" y1="120" x2="210" y2="120" />

    {/* Team Collaboration Nodes */}
    <circle cx="60" cy="100" r="10" />
    <circle cx="340" cy="100" r="10" />
    <circle cx="200" cy="30" r="10" />
    <line x1="60" y1="100" x2="200" y2="30" />
    <line x1="340" y1="100" x2="200" y2="30" />

    {/* Background grid lines (optional, subtle) */}
    <line x1="0" y1="360" x2="400" y2="360" strokeOpacity="0.1" />
    <line x1="0" y1="320" x2="400" y2="320" strokeOpacity="0.1" />
    <line x1="0" y1="280" x2="400" y2="280" strokeOpacity="0.1" />
  </svg>
);