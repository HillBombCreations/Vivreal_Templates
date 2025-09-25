export const DevelopersIllustration = (
  props: React.SVGProps<SVGSVGElement>
) => {
  // Hub center and radius
  const cx = 80;
  const cy = 60;
  const r = 20;

  // Connected nodes
  const nodes = [
    { x: 40, y: 30 },
    { x: 120, y: 30 },
    { x: 40, y: 90 },
    { x: 120, y: 90 },
  ];

  // Calculate point on circle edge towards node
  function getPointOnCircle(cx: number, cy: number, r: number, nx: number, ny: number) {
    const dx = nx - cx;
    const dy = ny - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return {
      x: cx + (dx / dist) * r,
      y: cy + (dy / dist) * r,
    };
  }

  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Background */}
      <rect width="160" height="120" rx="12" fill="#F9FAFB" />

      {/* Central Hub */}
      <circle cx={cx} cy={cy} r={r} fill="#3B82F6" />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize="12"
        fill="white"
        fontWeight="600"
        fontFamily="Arial, sans-serif"
      >
        Hub
      </text>

      {/* Connecting Lines below nodes */}
      {nodes.map(({ x, y }, i) => {
        const { x: edgeX, y: edgeY } = getPointOnCircle(cx, cy, r, x, y);
        return (
          <line
            key={i}
            x1={edgeX}
            y1={edgeY}
            x2={x}
            y2={y}
            stroke="#9CA3AF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}

      {/* Connected Nodes rectangles */}
      {nodes.map(({ x, y }, i) => (
        <rect
          key={i}
          x={x - 15}
          y={y - 12}
          width="30"
          height="24"
          rx="5"
          fill="#E5E7EB"
        />
      ))}

      {/* Connected Nodes circles ON TOP of lines */}
      {nodes.map(({ x, y }, i) => (
        <circle
          key={"circle" + i}
          cx={x}
          cy={y}
          r={6}
          fill="#2563EB"
        />
      ))}

      {/* Border */}
      <rect
        x="1"
        y="1"
        width="158"
        height="118"
        rx="11"
        stroke="#E5E7EB"
        strokeWidth="2"
      />
    </svg>
  );
};
