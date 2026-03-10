'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { User, FileText, Image as ImageIcon, Edit, Share2 } from 'lucide-react';
import * as API from '@/TimeharborAPI/dashboard';
import { auth } from '@/TimeharborAPI';
import { Modal } from '@/components/ui/Modal';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
  const { user } = useAuth();
  
  // Local state for fetching data directly
  const [memberData, setMemberData] = useState<API.MemberActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Profile State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGithub, setEditGithub] = useState('');
  const [editLinkedin, setEditLinkedin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Function to fetch member activity
  const fetchData = async () => {
    if (!user?.id) return;
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

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const handleEditClick = () => {
    if (memberData?.member) {
      setEditName(memberData.member.name);
      setEditEmail(memberData.member.email || '');
      setEditGithub(memberData.member.github || '');
      setEditLinkedin(memberData.member.linkedin || '');
      setSaveError(null);
      setIsEditModalOpen(true);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const { error } = await auth.updateProfile({
        full_name: editName,
        email: editEmail,
        github: editGithub || undefined,
        linkedin: editLinkedin || undefined
      });

      if (error) {
        setSaveError(error.message);
      } else {
        setIsEditModalOpen(false);
        // Refresh data to show updates
        fetchData();
      }
    } catch (err) {
      setSaveError('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

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
    <div className="mt-2 px-0 pb-4 pt-0 space-y-2 md:mt-0 md:p-4 md:space-y-6">
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
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-slate-500'}`} />
                  {member.status === 'online' ? 'Online' : 'Offline'}
                </span>
                {(member.github || member.linkedin) && (
                  <div className="flex items-center gap-3 border-l border-gray-200 dark:border-gray-700 pl-3">
                    {member.github && (
                      <Link
                        href={member.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        aria-label="GitHub Profile"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </Link>
                    )}
                    {member.linkedin && (
                      <Link
                        href={member.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0077b5] hover:opacity-80 transition-opacity"
                        aria-label="LinkedIn Profile"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section - Custom for Profile Page */}
        <div className="space-y-4">
          {/* Profile Actions - Row 1 */}
          <div className="flex gap-3 md:gap-4">
            <button 
              onClick={handleEditClick} 
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

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your.email@example.com"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Changing email may require re-verification.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              GitHub URL
            </label>
            <input
              type="url"
              value={editGithub}
              onChange={(e) => setEditGithub(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://github.com/username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              LinkedIn URL
            </label>
            <input
              type="url"
              value={editLinkedin}
              onChange={(e) => setEditLinkedin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://linkedin.com/in/username"
            />
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
