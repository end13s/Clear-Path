import React, { useState, useContext } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import HelpModal from '../components/HelpModal';
import SettingsModal from '../components/SettingsModal';
import { AppContext } from '../utils/AppContext';
import { THEMES } from '../utils/ThemeColors';

const CustomSwitch = ({ value, onValueChange, width, height, activeColor, inactiveColor, thumbColor }) => {
  const padding = 2;
  const dotSize = height - padding * 2;
  const translateX = value ? width - dotSize - padding * 2 : 0;
  const textFontSize = Math.max(10, height * 0.45);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={{
        width,
        height,
        borderRadius: height / 2,
        backgroundColor: value ? activeColor : inactiveColor,
        padding,
        justifyContent: 'center',
      }}
    >
      {value ? (
        <Text style={{ position: 'absolute', left: padding * 3, color: '#FFFFFF', fontWeight: 'bold', fontSize: textFontSize }}>ON</Text>
      ) : (
        <Text style={{ position: 'absolute', right: padding * 3, color: '#FFFFFF', fontWeight: 'bold', fontSize: textFontSize }}>OFF</Text>
      )}
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: thumbColor,
          transform: [{ translateX }],
        }}
      />
    </TouchableOpacity>
  );
};

export default function HomeScreen({ navigation }) {
  const { profile, updateProfile, themeKey, updateThemeKey, language, updateLanguage, toggles, updateToggle } = useContext(AppContext);

  const [helpVisible, setHelpVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  
  const isElderly = profile?.elderly === true || profile?.lowVision === true;
  const theme = THEMES[themeKey] || THEMES.dark;

  // Font and size sets
  const fonts = {
    body: isElderly ? 20 : 17,
    titles: isElderly ? 21 : 18,
    sectionHeaders: isElderly ? 18 : 16,
    button: isElderly ? 23 : 20,
    headerTagline: isElderly ? 15 : 14,
    helpCenter: isElderly ? 20 : 18, 
  };

  const sizes = {
    gearBtn: isElderly ? 56 : 48,
    gearIcon: isElderly ? 30 : 24,
    btnRadius: isElderly ? 16 : 14,
    btnPad: isElderly ? 18 : 16,
    switchWidth: isElderly ? 60 : 50,
    switchHeight: isElderly ? 28 : 24,
  };

  const badgeText = isElderly 
    ? 'Elderly mode' 
    : profile?.colorBlind 
      ? 'Color blindness mode' 
      : 'Standard mode';

  const heroPara = isElderly
    ? 'ClearPath watches the road for you. It announces traffic lights, signs, and nearby pedestrians — loudly and clearly.'
    : 'ClearPath uses your camera to detect traffic lights, road signs, and pedestrians — announcing each one clearly so you can drive with confidence.';

  const handleToggle = (id) => {
    updateToggle(id, !toggles[id]);
  };

  const handleStartDriving = () => {
    navigation.navigate('Camera');
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={[styles.headerTitle, { fontSize: fonts.titles }]}>ClearPath</Text>
          <Text style={[styles.headerTagline, { fontSize: fonts.headerTagline }]}>
            Technology with purpose. Driving with confidence.
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.gearBtn, { width: sizes.gearBtn, height: sizes.gearBtn }]}
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={[styles.gearIcon, { fontSize: sizes.gearIcon }]}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
          <Text style={[styles.heroText, { fontSize: fonts.body }]}>{heroPara}</Text>
        </View>

        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { fontSize: fonts.sectionHeaders }]}>
            {isElderly ? 'Features turned on' : 'Active features'}
          </Text>

          <View style={styles.featureCard}>
            <View style={styles.featureInfo}>
              <Text style={styles.featureIcon}>🚦</Text>
              <View style={styles.featureTextCol}>
                <Text style={[styles.featureTitle, { fontSize: fonts.titles }]}>Traffic lights</Text>
                <Text style={[styles.featureSubtitle, { fontSize: fonts.body }]}>
                  {isElderly ? 'Tells you when to stop and go' : 'Shape + color + label detection'}
                </Text>
              </View>
            </View>
            <CustomSwitch
              value={toggles.trafficLights}
              onValueChange={() => handleToggle('trafficLights')}
              width={sizes.switchWidth}
              height={sizes.switchHeight}
              activeColor={theme.accentBlue}
              inactiveColor={theme.border}
              thumbColor={theme.textPrimary}
            />
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureInfo}>
              <Text style={styles.featureIcon}>🛑</Text>
              <View style={styles.featureTextCol}>
                <Text style={[styles.featureTitle, { fontSize: fonts.titles }]}>Road signs</Text>
                <Text style={[styles.featureSubtitle, { fontSize: fonts.body }]}>
                  {isElderly ? 'Stop signs and speed limits' : 'Stop, yield, speed limits'}
                </Text>
              </View>
            </View>
            <CustomSwitch
              value={toggles.signs}
              onValueChange={() => handleToggle('signs')}
              width={sizes.switchWidth}
              height={sizes.switchHeight}
              activeColor={theme.accentBlue}
              inactiveColor={theme.border}
              thumbColor={theme.textPrimary}
            />
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureInfo}>
              <Text style={styles.featureIcon}>🚶</Text>
              <View style={styles.featureTextCol}>
                <Text style={[styles.featureTitle, { fontSize: fonts.titles }]}>
                  {isElderly ? 'People nearby' : 'Hazards'}
                </Text>
                <Text style={[styles.featureSubtitle, { fontSize: fonts.body }]}>
                  {isElderly ? 'Warns if someone is crossing' : 'Pedestrians and cyclists'}
                </Text>
              </View>
            </View>
            <CustomSwitch
              value={toggles.hazards}
              onValueChange={() => handleToggle('hazards')}
              width={sizes.switchWidth}
              height={sizes.switchHeight}
              activeColor={theme.accentBlue}
              inactiveColor={theme.border}
              thumbColor={theme.textPrimary}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.helpButtonContainer} onPress={() => setHelpVisible(true)} activeOpacity={0.8}>
          <View style={styles.helpLeft}>
            <View style={styles.helpIconBox}>
              <Text style={styles.helpIconText}>?</Text>
            </View>
            <Text style={[styles.helpText, { fontSize: fonts.helpCenter }]}>How does this work?</Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </TouchableOpacity>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomPin}>
        <TouchableOpacity 
          style={[styles.startBtn, { borderRadius: sizes.btnRadius, paddingVertical: sizes.btnPad }]}
          activeOpacity={0.85}
          onPress={handleStartDriving}
        >
          <Text style={[styles.startBtnText, { fontSize: fonts.button }]}>Start driving</Text>
        </TouchableOpacity>
      </View>

      <HelpModal 
        visible={helpVisible} 
        onClose={() => setHelpVisible(false)} 
        isElderly={isElderly} 
        theme={theme}
      />
      
      <SettingsModal 
        visible={settingsVisible} 
        onClose={() => setSettingsVisible(false)} 
        profile={profile}
        themeKey={themeKey}
        language={language}
        onSave={(updatedProfile, updatedTheme, updatedLanguage) => {
          updateProfile(updatedProfile);
          updateThemeKey(updatedTheme);
          updateLanguage(updatedLanguage);
        }}
        onClear={() => {
          setSettingsVisible(false);
          navigation.replace('Onboarding');
        }}
        theme={theme}
      />
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgPrimary,
  },
  header: {
    backgroundColor: theme.bgHeader,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  headerTagline: {
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  gearBtn: {
    backgroundColor: theme.bgCard,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: theme.border,
    borderWidth: 1,
  },
  gearIcon: {
    // defaults managed dynamically
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroSection: {
    backgroundColor: theme.bgHero,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
    padding: 20,
    alignItems: 'flex-start',
  },
  badge: {
    backgroundColor: theme.accentBlue,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 10,
  },
  badgeText: {
    color: theme.bgPrimary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  heroText: {
    color: theme.textSecondary,
    lineHeight: 20,
  },
  featuresSection: {
    padding: 20,
  },
  sectionTitle: {
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  featureCard: {
    backgroundColor: theme.bgCard,
    borderColor: theme.border,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    color: theme.textPrimary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  featureSubtitle: {
    color: theme.textSecondary,
  },
  helpButtonContainer: {
    backgroundColor: theme.bgHero,
    borderColor: theme.border,
    borderWidth: 1.5,
    borderRadius: 10,
    marginHorizontal: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  helpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  helpIconText: {
    color: theme.bgPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  helpText: {
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  chevron: {
    color: theme.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  bottomPin: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.bgPrimary,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
  },
  startBtn: {
    backgroundColor: theme.accentBlue,
    alignItems: 'center',
    width: '100%',
  },
  startBtnText: {
    color: theme.bgPrimary,
    fontWeight: 'bold',
  },
});
