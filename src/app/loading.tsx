const HeroSkeleton = () => {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-white pt-20 md:pt-28 pb-16 md:pb-24">
      <div className="mx-5 md:mx-20 lg:mx-40 min-h-[calc(100svh-6rem)] flex items-center">
        <div className="grid w-full items-center gap-10 md:gap-14 lg:gap-16 md:grid-cols-2 animate-pulse">
          <div className="order-1 text-center md:text-left">
            <div className="h-3 w-24 mx-auto md:mx-0 rounded bg-gray-200" />

            <div className="mt-4 space-y-3">
              <div className="h-10 md:h-14 w-[85%] mx-auto md:mx-0 rounded bg-gray-200" />
              <div className="h-10 md:h-14 w-[70%] mx-auto md:mx-0 rounded bg-gray-200" />
            </div>

            <div className="mt-5 space-y-2 max-w-xl mx-auto md:mx-0">
              <div className="h-4 w-full rounded bg-gray-200" />
              <div className="h-4 w-[92%] rounded bg-gray-200" />
              <div className="h-4 w-[75%] rounded bg-gray-200" />
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start">
              <div className="h-11 w-44 rounded-xl bg-gray-200" />
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2 max-w-xl mx-auto md:mx-0">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-gray-200" />
              ))}
            </div>
          </div>

          <div className="order-2">
            <div className="relative rounded-3xl border shadow-sm bg-white/60 border-black/10">
              <div className="relative w-full h-[320px] sm:h-[380px] md:h-[520px] lg:h-[620px] flex items-center justify-center">
                <div className="h-full w-full rounded-2xl bg-gray-200" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center md:justify-end gap-2">
              <div className="h-3 w-32 rounded bg-gray-200 opacity-80" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSkeleton;