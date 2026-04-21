'use client';

import { useState, useEffect, useRef } from 'react';
import { Palette } from 'lucide-react';
import { useAppSession } from '@/components/AppSessionProvider';
import { Button } from '@mieweb/ui';
import { resolveBackendAsset } from '@/TimeharborAPI/apiUrl';
import { db } from '@/TimeharborAPI/db';
import { getIdentityUUID } from '@/TimeharborAPI/sync/IdentityManager';
import BrandSwitcher from './BrandSwitcher';

export default function ProfileAvatarMenu() {
  const { user } = useAppSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.image) {
      setAvatarSrc(user.image.startsWith('data:') ? user.image : resolveBackendAsset(user.image) ?? null);
    } else {
      setAvatarSrc(null);
    }
  }, [user?.image]);
  // Get user initials
  const getInitials = () => {
    const name = (user?.name || user?.full_name || '').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Circle */}
      <Button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="relative w-10 h-10 rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center text-white font-semibold text-sm hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors overflow-hidden !p-0"
        aria-label="Profile menu"
        data-walkthrough="profile-avatar"
      >
        {avatarSrc ? (
          <img 
            src={avatarSrc} 
            alt="Profile" 
            className="absolute inset-0 w-full h-full object-cover" 
            onError={() => setAvatarSrc(null)}
          />
        ) : (
          getInitials()
        )}
      </Button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Palette className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="font-medium text-gray-900 dark:text-white">Brand</div>
            </div>
            <BrandSwitcher variant="inline" />
          </div>
        </div>
      )}
    </div>
  );
}
