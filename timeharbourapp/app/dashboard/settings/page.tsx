'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import {
  User,
  Bell,
  Globe,
  CalendarDays,
  Users,
  ChevronRight,
  Sun,
  Share2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserRoundCog,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Text, SmallMuted, Switch, useThemeContext } from '@mieweb/ui';
import { resolveBackendAsset } from '@/TimeharborAPI/apiUrl';
import { getProfile } from '@/TimeharborAPI/profile';
import ShareMyLinkModal from '@/components/ShareMyLinkModal';
import KeyRegenerationModal from '@/components/KeyRegenerationModal';
import ProfileSwitchModal from '@/components/ProfileSwitchModal';
import RecoveryKeyModal from '@/components/RecoveryKeyModal';
import AppLockToggle from '@/components/AppLockToggle';
import { isRecoveryKeySaved } from '@/TimeharborAPI/sync/RecoveryKeyService';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useThemeContext();

  const isDark = resolvedTheme === 'dark';
  const handleThemeToggle = (checked: boolean) => setTheme(checked ? 'dark' : 'light');

  // Load display name + avatar from Dexie (works without auth session)
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then((p) => {
      if (p?.displayName) setProfileName(p.displayName);
      if (p?.email) setProfileEmail(p.email);
      if (p?.avatarBase64) setProfileAvatar(p.avatarBase64);
    }).catch(() => {});
  }, []);

  const displayName = profileName || user?.full_name || 'User';
  const displayEmail = profileEmail || user?.email || '';

  const getInitials = () => {
    if (!displayName || displayName === 'User') return displayEmail?.charAt(0).toUpperCase() || 'U';
    const parts = displayName.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  };

  const [pushEnabled, setPushEnabled] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [showProfileSwitch, setShowProfileSwitch] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<'save' | 'restore'>('save');
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    isRecoveryKeySaved()
      .then(setKeySaved)
      .catch(() => {});
  }, [showRecoveryModal]);

  const menuItems = [
    { label: 'Edit Profile', icon: User, href: '/dashboard/settings/profile' },
    { label: 'Language', icon: Globe, href: '/dashboard/settings/language' },
    { label: 'Timesheet Settings', icon: CalendarDays, href: '/dashboard/settings/timesheet' },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center pt-6 pb-2">
        <div className="w-24 h-24 rounded-full bg-primary-400 flex items-center justify-center text-white text-3xl font-semibold mb-4 overflow-hidden">
          {profileAvatar ? (
            <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
          ) : user?.image ? (
            <img src={resolveBackendAsset(user.image)} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            getInitials()
          )}
        </div>
        <Text className="text-xl font-bold">{displayName}</Text>
        <SmallMuted>{displayEmail}</SmallMuted>
      </div>

      {/* Menu Items */}
      <div className="divide-y divide-border -mx-4">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-4">
              <item.icon className="w-5 h-5 text-muted-foreground" />
              <Text className="font-medium">{item.label}</Text>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        ))}

        {/* Push Notifications Toggle */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <Text className="font-medium">Notification Preferences</Text>
          </div>
          <Switch
            checked={pushEnabled}
            onCheckedChange={setPushEnabled}
            aria-label="Toggle push notifications"
          />
        </div>

        {/* Display Mode */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Sun className="w-5 h-5 text-muted-foreground" />
            <Text className="font-medium">Display Mode</Text>
          </div>
          <Switch
            checked={isDark}
            onCheckedChange={handleThemeToggle}
            aria-label="Toggle dark mode"
          />
        </div>
      </div>

      {/* ── Sync & Security Section ── */}
      <div className="divide-y divide-border -mx-4">
        <div className="px-6 py-3">
          <SmallMuted className="text-xs uppercase tracking-wider font-semibold">Sync &amp; Security</SmallMuted>
        </div>

        {/* Share My Link */}
        <button
          onClick={() => setShowShareModal(true)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors"
          aria-label="Share my sync link"
        >
          <div className="flex items-center gap-4">
            <Share2 className="w-5 h-5 text-primary" />
            <Text className="font-medium">Share My Link</Text>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Save Recovery Key */}
        <button
          onClick={() => { setRecoveryMode('save'); setShowRecoveryModal(true); }}
          disabled={keySaved}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={keySaved ? 'Recovery key already saved' : 'Save recovery key'}
        >
          <div className="flex items-center gap-4">
            <KeyRound className="w-5 h-5 text-primary" />
            <Text className="font-medium">{keySaved ? 'Recovery Key Saved' : 'Save Recovery Key'}</Text>
          </div>
          {!keySaved && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
          {keySaved && <ShieldCheck className="w-5 h-5 text-green-500" />}
        </button>

        {/* Restore from Recovery Key */}
        <button
          onClick={() => { setRecoveryMode('restore'); setShowRecoveryModal(true); }}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors"
          aria-label="Restore data from recovery key"
        >
          <div className="flex items-center gap-4">
            <Upload className="w-5 h-5 text-muted-foreground" />
            <Text className="font-medium">Restore from Recovery Key</Text>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Regenerate Key */}
        <button
          onClick={() => setShowRegenModal(true)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors"
          aria-label="Regenerate encryption key"
        >
          <div className="flex items-center gap-4">
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
            <Text className="font-medium">Regenerate Key</Text>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Switch Profile */}
        <button
          onClick={() => setShowProfileSwitch(true)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors"
          aria-label="Switch sync profile"
        >
          <div className="flex items-center gap-4">
            <UserRoundCog className="w-5 h-5 text-muted-foreground" />
            <Text className="font-medium">Switch Profile</Text>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* App Lock */}
        <AppLockToggle />
      </div>

      {/* ── Team Section ── */}
      <div className="divide-y divide-border -mx-4">

        {/* Open Timehuddle */}
        <button
          onClick={() => alert('Timehuddle is coming soon!')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-4">
            <Users className="w-5 h-5 text-amber-500" />
            <Text className="font-medium text-amber-600 dark:text-amber-400">Open Timehuddle</Text>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-500" />
        </button>
      </div>

      {/* Modals */}
      <ShareMyLinkModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      <KeyRegenerationModal isOpen={showRegenModal} onClose={() => setShowRegenModal(false)} />
      <ProfileSwitchModal isOpen={showProfileSwitch} onClose={() => setShowProfileSwitch(false)} />
      <RecoveryKeyModal isOpen={showRecoveryModal} onClose={() => setShowRecoveryModal(false)} mode={recoveryMode} />
    </div>
  );
}
