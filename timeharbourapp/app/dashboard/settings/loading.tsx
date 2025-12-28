export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pt-8 md:pt-0 animate-pulse">
      <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded border-b border-gray-200 dark:border-gray-700 pb-4 mb-4"></div>
        
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-xl mt-6"></div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
      </div>
    </div>
  );
}
