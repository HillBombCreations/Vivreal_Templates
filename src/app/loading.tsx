export default function HomeLoading() {
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

      {/* Hero section skeleton */}
      <div className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl space-y-4">
            <div className="h-12 w-3/4 rounded-lg" style={{ background: shimmerStrong }} />
            <div className="h-12 w-1/2 rounded-lg" style={{ background: shimmerStrong }} />
            <div className="h-6 w-2/3 rounded-lg mt-2" style={{ background: shimmer }} />
          </div>
          <div className="mt-8 flex gap-3">
            <div className="h-12 w-36 rounded-full" style={{ background: shimmerStrong }} />
            <div className="h-12 w-36 rounded-full border" style={{ borderColor: border }} />
          </div>
        </div>
      </div>

      {/* Product showcase skeleton */}
      <div style={{ background: "var(--surface-alt, #f8f9fb)" }} className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl mb-12 space-y-3">
            <div className="h-10 w-2/3 rounded-lg" style={{ background: shimmerStrong }} />
            <div className="h-5 w-1/2 rounded-lg" style={{ background: shimmer }} />
          </div>
          <div
            className="h-[400px] rounded-2xl border"
            style={{ borderColor: border, background: card }}
          />
        </div>
      </div>

      {/* Offerings skeleton */}
      <div className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl mb-12 space-y-3">
            <div className="h-10 w-1/2 rounded-lg" style={{ background: shimmerStrong }} />
            <div className="h-5 w-1/3 rounded-lg" style={{ background: shimmer }} />
          </div>
          <div className="hidden lg:grid grid-cols-12 gap-8">
            <div className="col-span-5 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] rounded-2xl border"
                  style={{ borderColor: border, background: card }}
                />
              ))}
            </div>
            <div className="col-span-7">
              <div
                className="h-[500px] rounded-2xl border"
                style={{ borderColor: border, background: card }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
