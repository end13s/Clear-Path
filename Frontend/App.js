import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, AppState, SafeAreaView } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';

import ToggleStrip from './components/ToggleStrip';
import TrafficLightIndicator from './components/TrafficLightIndicator';
import AnnouncementBanner from './components/AnnouncementBanner';
import BoundingBoxOverlay from './components/BoundingBoxOverlay';
import WSManager from './utils/WebSocketManager';
import { announceSignal } from './utils/speech';

// --- CONFIGURATION ---
// Replace with the IP address of the laptop running the FastAPI backend
const BACKEND_IP = '192.168.1.100'; // FIXME: Replace with actual IP
const WS_URL = `ws://${BACKEND_IP}:8000/ws`;

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [appState, setAppState] = useState(AppState.currentState);

  // App States
  const [toggles, setToggles] = useState({
    trafficLights: true,
    signs: true,
    hazards: true,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [detections, setDetections] = useState(null);
  const [bannerMessage, setBannerMessage] = useState(null);

  // Refs for tracking
  const cameraRef = useRef(null);
  const wsRef = useRef(null);
  const frameInterval = useRef(null);
  const bannerTimer = useRef(null);
  
  // Keep track of what we already announced so we don't spam
  // Track strictly by label/state strings. e.g., 'signal_red', 'sign_Stop Sign', 'hazard_Pedestrian'
  const currentlyAnnounced = useRef(new Set());

  useEffect(() => {
    // Setup WebSocket
    wsRef.current = new WSManager(
      WS_URL,
      handleDetections,
      () => setIsConnected(true),
      () => setIsConnected(false)
    );
    wsRef.current.connect();

    // AppState Listener to pause parsing
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
      if (nextAppState.match(/inactive|background/)) {
        stopFrameCapture();
        wsRef.current?.disconnect();
      } else {
        wsRef.current?.connect();
        startFrameCapture();
      }
    });

    return () => {
      stopFrameCapture();
      wsRef.current?.disconnect();
      subscription.remove();
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  // Frame Capture Loop
  const startFrameCapture = () => {
    if (frameInterval.current) return;
    frameInterval.current = setInterval(async () => {
      if (cameraRef.current && wsRef.current?.isConnected) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.3,
            skipProcessing: true,
          });
          if (photo?.base64) {
            wsRef.current.sendFrame(photo.base64);
          }
        } catch (e) {
          console.warn("Frame capture error: ", e);
        }
      }
    }, 500);
  };

  const stopFrameCapture = () => {
    if (frameInterval.current) {
      clearInterval(frameInterval.current);
      frameInterval.current = null;
    }
  };

  // Lifecycle for Camera readiness
  const onCameraReady = () => {
    startFrameCapture();
  };

  // Handle Incoming WS Data
  const handleDetections = useCallback((data) => {
    setDetections(data);
    processAnnouncements(data, toggles);
  }, [toggles]);

  // Process and trigger banner/speech
  const processAnnouncements = (data, currentToggles) => {
    const newItems = new Set();
    let priorityMessage = null;
    let prioritySpeech = null;

    // 1. Traffic Lights
    if (currentToggles.trafficLights && data.signal) {
      const stateKey = `signal_${data.signal}`;
      newItems.add(stateKey);

      let msg = '';
      let speech = '';
      if (data.signal === 'red') { msg = '🚦 Red Light'; speech = 'Red Light'; }
      if (data.signal === 'yellow') { msg = '🚦 Yellow Light — Slow Down'; speech = 'Yellow Light — Slow Down'; }
      if (data.signal === 'green') { msg = '🚦 Green Light — Proceed'; speech = 'Green Light — Proceed'; }

      if (!currentlyAnnounced.current.has(stateKey)) {
        priorityMessage = msg;
        prioritySpeech = speech;
      }
    }

    // 2. Signs
    if (currentToggles.signs && data.signs && data.signs.length > 0) {
      // Pick first sign as highest priority
      const sign = data.signs[0].label;
      const stateKey = `sign_${sign}`;
      
      data.signs.forEach(s => newItems.add(`sign_${s.label}`));

      if (!priorityMessage && !currentlyAnnounced.current.has(stateKey)) {
        if (sign.toLowerCase().includes('stop')) {
          priorityMessage = `🛑 ${sign} Ahead`;
        } else if (sign.toLowerCase().includes('speed')) {
          priorityMessage = `⚠️ ${sign}`;
        } else {
          priorityMessage = `🛑 ${sign}`;
        }
        prioritySpeech = priorityMessage.replace(/🛑|⚠️|🚦/g, '').trim(); // Remove emojis for speech
      }
    }

    // 3. Hazards
    if (currentToggles.hazards && data.hazards && data.hazards.length > 0) {
      const hazard = data.hazards[0].label;
      const stateKey = `hazard_${hazard}`;

      data.hazards.forEach(h => newItems.add(`hazard_${h.label}`));

      if (!priorityMessage && !currentlyAnnounced.current.has(stateKey)) {
        if (hazard.toLowerCase().includes('pedestrian')) {
          priorityMessage = `🚶 Pedestrian in Crosswalk`;
        } else if (hazard.toLowerCase().includes('cyclist')) {
          priorityMessage = `🚲 Cyclist Ahead`;
        } else {
          priorityMessage = `⚠️ ${hazard} Ahead`;
        }
        prioritySpeech = priorityMessage.replace(/🚶|🚲|⚠️/g, '').trim();
      }
    }

    // Update 'currently seen' set
    currentlyAnnounced.current = newItems;

    // Trigger Banner and Speech
    if (priorityMessage && prioritySpeech) {
      setBannerMessage(priorityMessage);
      announceSignal(prioritySpeech);

      // Auto-hide banner after 2 seconds
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => {
        setBannerMessage(null);
      }, 2000);
    }
  };

  const handleToggle = (id, value) => {
    setToggles(prev => ({ ...prev, [id]: value }));
    // Clear notifications if toggled off
    if (!value) {
      setBannerMessage(null);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ color: 'white', textAlign: 'center', margin: 20 }}>
          We need your permission to show the camera
        </Text>
        <Text onPress={requestPermission} style={{ color: '#1A8FE3', fontSize: 18, fontWeight: 'bold' }}>
          Grant Permission
        </Text>
      </View>
    );
  }

  // Determine current active traffic signal
  const activeSignal = toggles.trafficLights && detections?.signal ? detections.signal : null;

  return (
    <View style={styles.container}>
      {/* 1. Camera Base Layer */}
      <CameraView 
        style={StyleSheet.absoluteFill} 
        facing="back"
        ref={cameraRef}
        onCameraReady={onCameraReady}
        mute={true}
      />

      {/* 2. SVG Overlay Layer */}
      <BoundingBoxOverlay detections={detections} toggles={toggles} />

      {/* 3. UI Layer */}
      <AnnouncementBanner message={bannerMessage} />
      <TrafficLightIndicator signal={activeSignal} />
      <ToggleStrip toggles={toggles} onToggle={handleToggle} />
      
      {/* Reconnecting Badge */}
      {!isConnected && (
        <SafeAreaView style={styles.reconnectContainer} pointerEvents="none">
          <View style={styles.reconnectBadge}>
            <Text style={styles.reconnectText}>Reconnecting…</Text>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reconnectContainer: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
    zIndex: 50,
  },
  reconnectBadge: {
    backgroundColor: '#CC2200',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  reconnectText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
