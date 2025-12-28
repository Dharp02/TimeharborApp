export default function TeamsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div>
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
