'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, Download, Filter, MoreHorizontal, Edit2, Check, X, Search } from 'lucide-react';
import { useTeam } from './TeamContext';
import { Modal } from '@/components/ui/Modal';

type Activity = {
  id: string;
  date: string;
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
  const [dateRange, setDateRange] = useState('Today');
  const [customStartDate, setCustomStartDate] = useState('2025-12-26');
  const [customEndDate, setCustomEndDate] = useState('2025-12-26');
  const [activities, setActivities] = useState<Activity[]>([]);
  
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
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    clockIn: '',
    clockOut: ''
  });

  // Generate mock data based on current team members
  useEffect(() => {
    if (currentTeam) {
      const mockActivities = currentTeam.members
        .filter(member => member.role !== 'Leader') // Filter out leaders
        .map((member, index) => ({
          id: `act-${index}`,
          date: '2025-12-26',
          member: member.name,
          email: `${member.name.toLowerCase().replace(' ', '.')}@example.com`,
          hours: '7h 30m',
          clockIn: '09:00',
          clockOut: member.status === 'online' ? '-' : '17:30',
          status: member.status === 'online' ? 'Active' : 'Completed',
          tickets: ['T-101', 'T-102'],
          role: member.role
        }));
      setActivities(mockActivities);
    }
  }, [currentTeam]);

  const filters = ['Today', 'Yesterday', 'Last 7 Days', 'This Week', 'Last 14 Days'];

  // Filtered activities based on column filters
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      return (
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
  }, [activities, columnFilters]);

  const handleFilterChange = (column: keyof typeof columnFilters, value: string) => {
    setColumnFilters(prev => ({ ...prev, [column]: value }));
  };

  const handleEditClick = (activity: Activity) => {
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
      setActivities(activities.map(act => 
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

  if (!currentTeam) return null;

  // Check if current user is a leader to show edit actions
  const isLeader = currentTeam.role === 'Leader';

  return (
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
          
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setDateRange(filter)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  dateRange === filter
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">Custom Date Range:</span>
            <div className="relative">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="pl-3 pr-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <span>to</span>
            <div className="relative">
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="pl-3 pr-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors">
              Apply
            </button>
          </div>
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
            {filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => (
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
    </div>
  );
}
