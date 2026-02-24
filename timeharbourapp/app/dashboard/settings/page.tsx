'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { auth } from '@/TimeharborAPI';
import { LogOut, User, Mail, FileText, Calendar, ChevronRight, X, Users, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { db } from '@/TimeharborAPI/db';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<'calendar' | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('Are you sure you want to clear all local data? This will not log you out, but will remove offline data until it syncs again.')) {
      return;
    }

    setIsClearingCache(true);
    try {
      // 1. Clear IndexedDB (except auth if it was there, but our db is mostly data)
      await db.transaction('rw', db.activityLogs, db.offlineMutations, async () => {
        await db.activityLogs.clear();
        await db.offlineMutations.clear();
      });

      // 2. Clear LocalStorage (preserve auth tokens)
      const authKeys = ['supabase.auth.token', 'sb-api-auth-token']; // Add any specific auth keys here
      const preservedData: Record<string, string> = {};
      
      // Save auth data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('auth') || key.includes('supabase') || key.includes('token'))) {
          preservedData[key] = localStorage.getItem(key) || '';
        }
      }

      // Clear all
      localStorage.clear();

      // Restore auth data
      Object.entries(preservedData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      // 3. Clear SessionStorage
      sessionStorage.clear();

      alert('Cache cleared successfully!');
      
      // Reload to re-fetch fresh data
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache. Please try again.');
    } finally {
      setIsClearingCache(false);
    }
  };

  const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => {
    if (!isMounted) return null;
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl animate-in slide-in-from-bottom-10 duration-300">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="p-4 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden -mt-2 -ml-7.5 px-0 py-2 space-y-0 w-[calc(100%+56px)]">

          <Link 
            href="/dashboard/settings/profile"
            className="flex items-center justify-between px-6 py-4 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="p-0">
                <User className="w-7 h-7 text-gray-900 dark:text-white" strokeWidth={1.5} />
              </div>
              <span className="font-medium text-lg text-gray-900 dark:text-white">My Profile</span>
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
          </Link>

          <Link 
            href="/dashboard/settings/teams"
            className="flex items-center justify-between px-6 py-4 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="p-0">
                <Users className="w-7 h-7 text-gray-900 dark:text-white" strokeWidth={1.5} />
              </div>
              <span className="font-medium text-lg text-gray-900 dark:text-white">Team Settings</span>
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
          </Link>

          <Link 
            href="/dashboard/settings/timesheet"
            className="flex items-center justify-between px-6 py-4 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="p-0">
                <FileText className="w-7 h-7 text-gray-900 dark:text-white" strokeWidth={1.5} />
              </div>
              <span className="font-medium text-lg text-gray-900 dark:text-white">My Timesheet</span>
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
          </Link>

          <button 
            onClick={() => setActiveModal('calendar')}
            className="w-full flex items-center justify-between px-6 py-4 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="p-0">
                <Calendar className="w-7 h-7 text-gray-900 dark:text-white" strokeWidth={1.5} />
              </div>
              <span className="font-medium text-lg text-gray-900 dark:text-white">Calendar</span>
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
          </button>

          <button 
            onClick={handleClearCache}
            disabled={isClearingCache}
            className="w-full flex items-center justify-between px-6 py-4 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="p-0">
                <Trash2 className="w-7 h-7 text-gray-900 dark:text-white" strokeWidth={1.5} />
              </div>
              <span className="font-medium text-lg text-gray-900 dark:text-white">
                {isClearingCache ? 'Clearing...' : 'Clear Cache'}
              </span>
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
          </button>

          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-6 py-4 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <div className="p-0">
              <LogOut className="w-7 h-7 text-red-600 dark:text-red-400" strokeWidth={1.5} />
            </div>
            <span className="font-medium text-lg text-red-600 dark:text-red-400">Log Out</span>
          </button>
      </div>

      {/* Desktop View - Keeping original settings layout */}
      <div className="hidden md:block max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-4">
            Profile Information
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
                <p className="font-medium text-gray-900 dark:text-white">{user?.full_name || 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <Mail className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Email Address</p>
                <p className="font-medium text-gray-900 dark:text-white">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-4">
            App Data
          </h2>
          <div className="space-y-4">
            <button 
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-xl transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <Trash2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {isClearingCache ? 'Clearing Cache...' : 'Clear Cache'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Clear local data and offline storage</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeModal === 'calendar' && (
        <Modal title="Calendar" onClose={() => setActiveModal(null)}>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Calendar Coming Soon</h3>
            <p className="text-gray-500 dark:text-gray-400">
              We're working on a new calendar view to help you manage your schedule better.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
