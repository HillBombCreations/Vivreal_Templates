export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/40 ${className}`}
    aria-hidden="true"
  />
);

export const ShowSkeletonCard = ({ isMobile }: { isMobile: boolean }) => (
  <div
    className={`flex ${isMobile ? "flex-col" : "flex-row"} rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden`}
    role="status"
    aria-live="polite"
  >
    <div className={`${isMobile ? "w-full h-48 rounded-t-lg" : "w-40 h-auto rounded-l-lg"} overflow-hidden`}>
      <Skeleton className={`${isMobile ? "h-48 w-full" : "h-full min-h-[160px] w-40"}`} />
    </div>

    <div className={`${isMobile ? "p-4" : "flex-1 p-4"}`}>
      <Skeleton className="h-6 w-2/3 mb-3" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-3/4 mb-4" />
      <Skeleton className={`${isMobile ? "w-full max-w-xs" : "w-28"} h-9 rounded`} />
    </div>
  </div>
);

export const PastShowSkeleton = () => (
  <div className="relative overflow-hidden rounded-lg shadow-sm">
    <Skeleton className="w-full h-64" />
  </div>
);