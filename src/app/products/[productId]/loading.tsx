const Loading = () => {
  return (
    <div className="min-h-[100dvh] bg-[var(--surface,#ffffff)]">
      <div className="mx-4 md:mx-10 lg:mx-20 animate-pulse">
        <div
          className="mt-6 rounded-2xl border px-4 py-3 text-sm bg-white/70"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <div className="h-4 w-2/3 rounded bg-gray-200" />
        </div>

        <div className="pt-8 pb-14">
          <div className="h-4 w-36 rounded bg-gray-200" />

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div
                className="rounded-3xl border bg-white/70 backdrop-blur shadow-sm overflow-hidden"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              >
                <div className="w-full bg-black/5">
                  <div className="relative w-full overflow-hidden h-[280px] sm:h-[360px] md:h-[600px]">
                    <div className="absolute inset-0 p-6">
                      <div className="h-full w-full rounded-2xl bg-gray-200" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div
                className="rounded-3xl border bg-white/70 backdrop-blur shadow-sm p-6 md:p-7"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="h-7 md:h-8 w-[75%] rounded bg-gray-200" />
                    <div className="mt-3 space-y-2">
                      <div className="h-4 w-full rounded bg-gray-200" />
                      <div className="h-4 w-[85%] rounded bg-gray-200" />
                    </div>
                  </div>
                  <div className="h-7 md:h-8 w-20 rounded bg-gray-200 shrink-0" />
                </div>

                <div className="mt-5">
                  <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
                  <div className="flex flex-wrap gap-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-8 w-20 rounded-full bg-gray-200" />
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
                  <div
                    className="inline-flex rounded-xl border bg-white/70 overflow-hidden"
                    style={{ borderColor: "rgba(0,0,0,0.10)" }}
                  >
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-10 w-10 bg-gray-200" />
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  <div className="h-11 w-full rounded-xl bg-gray-200" />
                  <div className="h-11 w-full rounded-xl bg-gray-200" />
                </div>

                <div className="mt-4 h-3 w-40 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Loading;