const ProductsSkeleton = () => {
  return (
    <div className="min-h-[100dvh] bg-[var(--surface,#ffffff)]">
      <div className="mx-4 md:mx-10 lg:mx-20 animate-pulse">
        <div className="mt-6 rounded-2xl border px-4 py-3 bg-white/70"
             style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="h-4 w-2/3 rounded bg-gray-200" />
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="h-8 w-44 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-200" />
          </div>

          <div className="h-10 w-36 rounded-xl bg-gray-200" />
        </div>

        <div className="mt-8 pb-16">
          <div className="grid gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-3">
              <div
                className="rounded-2xl border bg-white/70 backdrop-blur p-4"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-16 rounded bg-gray-200" />
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-10 w-full rounded-xl bg-gray-200"
                    />
                  ))}
                </div>
              </div>
            </aside>

            <main className="lg:col-span-9">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col h-[420px]"
                    style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  >
                    <div
                      className="border-b bg-white"
                      style={{ borderColor: "rgba(0,0,0,0.06)" }}
                    >
                      <div className="h-[190px] w-full bg-gray-200" />
                    </div>

                    <div className="p-4 flex flex-col flex-1 min-h-0">
                      <div className="h-8 mb-3 rounded bg-gray-200" />

                      <div className="space-y-2">
                        <div className="h-5 w-[85%] rounded bg-gray-200" />
                        <div className="h-5 w-[65%] rounded bg-gray-200" />
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="h-4 w-full rounded bg-gray-200" />
                        <div className="h-4 w-[85%] rounded bg-gray-200" />
                      </div>

                      <div className="mt-auto pt-3 flex items-center justify-between gap-3">
                        <div className="h-6 w-16 rounded bg-gray-200" />
                        <div className="h-10 w-24 rounded-xl bg-gray-200" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsSkeleton;