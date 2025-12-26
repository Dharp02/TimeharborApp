export default function ClockInPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Clock In</h1>
      <div className="flex flex-col items-center justify-center space-y-6 py-12">
        <div className="w-48 h-48 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-4 border-blue-500 dark:border-blue-400 shadow-xl cursor-pointer hover:scale-105 transition-transform">
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">START</span>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Tap to clock in for the day</p>
      </div>
    </div>
  );
}
