export default function PageLoading() {
  const shimmer = "color-mix(in srgb, var(--text-primary, #000) 4%, transparent)";
  const shimmerStrong = "color-mix(in srgb, var(--text-primary, #000) 5%, transparent)";
  const border = "color-mix(in srgb, var(--text-primary, #000) 6%, transparent)";
  const card = "color-mix(in srgb, var(--surface, #fff) 90%, var(--surface-alt, #f8f9fb))";

  return (
    <div
      className="min-h-screen animate-pulse"
      style={{ background: "var(--surface, #ffffff)" }}
    >
      {/* Navbar skeleton */}
      <div
        className="h-16 border-b"
        style={{
          borderColor: border,
          background: "color-mix(in srgb, var(--surface, #fff) 80%, transparent)",
        }}
      />

      {/* Page header skeleton */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-24 md:pt-28 pb-16">
        <div className="max-w-2xl mb-10 space-y-3">
          <div className="h-9 w-2/3 rounded-lg" style={{ background: shimmerStrong }} />
          <div className="h-5 w-1/2 rounded-lg" style={{ background: shimmer }} />
        </div>

        {/* Content grid skeleton */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border overflow-hidden flex flex-col h-[420px]"
              style={{ borderColor: border, background: card }}
            >
              <div className="border-b" style={{ borderColor: border }}>
                <div className="h-[190px] w-full" style={{ background: shimmer }} />
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="h-7 mb-3 rounded-lg w-20" style={{ background: shimmer }} />
                <div className="space-y-2">
                  <div className="h-5 w-[85%] rounded-lg" style={{ background: shimmer }} />
                  <div className="h-5 w-[60%] rounded-lg" style={{ background: shimmer }} />
                </div>
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <div className="h-6 w-16 rounded-lg" style={{ background: shimmer }} />
                  <div className="h-10 w-20 rounded-full" style={{ background: shimmer }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
