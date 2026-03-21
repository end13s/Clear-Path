import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'clearpath_onboarding_complete';
const PROFILE_KEY = 'clearpath_user_profile';
const THEME_KEY = 'clearpath_theme';

export const saveProfile = async (profile) => {
  try {
    const jsonValue = JSON.stringify(profile);
    await AsyncStorage.setItem(PROFILE_KEY, jsonValue);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch (e) {
    console.error('Error saving profile:', e);
  }
};

export const loadProfile = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(PROFILE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Error loading profile:', e);
    return null;
  }
};

export const saveTheme = async (themeStr) => {
  try {
    await AsyncStorage.setItem(THEME_KEY, themeStr);
  } catch (e) {
    console.error('Error saving theme:', e);
  }
};

export const loadTheme = async () => {
  try {
    return await AsyncStorage.getItem(THEME_KEY);
  } catch (e) {
    console.error('Error loading theme:', e);
    return null;
  }
};

export const isOnboardingComplete = async () => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch (e) {
    console.error('Error checking onboarding status:', e);
    return false;
  }
};

export const clearProfile = async () => {
  try {
    await AsyncStorage.removeItem(PROFILE_KEY);
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    await AsyncStorage.removeItem(THEME_KEY);
    await AsyncStorage.removeItem('clearpath_speech_speed');
    await AsyncStorage.removeItem('clearpath_speech_volume');
    await AsyncStorage.removeItem('clearpath_language');
  } catch (e) {
    console.error('Error clearing profile:', e);
  }
};
