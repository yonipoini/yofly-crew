import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEYS = {
  mode: 'yofly.theme-mode',
  onboarding: 'yofly.onboarding-complete',
};

const themeTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  roundness: {
    sm: 10,
    md: 18,
    lg: 26,
    full: 999,
  },
};

const darkTheme = {
  ...themeTokens,
  colors: {
    background: '#08070B',
    surface: 'rgba(21, 20, 26, 0.94)',
    primary: '#D96BE8',
    secondary: '#9C7AEF',
    accent: '#72DDE1',
    text: '#F7F2F8',
    textMuted: '#A99FAE',
    border: 'rgba(255,255,255,0.1)',
    error: '#F97066',
    success: '#58D68D',
    overlay: 'rgba(0,0,0,0.74)',
    cardSoft: 'rgba(32, 25, 39, 0.86)',
    input: 'rgba(13, 12, 17, 0.95)',
  },
  gradients: {
    primary: ['#B66DE6', '#D96BE8'],
    accent: ['#72DDE1', '#5CC5CF'],
  },
};

const lightTheme = {
  ...themeTokens,
  colors: {
    background: '#FBF8FC',
    surface: '#FFFFFF',
    primary: '#C957D8',
    secondary: '#7C66D9',
    accent: '#2FAFC0',
    text: '#17121A',
    textMuted: '#716777',
    border: '#E2DCE7',
    error: '#D64F45',
    success: '#2E9F67',
    overlay: 'rgba(15,23,42,0.35)',
    cardSoft: '#F9EEF9',
    input: '#F4EFF6',
  },
  gradients: {
    primary: ['#DFA1E8', '#F2C3EE'],
    accent: ['#9DE8EC', '#D9F7F8'],
  },
};

const themes = {
  dark: darkTheme,
  light: lightTheme,
};

export type AppTheme = typeof darkTheme;

interface ThemeContextValue {
  theme: AppTheme;
  themeMode: ThemeMode;
  isDark: boolean;
  isReady: boolean;
  onboardingComplete: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  completeOnboarding: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedMode, storedOnboarding] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.mode),
          AsyncStorage.getItem(STORAGE_KEYS.onboarding),
        ]);

        if (storedMode === 'dark' || storedMode === 'light') {
          setThemeModeState(storedMode);
        }

        if (storedOnboarding === 'true') {
          setOnboardingComplete(true);
        }
      } catch (error) {
        console.warn('Theme storage unavailable, using session defaults:', error);
      } finally {
        setIsReady(true);
      }
    };

    void load();
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEYS.mode, mode).catch((error) => {
      console.warn('Failed to persist theme mode:', error);
    });
  };

  const completeOnboarding = () => {
    setOnboardingComplete(true);
    AsyncStorage.setItem(STORAGE_KEYS.onboarding, 'true').catch((error) => {
      console.warn('Failed to persist onboarding state:', error);
    });
  };

  const value = useMemo(
    () => ({
      theme: themes[themeMode],
      themeMode,
      isDark: themeMode === 'dark',
      isReady,
      onboardingComplete,
      setThemeMode,
      completeOnboarding,
    }),
    [isReady, onboardingComplete, themeMode]
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
};

export const theme = darkTheme;
