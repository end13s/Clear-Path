import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isOnboardingComplete, loadProfile, loadTheme, saveProfile, saveTheme } from './ProfileStorage';
import { translations } from './translations';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [themeKey, setThemeKey] = useState('dark');
  const [language, setLanguage] = useState('en');
  const [toggles, setToggles] = useState({ trafficLights: true, signs: true, hazards: true });

  useEffect(() => {
    async function init() {
      const completed = await isOnboardingComplete();
      setIsOnboarded(completed);
      
      let t = await loadTheme();
      if (completed) {
        const p = await loadProfile();
        if (!t) {
          t = p?.colorBlind ? 'highContrast' : 'dark';
        }
        setProfile(p);
      } else {
        if (!t) t = 'dark';
      }
      setThemeKey(t);

      const savedLang = await AsyncStorage.getItem('clearpath_language');
      if (savedLang) setLanguage(savedLang);

      setIsLoaded(true);
    }
    init();
  }, []);

  const updateProfile = async (newProfile) => {
    await saveProfile(newProfile);
    setProfile(newProfile);
  };

  const updateThemeKey = async (newThemeKey) => {
    await saveTheme(newThemeKey);
    setThemeKey(newThemeKey);
  };

  const updateLanguage = async (newLang) => {
    await AsyncStorage.setItem('clearpath_language', newLang);
    setLanguage(newLang);
  };

  const updateToggle = (id, val) => {
    setToggles(prev => ({ ...prev, [id]: val }));
  };

  const completeOnboarding = () => {
    setIsOnboarded(true);
  };

  const t = (key) => translations[language]?.[key] || translations['en']?.[key] || key;

  return (
    <AppContext.Provider value={{
      isLoaded, 
      isOnboarded, 
      completeOnboarding,
      profile, 
      updateProfile,
      themeKey, 
      updateThemeKey,
      language,
      updateLanguage,
      toggles, 
      updateToggle,
      t
    }}>
      {children}
    </AppContext.Provider>
  );
};
