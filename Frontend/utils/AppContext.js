import React, { createContext, useState, useEffect } from 'react';
import { isOnboardingComplete, loadProfile, loadTheme, saveProfile, saveTheme } from './ProfileStorage';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [themeKey, setThemeKey] = useState('dark');
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

  const updateToggle = (id, val) => {
    setToggles(prev => ({ ...prev, [id]: val }));
  };

  const completeOnboarding = () => {
    setIsOnboarded(true);
  };

  return (
    <AppContext.Provider value={{
      isLoaded, 
      isOnboarded, 
      completeOnboarding,
      profile, 
      updateProfile,
      themeKey, 
      updateThemeKey,
      toggles, 
      updateToggle
    }}>
      {children}
    </AppContext.Provider>
  );
};
