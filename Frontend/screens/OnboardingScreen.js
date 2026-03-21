import React, { useState, useContext } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../utils/AppContext';
import { THEMES } from '../utils/ThemeColors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OnboardingScreen({ navigation }) {
  const { themeKey, updateThemeKey, updateProfile, completeOnboarding } = useContext(AppContext);
  const theme = THEMES[themeKey] || THEMES.dark;

  const [localProfile, setLocalProfile] = useState({
    colorBlind: false,
    lowVision: false,
    elderly: false,
    hearingDifficulty: false,
    none: false,
  });

  const options = [
    { id: 'colorBlind', iconName: 'eye-outline', iconSize: 22, title: 'Color blindness', subtitle: 'Difficulty distinguishing red, green, or other colors' },
    { id: 'lowVision', iconName: 'glasses-outline', iconSize: 22, title: 'Low vision', subtitle: 'Difficulty seeing clearly, even with glasses' },
    { id: 'elderly', iconName: 'person-outline', iconSize: 22, title: 'Age-related changes', subtitle: 'Slower reaction time, need larger text and clearer cues' },
    { id: 'hearingDifficulty', iconName: 'ear-outline', iconSize: 22, title: 'Hearing difficulty', subtitle: 'Need louder or slower voice announcements' },
    { id: 'none', iconName: 'checkmark-circle-outline', iconSize: 22, title: 'None of the above', subtitle: 'Use standard settings' }
  ];

  const handleToggle = (id) => {
    setLocalProfile(prev => {
      if (id === 'none') {
        return {
          colorBlind: false,
          lowVision: false,
          elderly: false,
          hearingDifficulty: false,
          none: !prev.none
        };
      }
      
      return { ...prev, [id]: !prev[id], none: false };
    });
  };

  const handleContinue = async () => {
    const profileToSave = {
      colorBlind: localProfile.colorBlind,
      lowVision: localProfile.lowVision,
      elderly: localProfile.elderly,
      hearingDifficulty: localProfile.hearingDifficulty,
    };
    
    // Default to high contrast if newly identified color blind and dark theme natively
    if (profileToSave.colorBlind && themeKey === 'dark') {
      await updateThemeKey('highContrast');
    }
    
    // Complete Onboarding locally
    await AsyncStorage.setItem('clearpath_onboarding_complete', 'true');
    completeOnboarding();
    
    await updateProfile(profileToSave);
    navigation.replace('Home');
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoSection}>
        <Text style={styles.logoTitle}>ClearPath</Text>
        <Text style={styles.logoTagline}>Technology with purpose. Driving with confidence.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>What do you struggle with while driving?</Text>
        <Text style={styles.subtext}>Select all that apply. We will tailor the app to your needs.</Text>

        <View style={styles.optionsContainer}>
          {options.map((opt) => {
            const selected = localProfile[opt.id];
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.card, selected && styles.cardSelected]}
                activeOpacity={0.8}
                onPress={() => handleToggle(opt.id)}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.titleRow}>
                    <View style={styles.iconContainer}>
                      <Ionicons name={opt.iconName} size={opt.iconSize} color={theme.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>{opt.title}</Text>
                  </View>
                  <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgPrimary,
  },
  logoSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  logoTitle: {
    color: theme.textPrimary,
    fontFamily: 'Lexend_700Bold',
    fontSize: 35,
  },
  logoTagline: {
    color: theme.accentBlue,
    fontFamily: 'Lexend_400Regular',
    fontStyle: 'italic',
    fontSize: 16,
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heading: {
    color: theme.textPrimary,
    fontFamily: 'Lexend_700Bold',
    fontSize: 21,
    marginBottom: 6,
  },
  subtext: {
    color: theme.textSecondary,
    fontFamily: 'Lexend_400Regular',
    fontSize: 17,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgCard,
    borderColor: theme.border,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
  },
  cardSelected: {
    backgroundColor: theme.bgHero,
    borderColor: theme.accentBlue,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.border,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.accentBlue,
    borderColor: theme.accentBlue,
  },
  checkmark: {
    color: theme.bgPrimary,
    fontFamily: 'Lexend_700Bold',
    fontSize: 14,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardTitle: {
    color: theme.textPrimary,
    fontFamily: 'Lexend_700Bold',
    fontSize: 18,
  },
  cardSubtitle: {
    color: theme.textSecondary,
    fontFamily: 'Lexend_600SemiBold',
    fontSize: 16,
  },
  footer: {
    padding: 20,
  },
  continueBtn: {
    backgroundColor: theme.accentBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueBtnText: {
    color: theme.bgPrimary,
    fontFamily: 'Lexend_700Bold',
    fontSize: 20,
  },
});
