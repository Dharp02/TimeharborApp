'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { User, Camera, Trash2, Github, Linkedin, Bug, Save, X } from 'lucide-react';
import { Button, Input } from '@mieweb/ui';
import { useRef, useState, useEffect } from 'react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function ProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [redmineUrl, setRedmineUrl] = useState('');

  // Profile picture state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // UI state
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize form from user data
  useEffect(() => {
    if (user) {
      setName(user.full_name || user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const markChanged = () => {
    setHasChanges(true);
    setSaveMessage(null);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError('Please select a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setAvatarError('Image must be smaller than 5MB.');
      return;
    }

    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    markChanged();

    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarError(null);
    markChanged();
  };

  const handleSave = () => {
    // TODO: Wire up to backend API
    setSaveMessage({ type: 'success', text: 'Profile saved locally. Backend sync coming soon.' });
    setHasChanges(false);
  };

  const handleDiscard = () => {
    if (user) {
      setName(user.full_name || user.name || '');
      setEmail(user.email || '');
    }
    setGithubUrl('');
    setLinkedinUrl('');
    setRedmineUrl('');
    handleRemoveAvatar();
    setHasChanges(false);
    setSaveMessage(null);
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const initials = (name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mt-2 px-0 pb-4 pt-0 md:mt-0 md:p-6">
      <div className="max-w-4xl mr-auto space-y-8">

        {/* Profile Picture */}
        <section aria-labelledby="avatar-heading">
          <h2 id="avatar-heading" className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Profile Picture
          </h2>
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-primary-600 flex items-center justify-center text-white text-2xl font-semibold shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                aria-label="Upload profile picture"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload a new profile picture"
                >
                  <Camera className="w-4 h-4" />
                  <span>Upload</span>
                </Button>
                {avatarPreview && (
                  <Button
                    variant="outline"
                    onClick={handleRemoveAvatar}
                    className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                    aria-label="Remove profile picture"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove</span>
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                JPEG, PNG, WebP or GIF. Max 5MB.
              </p>
              {avatarError && (
                <p className="text-xs text-red-500" role="alert">{avatarError}</p>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={handleAvatarSelect}
            className="hidden"
            aria-hidden="true"
          />
        </section>

        {/* Personal Information */}
        <section aria-labelledby="personal-heading">
          <h2 id="personal-heading" className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Personal Information
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <Input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); markChanged(); }}
                placeholder="Your full name"
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); markChanged(); }}
                placeholder="you@example.com"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Changing email may require re-verification.
              </p>
            </div>
          </div>
        </section>

        {/* Linked Accounts */}
        <section aria-labelledby="links-heading">
          <h2 id="links-heading" className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Linked Accounts
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-github" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Github className="w-4 h-4" />
                GitHub
              </label>
              <Input
                id="profile-github"
                type="url"
                value={githubUrl}
                onChange={(e) => { setGithubUrl(e.target.value); markChanged(); }}
                placeholder="https://github.com/username"
              />
            </div>
            <div>
              <label htmlFor="profile-linkedin" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </label>
              <Input
                id="profile-linkedin"
                type="url"
                value={linkedinUrl}
                onChange={(e) => { setLinkedinUrl(e.target.value); markChanged(); }}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
            <div>
              <label htmlFor="profile-redmine" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Bug className="w-4 h-4" />
                Redmine
              </label>
              <Input
                id="profile-redmine"
                type="url"
                value={redmineUrl}
                onChange={(e) => { setRedmineUrl(e.target.value); markChanged(); }}
                placeholder="https://redmine.example.com/users/123"
              />
            </div>
          </div>
        </section>

        {/* Save / Discard */}
        {saveMessage && (
          <div
            role="alert"
            className={`p-3 rounded-lg text-sm ${
              saveMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={!hasChanges}
            aria-label="Discard changes"
          >
            <X className="w-4 h-4" />
            <span>Discard</span>
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            aria-label="Save profile changes"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
