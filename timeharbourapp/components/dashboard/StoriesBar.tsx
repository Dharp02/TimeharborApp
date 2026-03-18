'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { Plus } from 'lucide-react';
import { Button } from '@mieweb/ui';
import styles from './StoriesBar.module.css';
export default function StoriesBar() {
  const { user } = useAuth();

  // Get user initials
  const getUserInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const currentUserInitials = getUserInitials(user?.full_name, user?.email);

  return (
    <div className={styles.storiesBarContainer}>
      <div className={styles.storiesBar}>
        {/* Your Story */}
        <div className={styles.storyItem}>
          <div className={`${styles.storyAvatar} ${styles.yourStory}`}>
            <div className={styles.avatarCircle}>
              <span className={styles.initials}>{currentUserInitials}</span>
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
