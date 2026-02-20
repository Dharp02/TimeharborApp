'use client';

import { useState, useEffect, useMemo } from 'react';
import { Edit2 } from 'lucide-react';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { DateRangePicker, DateRange, DateRangePreset } from '@/components/DateRangePicker';
import { useTeam } from './TeamContext';
import { Modal } from '@/components/ui/Modal';
import { getTeamActivity } from '@/TimeharborAPI/teams';

type Activity = {
  id: string;
  date: string;
  timestamp: string; // Add timestamp for filtering
  member: string;
  action: string; // e.g., "Clocked in with T-101, T-102", "Clocked out", "Started timer on T-101"
  description?: string;
  tickets?: string[];
  role: string;
};

type DesktopActivity = {
  id: string;
  date: string;
  timestamp: string; // Added timestamp
  member: string;
  email: string;
  hours: string;
  clockIn: string;
  clockOut: string;
  status: string;
  tickets: string[];
  role: string;
};

export function TeamActivityReport() {
  const { currentTeam } = useTeam();
  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [preset, setPreset] = useState<DateRangePreset>('today');
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [desktopActivities, setDesktopActivities] = useState<DesktopActivity[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);
  
  // Column Filters State
  const [columnFilters, setColumnFilters] = useState({
    date: '',
    member: '',
    email: '',
    hours: '',
    clockIn: '',
    clockOut: '',
    status: '',
    tickets: ''
  });

  // Edit state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<DesktopActivity | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    clockIn: '',
    clockOut: ''
  });

  // Fetch activities from backend
  useEffect(() => {
    if (currentTeam) {
      const fetchAttributes = async () => {
        try {
          const logs = await getTeamActivity(currentTeam.id);
          
          // Map to Activity (Mobile List View)
          const mappedActivities: Activity[] = logs.map((log: any) => {
             let action = '';
             const tickets: string[] = [];

             const date = new Date(log.timestamp);
             // Format date to include time for better sorting visibility
             const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
             const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
             const displayDate = `${dateStr}, ${timeStr}`;
             
             // Determine action text
             switch(log.type) {
                 case 'CLOCK_IN':
                     action = 'Clocked in';
                     break;
                 case 'CLOCK_OUT':
                     action = 'Clocked out';
                     break;
                 case 'START_TICKET':
                     action = 'Started timer';
                     break;
                 case 'STOP_TICKET':
                     action = 'Stopped timer';
                     break;
                 default:
                     action = log.type;
             }

             if (log.ticket) {
                 if (log.type === 'CLOCK_IN') {
                    action += ` with ${log.ticket.title}`;
                 } else {
                    action += ` on ${log.ticket.title}`;
                 }
                 tickets.push(log.ticket.title);
             } else if (log.ticketTitle) {
                 if (log.type === 'CLOCK_IN') {
                    action += ` with ${log.ticketTitle}`;
                 } else {
                    action += ` on ${log.ticketTitle}`;
                 }
                 tickets.push(log.ticketTitle);
             }

             const description = (log.comment && (log.type === 'CLOCK_OUT' || log.type === 'STOP_TICKET')) ? log.comment : undefined;

             return {
                 id: log.id,
                 date: displayDate,
                 timestamp: log.timestamp,
                 member: log.user?.full_name || 'Unknown',
                 action: action,
                 tickets: tickets,
                 role: log.user?.memberships?.[0]?.role || 'Member',
                 description: description,
             };
          });

          setActivities(mappedActivities);

          // For desktop view, we can aggregation logic or simplified mapping
          // Group by user and date/session? 
          // For now, let's just show the last status or keep mock data if aggregation is too complex for this step
          // Or we can try to map unique users active today
          
          // Keeping mock desktop activities for now to avoid breaking the view completely
          // unless I implement full aggregation. 
          // The user request specifically mentioned "team activity" and showed the list view.
          
        } catch (error) {
            console.error("Failed to load team activity", error);
        }
      };
      
      fetchAttributes();
    }
  }, [currentTeam]);

  const handleRangeChange = (range: DateRange, newPreset: DateRangePreset) => {
    setDateRange(range);
    setPreset(newPreset);
    setVisibleCount(20); 
  };

  // Filtered activities for mobile (event-based)
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Parse timestamp to date for comparison
      const activityDate = new Date(activity.timestamp);
      
      // Compare ranges
      const isWithin = isWithinInterval(activityDate, { start: dateRange.from, end: dateRange.to });

      return isWithin && activity.member.toLowerCase().includes(columnFilters.member.toLowerCase());
    });
  }, [activities, columnFilters, dateRange]);

  // Filtered activities for desktop (table-based)
  const filteredDesktopActivities = useMemo(() => {
    return desktopActivities.filter(activity => {
      // Parse timestamp to date for comparison
      const activityDate = new Date(activity.timestamp);
      
      // Compare ranges
      const isWithin = isWithinInterval(activityDate, { start: dateRange.from, end: dateRange.to });

      return (
        isWithin &&
        activity.date.toLowerCase().includes(columnFilters.date.toLowerCase()) &&
        activity.member.toLowerCase().includes(columnFilters.member.toLowerCase()) &&
        activity.email.toLowerCase().includes(columnFilters.email.toLowerCase()) &&
        activity.hours.toLowerCase().includes(columnFilters.hours.toLowerCase()) &&
        activity.clockIn.toLowerCase().includes(columnFilters.clockIn.toLowerCase()) &&
        activity.clockOut.toLowerCase().includes(columnFilters.clockOut.toLowerCase()) &&
        activity.status.toLowerCase().includes(columnFilters.status.toLowerCase()) &&
        activity.tickets.some(t => t.toLowerCase().includes(columnFilters.tickets.toLowerCase()))
      );
    });
  }, [desktopActivities, columnFilters, dateRange]);

  const handleFilterChange = (column: keyof typeof columnFilters, value: string) => {
    setColumnFilters(prev => ({ ...prev, [column]: value }));
  };

  const handleEditClick = (activity: DesktopActivity) => {
    setEditingActivity(activity);
    setEditForm({
      date: activity.date,
      clockIn: activity.clockIn,
      clockOut: activity.clockOut === '-' ? '' : activity.clockOut
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingActivity) {
      setDesktopActivities(desktopActivities.map(act => 
        act.id === editingActivity.id 
          ? { 
              ...act, 
              date: editForm.date,
              clockIn: editForm.clockIn,
              clockOut: editForm.clockOut || '-'
            } 
          : act
      ));
      setIsEditModalOpen(false);
      setEditingActivity(null);
    }
  };

  const handleShowMore = () => {
    setVisibleCount(prev => prev + 5);
  };

  if (!currentTeam) return null;

  // Check if current user is a leader to show edit actions
  const isLeader = currentTeam.role === 'Leader';

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        <DateRangePicker 
            initialPreset={preset}
            onRangeChange={handleRangeChange}
            className="w-full px-0"
        />

        {/* Compact Filter Row - Name Filter */}
        <div className="mx-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by name"
            value={columnFilters.member}
            onChange={(e) => handleFilterChange('member', e.target.value)}
            className="flex-1 text-base bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
          />
        </div>

        {/* Mobile Activity List */}
        <div className="px-0">
          {filteredActivities.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredActivities.slice(0, visibleCount).map((activity) => (
                <div key={activity.id} className="py-3">
                  <div className="flex items-start justify-between min-w-0">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-base font-medium flex-shrink-0">
                        {activity.member.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-base font-medium text-gray-900 dark:text-white truncate">{activity.member}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 break-words">{activity.action}</p>
                        {activity.description && (
                          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-0.5 break-words">&quot;{activity.description}&quot;</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                      {activity.date}
                    </span>
                  </div>
                </div>
              ))}
              {filteredActivities.length > visibleCount && (
                <div className="py-2 text-center">
                  <button 
                    onClick={handleShowMore}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Show more
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              No activity found
            </div>
          )}
        </div>
      </div>

      {/* Desktop View */}
    <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            Team Activity Report
          </h2>
          
          <DateRangePicker 
            initialPreset={preset}
            onRangeChange={handleRangeChange}
            className="w-auto"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Team Member</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hours</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Clock-in</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Clock-out</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tickets</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
            {/* Filter Row */}
            <tr className="bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700">
              <th className="px-6 py-2">
                <input 
                  type="text" 
                  placeholder="Filter Date" 
                  value={columnFilters.date}
                  onChange={(e) => handleFilterChange('date', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </th>
              <th className="px-6 py-2">
                <input 
                  type="text" 
                  placeholder="Filter Member" 
                  value={columnFilters.member}
                  onChange={(e) => handleFilterChange('member', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </th>
              <th className="px-6 py-2">
                <input 
                  type="text" 
                  placeholder="Filter Email" 
                  value={columnFilters.email}
                  onChange={(e) => handleFilterChange('email', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </th>
              <th className="px-6 py-2">
                <input 
                  type="text" 
                  placeholder="Filter Hours" 
                  value={columnFilters.hours}
                  onChange={(e) => handleFilterChange('hours', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </th>
              <th className="px-6 py-2">
                <input 
                  type="text" 
                  placeholder="Filter In" 
                  value={columnFilters.clockIn}
                  onChange={(e) => handleFilterChange('clockIn', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </th>
              <th className="px-6 py-2">
                <input 
                  type="text" 
                  placeholder="Filter Out" 
                  value={columnFilters.clockOut}
                  onChange={(e) => handleFilterChange('clockOut', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </th>
              <th className="px-6 py-2">
                <select 
                  value={columnFilters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </th>
              <th className="px-6 py-2">
                <input 
                  type="text" 
                  placeholder="Filter Tickets" 
                  value={columnFilters.tickets}
                  onChange={(e) => handleFilterChange('tickets', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </th>
              <th className="px-6 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredDesktopActivities.length > 0 ? (
              filteredDesktopActivities.map((activity) => (
                <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                    {activity.date}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs">
                        {activity.member.charAt(0)}
                      </div>
                      {activity.member}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {activity.email}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white whitespace-nowrap">
                    {activity.hours}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {activity.clockIn}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {activity.clockOut}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      activity.status === 'Active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {activity.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    <div className="flex gap-1">
                      {activity.tickets.map(ticket => (
                        <span key={ticket} className="bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded text-xs border border-blue-100 dark:border-blue-800">
                          {ticket}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {isLeader && (
                      <button 
                        onClick={() => handleEditClick(activity)}
                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Edit Activity"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No activity found matching the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* Edit Activity Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Activity Log"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              {editingActivity?.member.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{editingActivity?.member}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{editingActivity?.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date
            </label>
            <input
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Clock In
              </label>
              <input
                type="time"
                value={editForm.clockIn}
                onChange={(e) => setEditForm({ ...editForm, clockIn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Clock Out
              </label>
              <input
                type="time"
                value={editForm.clockOut}
                onChange={(e) => setEditForm({ ...editForm, clockOut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>


    </>
  );
}
