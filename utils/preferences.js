// App preferences: theme (light/dark) + language (tr/en), persisted locally.
//
// NOTE: theme tokens are applied to newer screens (Settings, Search) first;
// rolling the palette across every screen is progressive. `usePreferences`
// and `themeColors` are the single source of truth so the rollout is mechanical.

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PreferencesContext = createContext({
  theme: 'light',
  language: 'tr',
  setTheme: () => {},
  setLanguage: () => {},
});

export function PreferencesProvider({ children }) {
  const [theme, setThemeState] = useState('light');
  const [language, setLanguageState] = useState('tr');

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem('pref_theme');
        const l = await AsyncStorage.getItem('pref_language');
        if (t) setThemeState(t);
        if (l) setLanguageState(l);
      } catch (_) {}
    })();
  }, []);

  const setTheme = async (t) => { setThemeState(t); try { await AsyncStorage.setItem('pref_theme', t); } catch (_) {} };
  const setLanguage = async (l) => { setLanguageState(l); try { await AsyncStorage.setItem('pref_language', l); } catch (_) {} };

  return (
    <PreferencesContext.Provider value={{ theme, language, setTheme, setLanguage }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => useContext(PreferencesContext);

export const themeColors = (theme) =>
  theme === 'dark'
    ? { bg: '#0f172a', card: '#1e293b', text: '#f1f5f9', sub: '#94a3b8', border: '#334155', accent: '#8b5cf6' }
    : { bg: '#ffffff', card: '#f8f9fa', text: '#222222', sub: '#666666', border: '#eeeeee', accent: '#8b5cf6' };

// Minimal i18n for the settings/search surfaces.
const STRINGS = {
  tr: {
    settings: 'Ayarlar', preferences: 'Tercihler', language: 'Dil', theme: 'Tema',
    light: 'Açık', dark: 'Koyu', privacy: 'Gizlilik', privateAccount: 'Gizli Hesap',
    privateAccountSub: 'Sadece arkadaşların alışkanlıklarını görebilir',
    messagePrivacy: 'Kimler mesaj atabilir', everyone: 'Herkes', friends: 'Arkadaşlar', nobody: 'Hiç kimse',
    blocked: 'Engellenenler', noBlocked: 'Kimseyi engellemedin.', unblock: 'Engeli Kaldır', logout: 'Çıkış Yap',
  },
  en: {
    settings: 'Settings', preferences: 'Preferences', language: 'Language', theme: 'Theme',
    light: 'Light', dark: 'Dark', privacy: 'Privacy', privateAccount: 'Private Account',
    privateAccountSub: 'Only friends can see your habits',
    messagePrivacy: 'Who can message you', everyone: 'Everyone', friends: 'Friends', nobody: 'Nobody',
    blocked: 'Blocked', noBlocked: "You haven't blocked anyone.", unblock: 'Unblock', logout: 'Log Out',
  },
};

export const tFor = (language) => (key) => (STRINGS[language] || STRINGS.tr)[key] || key;
