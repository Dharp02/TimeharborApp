'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { auth } from '@/TimeharborAPI';
import { resolveBackendAsset } from '@/TimeharborAPI/apiUrl';
import { User, Camera, Trash2, Github, Linkedin, Bug, Save, X, Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button, Input } from '@mieweb/ui';
import { Modal } from '@/components/ui/Modal';
import { useRef, useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

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

  // Crop modal state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // UI state
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Track the saved avatar URL from backend (separate from local preview)
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  // Initialize form from user data
  useEffect(() => {
    if (user) {
      setName(user.full_name || user.name || '');
      setEmail(user.email || '');
    }
  }, [user?.full_name, user?.name, user?.email]);

  // Load linked accounts + avatar from backend profile (once on mount)
  const profileLoadedRef = useRef(false);
  useEffect(() => {
    if (!user || profileLoadedRef.current) return;
    profileLoadedRef.current = true;

    auth.fetchProfile().then(({ profile }) => {
      if (profile) {
        setGithubUrl(profile.githubUrl || '');
        setLinkedinUrl(profile.linkedinUrl || '');
        setRedmineUrl(profile.redmineUrl || '');
        // Use local offline avatar (base64) if available, else backend URL
        const avatarSrc = (profile as any).avatarDataUrl || profile.avatarUrl;
        if (avatarSrc) {
          setSavedAvatarUrl(resolveBackendAsset(avatarSrc) ?? avatarSrc);
        }
      }
    }).finally(() => setIsLoadingProfile(false));
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

    // Open crop modal instead of directly setting preview
    const objectUrl = URL.createObjectURL(file);
    setCropImage(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropConfirm = async () => {
    if (!cropImage || !croppedAreaPixels) return;

    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = cropImage;
    });

    // Apply rotation
    const radians = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const rotW = img.width * cos + img.height * sin;
    const rotH = img.width * sin + img.height * cos;

    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = rotW;
    rotCanvas.height = rotH;
    const rotCtx = rotCanvas.getContext('2d')!;
    rotCtx.translate(rotW / 2, rotH / 2);
    rotCtx.rotate(radians);
    rotCtx.drawImage(img, -img.width / 2, -img.height / 2);

    // Crop from rotated canvas
    const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height, 512);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      rotCanvas,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      size,
      size,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) return;

    const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    const previewUrl = URL.createObjectURL(blob);

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    URL.revokeObjectURL(cropImage);

    setAvatarFile(croppedFile);
    setAvatarPreview(previewUrl);
    setCropImage(null);
    markChanged();
  };

  const handleCropCancel = () => {
    if (cropImage) URL.revokeObjectURL(cropImage);
    setCropImage(null);
  };

  const handleRemoveAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarError(null);
    setAvatarRemoved(true);
    markChanged();
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Handle avatar upload/delete first
      if (avatarFile) {
        const { avatarUrl, error: uploadError } = await auth.uploadAvatar(avatarFile);
        if (uploadError) {
          setSaveMessage({ type: 'error', text: uploadError.message });
          setIsSaving(false);
          return;
        }
        setSavedAvatarUrl(avatarUrl);
        setAvatarFile(null);
        setAvatarRemoved(false);
      } else if (avatarRemoved && savedAvatarUrl) {
        const { error: deleteError } = await auth.deleteAvatar();
        if (deleteError) {
          setSaveMessage({ type: 'error', text: deleteError.message });
          setIsSaving(false);
          return;
        }
        setSavedAvatarUrl(null);
        setAvatarRemoved(false);
      }

      const { error } = await auth.updateProfile({
        full_name: name,
        email,
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        redmine_url: redmineUrl,
      });
      if (error) {
        setSaveMessage({ type: 'error', text: error.message });
      } else {
        setSaveMessage({ type: 'success', text: 'Profile saved successfully.' });
        setHasChanges(false);
      }
    } catch {
      // If avatar was saved offline but profile update failed (network error),
      // still show partial success so the user knows the avatar is queued
      if (avatarFile || avatarRemoved) {
        setSaveMessage({ type: 'success', text: 'Avatar saved locally. Profile will sync when you\'re back online.' });
        setHasChanges(false);
      } else {
        setSaveMessage({ type: 'error', text: 'You appear to be offline. Changes will sync when connectivity is restored.' });
      }
    } finally {
      setIsSaving(false);
    }
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
    setAvatarRemoved(false);
    // Restore saved avatar if one exists
    if (savedAvatarUrl) {
      setAvatarPreview(null);
    }
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
                ) : savedAvatarUrl && !avatarRemoved ? (
                  <img
                    src={savedAvatarUrl}
                    alt="Profile picture"
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
                {(avatarPreview || (savedAvatarUrl && !avatarRemoved)) && (
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

        {/* Crop Modal */}
        <Modal
          isOpen={!!cropImage}
          onClose={handleCropCancel}
          title="Adjust Photo"
          size="lg"
        >
          <div className="space-y-4">
            <div className="relative w-full" style={{ height: '350px' }}>
              {cropImage && (
                <Cropper
                  image={cropImage}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            {/* Controls */}
            <div className="space-y-3 px-2">
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-primary-600"
                  aria-label="Zoom"
                />
                <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <div className="flex items-center gap-3">
                <RotateCw className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="flex-1 accent-primary-600"
                  aria-label="Rotation"
                />
                <span className="text-xs text-muted-foreground w-8 text-right">{rotation}°</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={handleCropCancel}>
                Cancel
              </Button>
              <Button onClick={handleCropConfirm}>
                Use This Photo
              </Button>
            </div>
          </div>
        </Modal>
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
            disabled={!hasChanges || isSaving}
            aria-label="Save profile changes"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
