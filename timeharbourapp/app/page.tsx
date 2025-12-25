'use client';

import { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header - TimeHarbour branding */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm pt-12">
        <div className="px-4 py-4 md:py-6 md:px-8">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400 md:text-center ">
            TimeHarbour
          </h1>
        </div>
      </header>
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
        <div className="container mx-auto px-4 py-6">
          {activeTab === 'home' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Welcome to TimeHarbour
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
                    Quick Stats
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your time tracking overview
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
                    Recent Activity
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Latest clock-ins and updates
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
                    Notifications
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Important alerts and messages
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'teams' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Teams</h2>
              <p className="text-gray-600 dark:text-gray-400">Manage your teams here</p>
            </div>
          )}
          {activeTab === 'clockin' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Clock In/Out</h2>
              <div className="flex justify-center">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-12 rounded-full text-xl shadow-lg transition-colors">
                  Clock In
                </button>
              </div>
            </div>
          )}
          {activeTab === 'ticket' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Tickets</h2>
              <p className="text-gray-600 dark:text-gray-400">Your tickets and requests</p>
            </div>
          )}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Profile</h2>
              <p className="text-gray-600 dark:text-gray-400">Manage your profile settings</p>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation Bar - Mobile optimized */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg md:hidden pb-safe">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === 'home'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span className="text-xs mt-1">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === 'teams'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="text-xs mt-1">Teams</span>
          </button>

          <button
            onClick={() => setActiveTab('clockin')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === 'clockin'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs mt-1">Clock</span>
          </button>

          <button
            onClick={() => setActiveTab('ticket')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === 'ticket'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
            <span className="text-xs mt-1">Ticket</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === 'profile'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-xs mt-1">Profile</span>
          </button>
        </div>
      </nav>

      {/* Desktop Navigation - Hidden on mobile */}
      <nav className="hidden md:block fixed bottom-8 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg px-4">
        <div className="flex items-center space-x-2 h-14">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-6 py-2 rounded-full transition-all ${
              activeTab === 'home'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-6 py-2 rounded-full transition-all ${
              activeTab === 'teams'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Teams
          </button>
          <button
            onClick={() => setActiveTab('clockin')}
            className={`px-6 py-2 rounded-full transition-all ${
              activeTab === 'clockin'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Clock In/Out
          </button>
          <button
            onClick={() => setActiveTab('ticket')}
            className={`px-6 py-2 rounded-full transition-all ${
              activeTab === 'ticket'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Ticket
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-2 rounded-full transition-all ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Profile
          </button>
        </div>
      </nav>
    </div>
  );
}

