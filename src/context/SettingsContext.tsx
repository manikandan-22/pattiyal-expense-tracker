'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import { UserSettings, DEFAULT_SETTINGS, SettingsContextType } from '@/types';

const SettingsContext = createContext<SettingsContextType | null>(null);

const SETTINGS_CACHE_KEY = 'expense-tracker-settings';
const SPREADSHEET_ID_CACHE_KEY = 'expense-tracker-spreadsheet-id';

// Helper functions for sessionStorage
const getCachedSettings = (): UserSettings | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const setCachedSettings = (settings: UserSettings, spreadsheetId: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    if (spreadsheetId) {
      sessionStorage.setItem(SPREADSHEET_ID_CACHE_KEY, spreadsheetId);
    }
  } catch {
    // Ignore storage errors
  }
};

const getCachedSpreadsheetId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SPREADSHEET_ID_CACHE_KEY);
  } catch {
    return null;
  }
};

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { data: session, status } = useSession();
  // Initialize from cache for instant load
  const [settings, setSettings] = useState<UserSettings>(() => {
    return getCachedSettings() || DEFAULT_SETTINGS;
  });
  const [isLoading, setIsLoading] = useState(() => {
    // If we have cached settings, don't show loading state
    return !getCachedSettings();
  });
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return getCachedSpreadsheetId();
  });

  // Load settings on auth
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      // If we have cached settings, load in background without blocking UI
      const hasCached = getCachedSettings() !== null;
      loadSettings(!hasCached);
    } else if (status === 'unauthenticated') {
      setIsLoading(false);
    }
  }, [status, session?.accessToken]);

  const loadSettings = async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const res = await fetch('/api/settings');
      const data = await res.json();

      if (!data.error) {
        setSettings(data.settings);
        setSpreadsheetId(data.spreadsheetId);
        // Cache settings for future page loads
        setCachedSettings(data.settings, data.spreadsheetId);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      // Update cache immediately for instant feedback on refresh
      setCachedSettings(updatedSettings, spreadsheetId);

      try {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: updatedSettings,
            spreadsheetId,
          }),
        });
      } catch (error) {
        console.error('Error saving settings:', error);
        // Revert on error
        setSettings(settings);
        setCachedSettings(settings, spreadsheetId);
        throw error;
      }
    },
    [settings, spreadsheetId]
  );

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
