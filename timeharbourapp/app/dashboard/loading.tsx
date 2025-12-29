export default function DashboardLoading() {
  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-pulse">
      {/* Dashboard Summary Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-3 md:p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-32">
              <div>
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded mb-2"></div>
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-600 rounded"></div>
              </div>
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-600 rounded mt-1"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Open Tickets Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 dark:bg-gray-700/50 rounded-lg w-full"></div>
          ))}
        </div>
      </div>
      
      {/* Recent Activity Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
