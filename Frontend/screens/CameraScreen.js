import React, { useState, useEffect, useRef, useContext } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import BoundingBoxOverlay from '../components/BoundingBoxOverlay';
import AnnouncementBanner from '../components/AnnouncementBanner';
import TrafficLightIndicator from '../components/TrafficLightIndicator';
import ToggleStrip from '../components/ToggleStrip';
import { AppContext } from '../utils/AppContext';
import { THEMES } from '../utils/ThemeColors';
import { playSignalAudio } from '../utils/SignalAudio';

const BACKEND_IP  = '153.106.84.77';
const DETECT_URL  = `http://${BACKEND_IP}:8000/detect/frame`;
const DEMO_DETECT = `http://${BACKEND_IP}:8000/demo/detect`;
const VIDEOS_URL  = `http://${BACKEND_IP}:8000/demo/videos`;
const VIDEO_BASE  = `http://${BACKEND_IP}:8000/videos`;
const FRAME_INTERVAL_MS       = 200;
const DEMO_DETECT_INTERVAL_MS = 80;  // fire often; isProcessingRef limits actual rate to YOLO speed
const CONFIRM_THRESHOLD = 0.50;        // minimum smoothed confidence (green)
const MIN_STREAK_FOR_AUDIO = 2;        // consecutive same-color detections (green)
const RED_CONFIRM_THRESHOLD = 0.45;    // red is safety-critical — fire earlier
const RED_MIN_STREAK = 2;              // fewer consecutive frames needed for red
const YELLOW_CONFIRM_THRESHOLD = 0.75; // yellow is noisier — higher confidence required
const YELLOW_MIN_STREAK = 5;           // and more consecutive frames required
const STOP_CONFIRM_THRESHOLD = 0.55;   // stop sign confidence threshold
const STOP_MIN_STREAK = 3;             // consecutive frames required for stop sign audio

const HomeIcon = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Svg>
);

function transformDetections(detections, frameWidth, frameHeight) {
  return detections.map(d => {
    const [x, y, w, h] = d.bbox;
    return {
      class_name: d.label,
      confidence: d.confidence,
      severity: d.severity,
      bbox: [
        x / frameWidth,
        y / frameHeight,
        (x + w) / frameWidth,
        (y + h) / frameHeight,
      ],
    };
  });
}

export default function CameraScreen() {
  const navigation = useNavigation();
  const { profile, themeKey, toggles, updateToggle, language } = useContext(AppContext);
  const theme = THEMES[themeKey] || THEMES.dark;

  const [permission, requestPermission] = useCameraPermissions();
  const [isConnected, setIsConnected]     = useState(false);
  const [detections, setDetections]       = useState([]);
  const [activeSignal, setActiveSignal]   = useState(null);
  const [activeConfidence, setActiveConfidence] = useState(0);
  const [activeStopConf, setActiveStopConf] = useState(0);
  const [bannerMessage, setBannerMessage] = useState(null);

  // Demo mode state
  const [isDemoMode, setIsDemoMode]       = useState(false);
  const [demoVideos, setDemoVideos]       = useState([]);
  const [selectedVideo, setSelectedVideo] = useState('red1.mp4');
  const [showVideoList, setShowVideoList] = useState(false);
  const videoPositionRef = useRef(0); // current playback position in ms

  const cameraRef      = useRef(null);
  const intervalRef    = useRef(null);
  const isProcessingRef = useRef(false);
  const lastSignalRef    = useRef(null);
  const detectedColorRef = useRef(null); // last color seen from backend
  const colorStreakRef   = useRef(0);    // consecutive same-color detection count
  const stopStreakRef    = useRef(0);    // consecutive stop sign detection count
  const lastStopRef      = useRef(false); // has audio fired for current stop sign sighting

  const [userGender, setUserGender] = useState('fem');
  const togglesRef = useRef(toggles);
  useEffect(() => { togglesRef.current = toggles; }, [toggles]);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission]);

  useEffect(() => {
    if (profile?.gender) setUserGender(profile.gender);
  }, [profile]);

  // Fetch available demo videos once on mount
  useEffect(() => {
    fetch(VIDEOS_URL)
      .then(r => r.json())
      .then(data => setDemoVideos(data.videos || []))
      .catch(() => {});
  }, []);

  // Play audio once when confidence first crosses threshold for the current signal
  useEffect(() => {
    if (!activeSignal) { lastSignalRef.current = null; return; }
    const isYellow = activeSignal === 'yellow';
    const isRed    = activeSignal === 'red';
    const threshold = isRed ? RED_CONFIRM_THRESHOLD : isYellow ? YELLOW_CONFIRM_THRESHOLD : CONFIRM_THRESHOLD;
    const minStreak = isRed ? RED_MIN_STREAK        : isYellow ? YELLOW_MIN_STREAK        : MIN_STREAK_FOR_AUDIO;

    if (
      activeConfidence >= threshold &&
      colorStreakRef.current >= minStreak &&
      lastSignalRef.current !== activeSignal
    ) {
      playSignalAudio({ color: activeSignal, lang: language, gender: userGender });
      lastSignalRef.current = activeSignal;
    }
  }, [activeSignal, activeConfidence, language, userGender]);

  // Play stop sign audio once per sighting
  useEffect(() => {
    if (!activeStopConf) { lastStopRef.current = false; return; }
    if (
      activeStopConf >= STOP_CONFIRM_THRESHOLD &&
      stopStreakRef.current >= STOP_MIN_STREAK &&
      !lastStopRef.current
    ) {
      playSignalAudio({ color: 'stop', lang: language, gender: userGender });
      lastStopRef.current = true;
    }
  }, [activeStopConf, language, userGender]);

  // Switch polling loop when demo mode or selected video changes
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    isProcessingRef.current = false;

    if (isDemoMode) {
      setDetections([]);
      setActiveSignal(null);
      setActiveConfidence(0);
      lastSignalRef.current = null;
      detectedColorRef.current = null;
      colorStreakRef.current = 0;
      stopStreakRef.current = 0;
      lastStopRef.current = false;
      videoPositionRef.current = 0;
      intervalRef.current = setInterval(fetchDemoDetect, DEMO_DETECT_INTERVAL_MS);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isDemoMode, selectedVideo]);

  const handleCameraReady = () => {
    if (!isDemoMode) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(captureAndSendFrame, FRAME_INTERVAL_MS);
    }
  };

  const handleDetectionData = (data) => {
    const transformed = transformDetections(data.detections, data.frame_width, data.frame_height);
    setDetections(transformed);

    const signalItem = transformed.find(item => item.class_name.includes('light'));
    if (signalItem && togglesRef.current.trafficLights) {
      const cn = signalItem.class_name.toLowerCase();
      let color = null;
      if (cn.includes('green'))       color = 'green';
      else if (cn.includes('yellow')) color = 'yellow';
      else if (cn.includes('red'))    color = 'red';

      if (color) {
        // Track consecutive same-color streak for false-positive protection
        if (color === detectedColorRef.current) {
          colorStreakRef.current += 1;
        } else {
          detectedColorRef.current = color;
          colorStreakRef.current = 1;
        }
        setActiveSignal(color);
        setActiveConfidence(signalItem.confidence);
      }
    } else {
      detectedColorRef.current = null;
      colorStreakRef.current = 0;
      setActiveSignal(null);
      setActiveConfidence(0);
    }

    // Stop sign tracking
    const stopItem = transformed.find(item => item.class_name === 'stop_sign');
    if (stopItem && togglesRef.current.signs) {
      stopStreakRef.current += 1;
      setActiveStopConf(stopItem.confidence);
    } else {
      stopStreakRef.current = 0;
      lastStopRef.current = false;
      setActiveStopConf(0);
    }
  };

  // ── Live camera frame capture ──────────────────────────────────────────────
  const captureAndSendFrame = async () => {
    if (!cameraRef.current || isProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      const formData = new FormData();
      formData.append('file', { uri: photo.uri, name: 'frame.jpg', type: 'image/jpeg' });
      const response = await fetch(DETECT_URL, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setIsConnected(true);
      handleDetectionData(data);
    } catch (err) {
      setIsConnected(false);
      console.warn('Detection request failed:', err.message);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // ── Demo detection fetch (no image — video plays natively) ────────────────
  const fetchDemoDetect = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      const pos = videoPositionRef.current;
      const url = `${DEMO_DETECT}?video=${encodeURIComponent(selectedVideo)}&position_ms=${pos}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setIsConnected(true);
      handleDetectionData(data);
    } catch (err) {
      setIsConnected(false);
      console.warn('Demo detect failed:', err.message);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleToggle = (id, val) => updateToggle(id, val);

  if (!permission) return <View style={getStyles(theme).container} />;
  if (!permission.granted) {
    return (
      <View style={[getStyles(theme).container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textPrimary }}>No access to camera</Text>
      </View>
    );
  }

  const styles = getStyles(theme);
  const isElderly   = profile?.elderly || profile?.lowVision;
  const homeBtnSize = isElderly ? 60 : 48;
  const homeIconSize = isElderly ? 26 : 20;

  return (
    <View style={styles.container}>

      {/* ── Background: live camera OR demo video ── */}
      {isDemoMode ? (
        <Video
          source={{ uri: `${VIDEO_BASE}/${selectedVideo}` }}
          style={styles.camera}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
          onPlaybackStatusUpdate={status => {
            if (status.isLoaded) {
              videoPositionRef.current = status.positionMillis ?? 0;
            }
          }}
        />
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          mute={true}
          onCameraReady={handleCameraReady}
        />
      )}

      <BoundingBoxOverlay detections={detections} toggles={toggles} profile={profile} theme={theme} themeKey={themeKey} />

      {!isConnected && (
        <View style={styles.reconnectBadge}>
          <Text style={styles.reconnectText}>Reconnecting…</Text>
        </View>
      )}

      <AnnouncementBanner message={bannerMessage} profile={profile} theme={theme} />
      <TrafficLightIndicator signal={activeSignal} confidence={activeConfidence} profile={profile} theme={theme} themeKey={themeKey} />
      <ToggleStrip toggles={toggles} onToggle={handleToggle} profile={profile} theme={theme} />

      {/* ── Demo controls ── */}
      <View style={styles.demoBar} pointerEvents="box-none">
        {/* Demo toggle */}
        <TouchableOpacity
          style={[styles.demoBtn, isDemoMode && styles.demoBtnActive]}
          onPress={() => { setShowVideoList(false); setIsDemoMode(v => !v); }}
        >
          <Text style={styles.demoBtnText}>{isDemoMode ? 'LIVE' : 'DEMO'}</Text>
        </TouchableOpacity>

        {/* Video picker (only in demo mode) */}
        {isDemoMode && (
          <TouchableOpacity
            style={styles.videoPickerBtn}
            onPress={() => setShowVideoList(v => !v)}
          >
            <Text style={styles.videoPickerText} numberOfLines={1}>
              {selectedVideo.replace('.mp4', '')}  ▾
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Video list dropdown ── */}
      {showVideoList && (
        <View style={styles.videoList}>
          <ScrollView>
            {demoVideos.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.videoItem, v === selectedVideo && styles.videoItemActive]}
                onPress={() => { setSelectedVideo(v); setShowVideoList(false); }}
              >
                <Text style={[styles.videoItemText, v === selectedVideo && styles.videoItemTextActive]}>
                  {v.replace('.mp4', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Home button ── */}
      <View style={styles.homeButtonContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.homeBtn, { width: homeBtnSize, height: homeBtnSize }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <HomeIcon size={homeIconSize} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgPrimary },
  camera:    { ...StyleSheet.absoluteFillObject },
  reconnectBadge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: theme.signalRed,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100,
  },
  reconnectText: { color: '#FFFFFF', fontWeight: 'bold' },

  // Demo controls bar — bottom-right above toggle strip
  demoBar: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 300,
  },
  demoBtn: {
    backgroundColor: 'rgba(13,27,42,0.85)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  demoBtnActive: {
    backgroundColor: theme.accentBlue || '#0A84FF',
    borderColor: theme.accentBlue || '#0A84FF',
  },
  demoBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  videoPickerBtn: {
    backgroundColor: 'rgba(13,27,42,0.85)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
    maxWidth: 150,
  },
  videoPickerText: { color: '#FFFFFF', fontSize: 12 },

  // Video dropdown list
  videoList: {
    position: 'absolute',
    bottom: 130,
    right: 16,
    width: 200,
    maxHeight: 260,
    backgroundColor: theme.bgCard || '#1C1C2E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    zIndex: 400,
    overflow: 'hidden',
  },
  videoItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  videoItemActive: { backgroundColor: theme.accentBlue || '#0A84FF' },
  videoItemText: { color: theme.textPrimary, fontSize: 13 },
  videoItemTextActive: { fontWeight: '700' },

  homeButtonContainer: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    zIndex: 200,
  },
  homeBtn: {
    backgroundColor: 'rgba(13,27,42,0.9)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
});
