import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

/**
 * Custom storage adapter for Supabase that uses Capacitor Preferences on native platforms
 * and falls back to localStorage on web platforms.
 * This ensures proper session management across iOS, Android, and web.
 */
export const capacitorStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    // Fallback to localStorage for web
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value });
    } else {
      // Fallback to localStorage for web
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key });
    } else {
      // Fallback to localStorage for web
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    }
  },
};

/**
 * Clears all Supabase auth-related storage keys.
 * This is called during logout to ensure complete session cleanup.
 */
export const clearAuthStorage = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Get all keys and remove only Supabase auth-related ones
      const { keys } = await Preferences.keys();
      const authKeys = keys.filter(key => 
        key.startsWith('sb-') || 
        key.includes('auth-token') ||
        key.includes('supabase')
      );
      
      // Remove all auth-related keys
      await Promise.all(authKeys.map(key => Preferences.remove({ key })));
      
      console.log(`Cleared ${authKeys.length} auth keys from Capacitor storage`);
    } else {
      // On web, clear Supabase keys from localStorage
      if (typeof window !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('supabase'))) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`Cleared ${keysToRemove.length} auth keys from localStorage`);
      }
    }
  } catch (error) {
    console.error('Error clearing auth storage:', error);
  }
};
