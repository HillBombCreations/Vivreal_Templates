const Loading = () => {
  return (
    <main className="h-screen w-full flex justify-center items-center">
      <div className="flex items-center justify-center p-4">
        <div
          className="
            h-20 w-20 border-4 rounded-full
            border-gray-300
            border-t-blue-600
            animate-spin
          "
          role="status"
          aria-label="Loading content"
        >
        </div>
      </div>
    </main>
  );
};
export default Loading;
