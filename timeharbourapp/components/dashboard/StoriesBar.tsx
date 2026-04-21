'use client';

import { useAppSession } from '@/components/AppSessionProvider';
import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@mieweb/ui';
import { resolveBackendAsset } from '@/TimeharborAPI/apiUrl';
import { getProfile } from '@/TimeharborAPI/profile';
import styles from './StoriesBar.module.css';
export default function StoriesBar() {
  const { user } = useAppSession();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then((p) => {
      if (p?.displayName) setProfileName(p.displayName);
      if (p?.avatarBase64) setProfileAvatar(p.avatarBase64);
    }).catch(() => {});
  }, []);

  // Get user initials
  const getUserInitials = (name?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const currentUserInitials = getUserInitials(profileName || user?.full_name);

  return (
    <div className={styles.storiesBarContainer}>
      <div className={styles.storiesBar}>
        {/* Your Story */}
        <div className={styles.storyItem}>
          <div className={`${styles.storyAvatar} ${styles.yourStory}`}>
            <div className={styles.avatarCircle}>
              {profileAvatar ? (
                <img src={profileAvatar} alt="Profile" className={styles.avatarImage} />
              ) : user?.image ? (
                <img src={resolveBackendAsset(user.image)} alt="Profile" className={styles.avatarImage} />
              ) : (
                <span className={styles.initials}>{currentUserInitials}</span>
              )}
            </div>
            <Button variant="ghost" size="icon" className={styles.addStoryBtn} aria-label="Add your pulse">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <span className={styles.storyName}>Your pulse</span>
        </div>
      </div>
    </div>
  );
}
