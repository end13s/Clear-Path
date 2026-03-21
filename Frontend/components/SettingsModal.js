import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, ScrollView, TouchableOpacity, Dimensions, Alert, TouchableWithoutFeedback } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTheme, clearProfile } from '../utils/ProfileStorage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SettingsModal({ visible, onClose, profile, themeKey, onSave, onClear, theme }) {
  const [localProfile, setLocalProfile] = useState(profile || { colorBlind: false, lowVision: false, elderly: false, hearingDifficulty: false });
  const [localTheme, setLocalTheme] = useState(themeKey || 'dark');
  const [speechSpeed, setSpeechSpeed] = useState(0.85);
  const [speechVolume, setSpeechVolume] = useState(0.8);

  useEffect(() => {
    if (visible) {
      if (profile) setLocalProfile(profile);
      if (themeKey) setLocalTheme(themeKey);
    }
  }, [visible, profile, themeKey]);

  useEffect(() => {
    async function loadVoiceSettings() {
      const speedStr = await AsyncStorage.getItem('clearpath_speech_speed');
      const volStr = await AsyncStorage.getItem('clearpath_speech_volume');
      
      const isElderly = localProfile.elderly || localProfile.lowVision;
      
      let spd = speedStr ? parseFloat(speedStr) : (isElderly ? 0.65 : 0.85);
      let vol = volStr ? parseFloat(volStr) : (localProfile.hearingDifficulty ? 1.0 : 0.8);
      
      setSpeechSpeed(spd);
      setSpeechVolume(vol);
    }
    if (visible) {
      loadVoiceSettings();
    }
  }, [visible, localProfile.elderly, localProfile.lowVision, localProfile.hearingDifficulty]);

  if (!profile || !theme) return null;

  const isElderly = localProfile.elderly || localProfile.lowVision;
  
  const titleSize = isElderly ? 24 : 20;
  const subtitleSize = isElderly ? 18 : 16;
  const cardPadding = isElderly ? 12 : 10;
  const optionTitleSize = isElderly ? 21 : 18;
  const buttonPad = isElderly ? 16 : 14;
  const buttonFont = isElderly ? 23 : 20;
  const infoTitleSize = isElderly ? 20 : 17;

  const options = [
    { id: 'colorBlind', icon: '🔴', title: 'Color blindness' },
    { id: 'lowVision', icon: '👁️', title: 'Low vision' },
    { id: 'elderly', icon: '👴', title: 'Age-related changes' },
    { id: 'hearingDifficulty', icon: '📢', title: 'Hearing difficulty' }
  ];

  const themeOptions = [
    { id: 'dark', title: 'Dark' },
    { id: 'light', title: 'Light' },
    { id: 'highContrast', title: 'High Contrast' },
  ];

  const handleToggle = (id) => {
    setLocalProfile(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSlidingCompleteSpeed = async (val) => {
    setSpeechSpeed(val);
    await AsyncStorage.setItem('clearpath_speech_speed', val.toString());
    Speech.stop();
    Speech.speak("This is how your announcements will sound", {
      rate: val,
      volume: speechVolume,
      pitch: 1.0
    });
  };

  const handleSlidingCompleteVolume = async (val) => {
    setSpeechVolume(val);
    await AsyncStorage.setItem('clearpath_speech_volume', val.toString());
    Speech.stop();
    Speech.speak("This is how your announcements will sound", {
      rate: speechSpeed,
      volume: val,
      pitch: 1.0
    });
  };

  const getSpeedLabel = (val) => {
    if (val <= 0.6) return "Very slow";
    if (val <= 0.85) return "Slow";
    if (val <= 1.0) return "Normal";
    return "Fast";
  };

  const getVolumeLabel = (val) => {
    if (val <= 0.5) return "Low";
    if (val <= 0.75) return "Medium";
    return "High";
  };

  const handleSave = async () => {
    // onSave passed from HomeScreen handles AsyncStorage for profile
    onSave && onSave(localProfile, localTheme);
    onClose();
  };

  const handleClearRequest = () => {
    Alert.alert(
      "Clear preferences?",
      "This will reset all your settings and show the welcome screen again. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear everything", 
          style: "destructive", 
          onPress: async () => {
            await clearProfile();
            onClear && onClear();
          } 
        }
      ]
    );
  };

  const styles = getStyles(theme);

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        
        <View style={styles.panel}>
          <Text style={[styles.title, { fontSize: titleSize }]}>Your profile</Text>
          <Text style={[styles.subtitle, { fontSize: subtitleSize }]}>Update your needs at any time</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionHeader}>THEME</Text>
            <View style={styles.themeRow}>
              {themeOptions.map(opt => {
                const isSelected = localTheme === opt.id;
                return (
                  <TouchableOpacity 
                    key={opt.id} 
                    onPress={() => setLocalTheme(opt.id)}
                    style={[styles.themeCard, isSelected && styles.themeCardSelected]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.themeCardText, isSelected && styles.themeCardTextSelected, { fontSize: subtitleSize }]}>
                      {opt.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionHeader}>
              {isElderly ? 'I NEED HELP WITH' : 'I STRUGGLE WITH'}
            </Text>

            {options.map((opt) => {
              const selected = localProfile[opt.id];
              return (
                <TouchableOpacity 
                  key={opt.id} 
                  style={[
                    styles.card, 
                    { padding: cardPadding },
                    selected && styles.cardSelected
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleToggle(opt.id)}
                >
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardIcon}>{opt.icon}</Text>
                    <Text style={[styles.cardTitle, { fontSize: optionTitleSize }]}>{opt.title}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.sectionHeader, { marginTop: 10 }]}>VOICE ANNOUNCEMENTS</Text>
            
            <View style={styles.sliderBox}>
              <View style={styles.sliderHeaderRow}>
                <Text style={[styles.infoTitle, { fontSize: infoTitleSize }]}>Speech speed</Text>
                <Text style={[styles.infoLabel, { color: theme.accentBlue }]}>{getSpeedLabel(speechSpeed)}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0.4}
                maximumValue={1.2}
                step={0.01}
                value={speechSpeed}
                onSlidingComplete={handleSlidingCompleteSpeed}
                onValueChange={setSpeechSpeed}
                minimumTrackTintColor={theme.accentBlue}
                maximumTrackTintColor="#333344"
                thumbTintColor="#FFFFFF"
              />
            </View>

            <View style={styles.sliderBox}>
              <View style={styles.sliderHeaderRow}>
                <Text style={[styles.infoTitle, { fontSize: infoTitleSize }]}>Volume</Text>
                <Text style={[styles.infoLabel, { color: theme.accentBlue }]}>{getVolumeLabel(speechVolume)}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0.3}
                maximumValue={1.0}
                step={0.01}
                value={speechVolume}
                onSlidingComplete={handleSlidingCompleteVolume}
                onValueChange={setSpeechVolume}
                minimumTrackTintColor={theme.accentBlue}
                maximumTrackTintColor="#333344"
                thumbTintColor="#FFFFFF"
              />
            </View>
            
            <View style={styles.bottomSpace} />
          </ScrollView>

          <TouchableOpacity style={[styles.saveBtn, { paddingVertical: buttonPad }]} onPress={handleSave}>
            <Text style={[styles.saveBtnText, { fontSize: buttonFont }]}>
              {isElderly ? 'Save my preferences' : 'Save preferences'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearBtn} onPress={handleClearRequest}>
            <Text style={[styles.clearBtnText, { fontSize: isElderly ? 15 : 13 }]}>Clear all preferences and restart setup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  panel: {
    backgroundColor: theme.bgPrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.9,
    padding: 20,
    paddingBottom: 30,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  title: {
    color: theme.textPrimary,
    fontWeight: 'bold',
    marginBottom: 4
  },
  subtitle: {
    color: theme.textSecondary,
    marginBottom: 20
  },
  scroll: {
    maxHeight: SCREEN_HEIGHT * 0.65
  },
  sectionHeader: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 5
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  themeCard: {
    flex: 1,
    backgroundColor: theme.bgCard,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCardSelected: {
    borderColor: theme.accentBlue,
    backgroundColor: theme.bgHero,
  },
  themeCardText: {
    color: theme.textSecondary,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  themeCardTextSelected: {
    color: theme.textPrimary,
  },
  card: {
    backgroundColor: theme.bgCard,
    borderColor: theme.border,
    borderWidth: 1.5,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardSelected: {
    backgroundColor: theme.bgHero,
    borderColor: theme.accentBlue
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  cardIcon: {
    fontSize: 18,
    marginRight: 12
  },
  cardTitle: {
    color: theme.textPrimary,
    fontWeight: '600'
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioSelected: {
    borderColor: theme.accentBlue
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.accentBlue
  },
  infoTitle: {
    color: theme.textPrimary,
    fontWeight: '500'
  },
  sliderBox: {
    backgroundColor: theme.bgCard,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderColor: theme.border,
    borderWidth: 1.5,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  slider: {
    width: '100%',
    height: 48,
  },
  bottomSpace: {
    height: 20
  },
  saveBtn: {
    backgroundColor: theme.accentBlue,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10
  },
  saveBtnText: {
    color: theme.bgPrimary, 
    fontWeight: 'bold'
  },
  clearBtn: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 10,
  },
  clearBtnText: {
    color: '#cc4444',
    textAlign: 'center',
  }
});
