const Loading = () => {
  return (
    <main className="pt-24 md:pt-32 pb-20 md:pb-32 max-w-4xl mx-auto px-4 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-8"></div>
      <div className="h-8 md:h-10 bg-gray-300 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
      <div className="w-full h-64 md:h-80 bg-gray-200 rounded-2xl mb-8"></div>
      <div className="space-y-3 mb-10">
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-11/12"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    </main>
  );
}

export default Loading;