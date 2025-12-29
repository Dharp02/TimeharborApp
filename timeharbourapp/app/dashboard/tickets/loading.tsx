export default function TicketsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex gap-4 overflow-x-auto">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
          ))}
        </div>
        
        <div className="p-4">
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
          
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
                <div className="flex gap-4 mt-3">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
