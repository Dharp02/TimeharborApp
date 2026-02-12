'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { ArrowLeft, User, FileText, Image as ImageIcon, Edit, Share2 } from 'lucide-react';
import Link from 'next/link';
import * as API from '@/TimeharborAPI/dashboard';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const { user } = useAuth();
  
  // Local state for fetching data directly
  const [memberData, setMemberData] = useState<API.MemberActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch member activity
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        // We use the same API as the member dashboard
        const data = await API.getMemberActivity(user.id);
        setMemberData(data);
      } catch (err) {
        console.error('Error fetching profile data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  if (loading || !memberData) {
    return (
       <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
       </div>
    );
  }

  const { member } = memberData;
  const pulseCount = 0; // Hardcoded as per request

  return (
    <div className="px-0 py-4 space-y-4 md:p-4 md:space-y-6">
      <div className="flex items-center gap-4 md:hidden px-4">
        <Link href="/dashboard/settings" className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
      </div>

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Top Section: Profile Header */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl transition-colors">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 text-2xl text-white font-medium">
              <User className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{member.name}</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-3">{member.email}</p>
              <div className="flex gap-3">
                <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-slate-500'}`} />
                  {member.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section - Custom for Profile Page */}
        <div className="space-y-4">
          {/* Profile Actions - Row 1 */}
          <div className="flex gap-3 md:gap-4">
            <button 
              onClick={() => {}} 
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors shadow-lg shadow-blue-500/20"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
            <button 
              onClick={() => {}} 
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-blue-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-2xl transition-colors shadow-lg"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Profile</span>
            </button>
          </div>

          {/* Media & Pulses - Row 2 */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
             {/* Documents */}
             <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl p-3 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center transition-colors">
                 <div className="flex flex-col xl:flex-row xl:items-center gap-1.5 md:gap-3 mb-1 md:mb-2 text-center md:text-left">
                    <div className="p-1.5 md:p-2 bg-orange-500/10 rounded-lg text-orange-500 w-fit mx-auto md:mx-0">
                       <FileText className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">Docs</span>
                 </div>
                 <span className="text-gray-900 dark:text-white font-bold text-lg md:text-2xl text-center md:text-left">0</span>
             </div>

             {/* Images */}
             <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl p-3 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center transition-colors">
                 <div className="flex flex-col xl:flex-row xl:items-center gap-1.5 md:gap-3 mb-1 md:mb-2 text-center md:text-left">
                    <div className="p-1.5 md:p-2 bg-pink-500/10 rounded-lg text-pink-500 w-fit mx-auto md:mx-0">
                       <ImageIcon className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">Images</span>
                 </div>
                 <span className="text-gray-900 dark:text-white font-bold text-lg md:text-2xl text-center md:text-left">0</span>
             </div>

             {/* Pulses */}
             <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl p-3 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center transition-colors">
                <div className="flex flex-col xl:flex-row xl:items-center gap-1.5 md:gap-3 mb-1 md:mb-2 text-center md:text-left">
                   <div className="p-1.5 md:p-2 bg-emerald-500/10 rounded-lg text-emerald-500 w-fit mx-auto md:mx-0">
                      <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                         <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                   </div>
                   <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">Pulses</span>
                </div>
                <p className="text-gray-900 dark:text-white font-bold text-lg md:text-2xl text-center md:text-left">{pulseCount}</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
