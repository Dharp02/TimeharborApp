'use client';

import { Clock, Ticket, Users, Calendar } from 'lucide-react';

export default function DashboardSummary() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
      <div className="p-3 md:p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex flex-col justify-between">
        <div>
          <h3 className="text-xs md:text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1 md:mb-2 truncate">
            Total Hours
          </h3>
          <p className="text-lg md:text-3xl font-bold text-blue-600 dark:text-blue-400 truncate">2h 15m</p>
        </div>
        <p className="text-[10px] md:text-sm text-blue-600/60 dark:text-blue-400/60 mt-1 truncate">Today</p>
      </div>

      <div className="p-3 md:p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex flex-col justify-between">
        <div>
          <h3 className="text-xs md:text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-1 md:mb-2 truncate">
            This Week
          </h3>
          <p className="text-lg md:text-3xl font-bold text-indigo-600 dark:text-indigo-400 truncate">12h 30m</p>
        </div>
        <p className="text-[10px] md:text-sm text-indigo-600/60 dark:text-indigo-400/60 mt-1 truncate">Total hours</p>
      </div>
      
      <div className="p-3 md:p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 flex flex-col justify-between">
        <div>
          <h3 className="text-xs md:text-lg font-semibold text-purple-900 dark:text-purple-100 mb-1 md:mb-2 truncate">
            Open Tickets
          </h3>
          <p className="text-lg md:text-3xl font-bold text-purple-600 dark:text-purple-400 truncate">3</p>
        </div>
        <p className="text-[10px] md:text-sm text-purple-600/60 dark:text-purple-400/60 mt-1 truncate">Assigned to you</p>
      </div>

      <div className="p-3 md:p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 flex flex-col justify-between">
        <div>
          <h3 className="text-xs md:text-lg font-semibold text-green-900 dark:text-green-100 mb-1 md:mb-2 truncate">
            Team Members
          </h3>
          <p className="text-lg md:text-3xl font-bold text-green-600 dark:text-green-400 truncate">5</p>
        </div>
        <p className="text-[10px] md:text-sm text-green-600/60 dark:text-green-400/60 mt-1 truncate">Online now</p>
      </div>
    </div>
  );
}
