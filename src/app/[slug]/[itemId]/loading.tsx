export default function ItemLoading() {
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

      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-24 md:pt-28 pb-16">
        {/* Back button skeleton */}
        <div className="h-5 w-32 rounded-lg mb-8" style={{ background: shimmer }} />

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Image skeleton */}
          <div className="lg:col-span-7">
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ borderColor: border, background: card }}
            >
              <div
                className="h-[320px] sm:h-[400px] md:h-[520px] lg:h-[600px]"
                style={{ background: shimmer }}
              />
            </div>
          </div>

          {/* Details skeleton */}
          <div className="lg:col-span-5">
            <div
              className="rounded-2xl border p-6 md:p-8 space-y-6"
              style={{ borderColor: border, background: card }}
            >
              <div className="space-y-3">
                <div className="h-8 w-3/4 rounded-lg" style={{ background: shimmerStrong }} />
                <div className="h-8 w-1/3 rounded-lg" style={{ background: shimmerStrong }} />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded-lg" style={{ background: shimmer }} />
                <div className="h-4 w-[80%] rounded-lg" style={{ background: shimmer }} />
              </div>
              <div className="space-y-3">
                <div className="h-5 w-16 rounded-lg" style={{ background: shimmer }} />
                <div className="flex gap-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-9 w-16 rounded-full" style={{ background: shimmer }} />
                  ))}
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div className="h-12 w-full rounded-full" style={{ background: shimmerStrong }} />
                <div
                  className="h-12 w-full rounded-full border"
                  style={{ borderColor: border }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
