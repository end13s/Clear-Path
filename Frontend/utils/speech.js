import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Example generic audio fallback if needed, but we rely on expo-speech TTS here.
// import { Audio } from 'expo-av';

export async function announceSignal(message, profile) {
  try {
    const isElderly = profile?.elderly || profile?.lowVision;
    const isHearingDifficulty = profile?.hearingDifficulty;
    
    const speedStr = await AsyncStorage.getItem('clearpath_speech_speed');
    const volStr = await AsyncStorage.getItem('clearpath_speech_volume');

    const rate = speedStr ? parseFloat(speedStr) : (isElderly ? 0.65 : 0.85);
    const volume = volStr ? parseFloat(volStr) : (isHearingDifficulty ? 1.0 : 0.8);

    console.log(`TTS -> "${message}" | Rate: ${rate} | Vol: ${volume || 'default'}`);

    Speech.stop();
    Speech.speak(message, {
      rate: rate,
      volume: volume,
      pitch: 1.0, 
    });

  } catch (error) {
    console.warn("Failed to play custom audio:", error);
  }
}
