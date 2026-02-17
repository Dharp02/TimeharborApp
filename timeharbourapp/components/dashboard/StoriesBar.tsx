'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { useTeam } from './TeamContext';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import styles from './StoriesBar.module.css';

export default function StoriesBar() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();

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
            <button className={styles.addStoryBtn} aria-label="Add your story">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <span className={styles.storyName}>Your story</span>
        </div>

        {/* Team Members */}
        {currentTeam?.members
          .filter(member => member.id !== user?.id)
          .map((member) => {
            const memberInitials = getUserInitials(member.name, member.email);
            return (
              <Link 
                key={member.id} 
                href={`/dashboard/member/${member.id}?teamId=${currentTeam.id}`}
                className={styles.storyItem}
              >
                <div className={`${styles.storyAvatar} ${styles.memberStory}`}>
                  <div className={styles.avatarCircle}>
                    <span className={styles.initials}>{memberInitials}</span>
                  </div>
                </div>
                <span className={styles.storyName}>{member.name || member.email}</span>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
