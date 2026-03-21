import React, { useState, useEffect, useRef, useContext } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import BoundingBoxOverlay from '../components/BoundingBoxOverlay';
import AnnouncementBanner from '../components/AnnouncementBanner';
import TrafficLightIndicator from '../components/TrafficLightIndicator';
import ToggleStrip from '../components/ToggleStrip';
import { AppContext } from '../utils/AppContext';
import { THEMES } from '../utils/ThemeColors';
import { playSignalAudio } from '../utils/SignalAudio';

const BACKEND_IP = '153.106.84.77';
const DETECT_URL = `http://${BACKEND_IP}:8000/detect/frame`;
const FRAME_INTERVAL_MS = 200; // ~5 fps

const HomeIcon = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Svg>
);

// Convert API detections → BoundingBoxOverlay format:
//   label → class_name
//   bbox [x, y, w, h] absolute pixels → [x1, y1, x2, y2] normalized 0-1
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
  const [isConnected, setIsConnected] = useState(false);
  const [detections, setDetections] = useState([]);
  const [activeSignal, setActiveSignal] = useState(null);
  const [bannerMessage, setBannerMessage] = useState(null);

  // Debug overlay state
  const [debugInfo, setDebugInfo] = useState({
    cameraReady: false,
    fnCalls: 0,
    framesSent: 0,
    lastStatus: '—',
    lastDetectionCount: 0,
  });

  const cameraRef = useRef(null);
  const intervalRef = useRef(null);
  const isProcessingRef = useRef(false); // prevents overlapping requests
  const framesSentRef = useRef(0);
  const fnCallsRef = useRef(0);

  // Track last announced signal to avoid repeats
  const lastSignalRef = useRef(null);
  // Track user gender (default to 'fem')
  const [userGender, setUserGender] = useState('fem');

  const togglesRef = useRef(toggles);
  useEffect(() => {
    togglesRef.current = toggles;
  }, [toggles]);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  // Load gender from profile if available
  useEffect(() => {
    if (profile) {
      if (profile.gender) setUserGender(profile.gender);
    }
  }, [profile]);

  // Play audio when activeSignal changes
  useEffect(() => {
    if (activeSignal && lastSignalRef.current !== activeSignal) {
      playSignalAudio({ color: activeSignal, lang: language, gender: userGender });
      lastSignalRef.current = activeSignal;
    }
    if (!activeSignal) {
      lastSignalRef.current = null;
    }
  }, [activeSignal, language, userGender]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleCameraReady = () => {
    setDebugInfo(prev => ({ ...prev, cameraReady: true }));
    intervalRef.current = setInterval(captureAndSendFrame, FRAME_INTERVAL_MS);
  };

  const captureAndSendFrame = async () => {
    fnCallsRef.current += 1;
    setDebugInfo(prev => ({ ...prev, fnCalls: fnCallsRef.current }));
    if (!cameraRef.current || isProcessingRef.current) return;

    isProcessingRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
      });

      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        name: 'frame.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(DETECT_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setIsConnected(true);
      framesSentRef.current += 1;

      const transformed = transformDetections(
        data.detections,
        data.frame_width,
        data.frame_height,
      );
      setDetections(transformed);
      setDebugInfo(prev => ({
        ...prev,
        framesSent: framesSentRef.current,
        lastStatus: 'OK',
        lastDetectionCount: data.detections.length,
      }));

      const signalItem = transformed.find(item => item.class_name.includes('light'));
      if (signalItem && togglesRef.current.trafficLights) {
        const cn = signalItem.class_name.toLowerCase();
        if (cn.includes('green')) setActiveSignal('green');
        else if (cn.includes('yellow')) setActiveSignal('yellow');
        else if (cn.includes('red')) setActiveSignal('red');
      } else {
        setActiveSignal(null);
      }
    } catch (err) {
      setIsConnected(false);
      setDebugInfo(prev => ({ ...prev, lastStatus: err.message }));
      console.warn('Detection request failed:', err.message);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleToggle = (id, val) => {
    updateToggle(id, val);
  };

  if (!permission) {
    return <View style={getStyles(theme).container} />;
  }
  if (!permission.granted) {
    return (
      <View style={[getStyles(theme).container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textPrimary }}>No access to camera</Text>
      </View>
    );
  }

  const styles = getStyles(theme);

  const isElderly = profile?.elderly || profile?.lowVision;
  const homeBtnSize = isElderly ? 60 : 48;
  const homeIconSize = isElderly ? 26 : 20;

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={handleCameraReady}
      />

      <BoundingBoxOverlay detections={detections} toggles={toggles} profile={profile} theme={theme} themeKey={themeKey} />

      {!isConnected && (
        <View style={styles.reconnectBadge}>
          <Text style={styles.reconnectText}>Reconnecting...</Text>
        </View>
      )}

      <AnnouncementBanner message={bannerMessage} profile={profile} theme={theme} />
      <TrafficLightIndicator signal={activeSignal} profile={profile} theme={theme} themeKey={themeKey} />
      <ToggleStrip toggles={toggles} onToggle={handleToggle} profile={profile} theme={theme} />

      {/* Debug Overlay */}
      <View style={styles.debugOverlay} pointerEvents="none">
        <Text style={styles.debugText}>Camera: {debugInfo.cameraReady ? '✓ Ready' : '✗ Not Ready'}</Text>
        <Text style={styles.debugText}>Fn calls: {debugInfo.fnCalls}</Text>
        <Text style={styles.debugText}>Frames sent: {debugInfo.framesSent}</Text>
        <Text style={styles.debugText}>Last POST: {debugInfo.lastStatus}</Text>
        <Text style={styles.debugText}>Detections: {debugInfo.lastDetectionCount}</Text>
      </View>

      {/* Home Button Container */}
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
  container: {
    flex: 1,
    backgroundColor: theme.bgPrimary,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
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
  reconnectText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  homeButtonContainer: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    zIndex: 200,
  },
  debugOverlay: {
    position: 'absolute',
    top: 60,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 8,
    borderRadius: 8,
    zIndex: 300,
  },
  debugText: {
    color: '#00FF88',
    fontSize: 11,
    fontFamily: 'monospace',
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
