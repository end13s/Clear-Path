// Utility to play audio files for traffic signals based on language, gender, and color
// Falls back to TTS if file is missing or playback fails
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

// --- Static imports for all audio files ---
// English
import fem_eng_green from '../assets/audio/en/fem_eng_green.m4a';
import fem_eng_yellow from '../assets/audio/en/fem_eng_yellow.m4a';
import fem_eng_red from '../assets/audio/en/fem_eng_red.m4a';
import fem_eng_stop from '../assets/audio/en/fem_eng_stop.m4a';
import fem_eng_yield from '../assets/audio/en/fem_eng_yield.m4a';
import fem_eng_ped from '../assets/audio/en/pedestrian/fem_eng_ped.m4a';
import male_eng_green from '../assets/audio/en/male_eng_green.m4a';
import male_eng_yellow from '../assets/audio/en/male_eng_yellow.m4a';
import male_eng_red from '../assets/audio/en/male_eng_red.m4a';
import male_eng_stop from '../assets/audio/en/male_eng_stop.m4a';
import male_eng_yield from '../assets/audio/en/male_eng_yield.m4a';
import male_eng_ped from '../assets/audio/en/pedestrian/male_eng_ped.m4a';
// Spanish
import fem_span_green from '../assets/audio/es/fem_span_green.m4a';
import fem_span_yellow from '../assets/audio/es/fem_span_yellow.m4a';
import fem_span_red from '../assets/audio/es/fem_span_red.m4a';
import fem_span_stop from '../assets/audio/es/fem_span_stop.m4a';
import fem_span_yield from '../assets/audio/es/fem_span_yield.m4a';
import fem_span_ped from '../assets/audio/es/pedestrian/fem_span_ped.m4a';
import male_span_green from '../assets/audio/es/male_span_green.m4a';
import male_span_yellow from '../assets/audio/es/male_span_yellow.m4a';
import male_span_red from '../assets/audio/es/male_span_red.m4a';
import male_span_stop from '../assets/audio/es/male_span_stop.m4a';
import male_span_yield from '../assets/audio/es/male_span_yield.m4a';
import male_span_ped from '../assets/audio/es/pedestrian/male_span_ped.m4a';
// Romanian
import fem_rom_green from '../assets/audio/ro/fem_rom_green.m4a';
import fem_rom_yellow from '../assets/audio/ro/fem_rom_yellow.m4a';
import fem_rom_red from '../assets/audio/ro/fem_rom_red.m4a';
import fem_rom_stop from '../assets/audio/ro/fem_rom_stop.m4a';
import fem_rom_yield from '../assets/audio/ro/fem_rom_yield.m4a';
import fem_rom_ped from '../assets/audio/ro/pedestrian/fem_rom_ped.m4a';
import male_rom_green from '../assets/audio/ro/male_rom_green.m4a';
import male_rom_yellow from '../assets/audio/ro/male_rom_yellow.m4a';
import male_rom_red from '../assets/audio/ro/male_rom_red.m4a';
import male_rom_stop from '../assets/audio/ro/male_rom_stop.m4a';
import male_rom_yield from '../assets/audio/ro/male_rom_yield.m4a';
import male_rom_ped from '../assets/audio/ro/pedestrian/male_rom_ped.m4a';
// Mandarin
import fem_man_green from '../assets/audio/zh/fem_man_green.m4a';
import fem_man_yellow from '../assets/audio/zh/fem_man_yellow.m4a';
import fem_man_red from '../assets/audio/zh/fem_man_red.m4a';
import fem_man_stop from '../assets/audio/zh/fem_man_stop.m4a';
import fem_man_yield from '../assets/audio/zh/fem_man_yield.m4a';
import fem_man_ped from '../assets/audio/zh/pedestrian/fem_man_ped.m4a';

const audioMap = {
  en: {
    fem:  { green: fem_eng_green,  yellow: fem_eng_yellow,  red: fem_eng_red,  stop: fem_eng_stop,  yield: fem_eng_yield,  pedestrian: fem_eng_ped  },
    male: { green: male_eng_green, yellow: male_eng_yellow, red: male_eng_red, stop: male_eng_stop, yield: male_eng_yield, pedestrian: male_eng_ped },
  },
  es: {
    fem:  { green: fem_span_green,  yellow: fem_span_yellow,  red: fem_span_red,  stop: fem_span_stop,  yield: fem_span_yield,  pedestrian: fem_span_ped  },
    male: { green: male_span_green, yellow: male_span_yellow, red: male_span_red, stop: male_span_stop, yield: male_span_yield, pedestrian: male_span_ped },
  },
  ro: {
    fem:  { green: fem_rom_green,  yellow: fem_rom_yellow,  red: fem_rom_red,  stop: fem_rom_stop,  yield: fem_rom_yield,  pedestrian: fem_rom_ped  },
    male: { green: male_rom_green, yellow: male_rom_yellow, red: male_rom_red, stop: male_rom_stop, yield: male_rom_yield, pedestrian: male_rom_ped },
  },
  zh: {
    fem:  { green: fem_man_green, yellow: fem_man_yellow, red: fem_man_red, stop: fem_man_stop, yield: fem_man_yield, pedestrian: fem_man_ped },
    male: { green: fem_man_green, yellow: fem_man_yellow, red: fem_man_red, stop: fem_man_stop, yield: fem_man_yield, pedestrian: fem_man_ped },
  },
};

export async function playSignalAudio({ color, lang = 'en', gender = 'fem' }) {
  try {
    const audioFile = audioMap?.[lang]?.[gender]?.[color];
    if (!audioFile) throw new Error('Audio file not found');
    const { sound } = await Audio.Sound.createAsync(
      audioFile,
      { shouldPlay: true }
    );
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    // Fallback to TTS
    let ttsMsg = '';
    switch (color) {
      case 'green': ttsMsg = lang === 'zh' ? '绿灯' : lang === 'es' ? 'Verde' : lang === 'ro' ? 'Verde' : 'Green'; break;
      case 'yellow': ttsMsg = lang === 'zh' ? '黄灯' : lang === 'es' ? 'Amarillo' : lang === 'ro' ? 'Galben' : 'Yellow'; break;
      case 'red': ttsMsg = lang === 'zh' ? '红灯，请停车' : lang === 'es' ? 'Rojo' : lang === 'ro' ? 'Roșu' : 'Red, come to a stop'; break;
      case 'stop': ttsMsg = lang === 'zh' ? '停车标志' : lang === 'es' ? 'Alto' : lang === 'ro' ? 'Stop' : 'Stop sign'; break;
      case 'yield': ttsMsg = lang === 'zh' ? '让行标志' : lang === 'es' ? 'Ceda el paso' : lang === 'ro' ? 'Cedează trecerea' : 'Yield sign'; break;
      case 'pedestrian': ttsMsg = lang === 'zh' ? '注意行人' : lang === 'es' ? 'Peatón detectado' : lang === 'ro' ? 'Pieton detectat' : 'Pedestrian detected'; break;
      default: ttsMsg = color;
    }
    Speech.speak(ttsMsg, { language: lang });
  }
}
