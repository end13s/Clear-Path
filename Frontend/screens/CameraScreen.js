import React, { useState, useEffect, useRef, useContext } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { io } from 'socket.io-client';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import BoundingBoxOverlay from '../components/BoundingBoxOverlay';
import AnnouncementBanner from '../components/AnnouncementBanner';
import TrafficLightIndicator from '../components/TrafficLightIndicator';
import ToggleStrip from '../components/ToggleStrip';
import { AppContext } from '../utils/AppContext';
import { THEMES } from '../utils/ThemeColors';

const BACKEND_IP = '153.106.91.39';
const WS_URL = `ws://${BACKEND_IP}:8000/ws`;

const HomeIcon = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Svg>
);

export default function CameraScreen() {
  const navigation = useNavigation();
  const { profile, themeKey, toggles, updateToggle } = useContext(AppContext);
  const theme = THEMES[themeKey] || THEMES.dark;

  const [permission, requestPermission] = useCameraPermissions();
  const [socketConnected, setSocketConnected] = useState(false);
  const [detections, setDetections] = useState([]);
  const [activeSignal, setActiveSignal] = useState(null);
  const [bannerMessage, setBannerMessage] = useState(null);
  
  const cameraRef = useRef(null);
  const socketRef = useRef(null);
  const intervalRef = useRef(null);

  const togglesRef = useRef(toggles);
  useEffect(() => {
    togglesRef.current = toggles;
  }, [toggles]);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    const initSocket = () => {
      try {
        const socket = io(WS_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('Connected to detection server');
          setSocketConnected(true);
        });

        socket.on('disconnect', () => {
          console.log('Disconnected from server');
          setSocketConnected(false);
        });

        socket.on('detection_results', (data) => {
          if (data && data.results) {
            setDetections(data.results);
            const signalItem = data.results.find(item => item.class_name.includes('light'));
            if (signalItem && togglesRef.current.trafficLights) {
              const cn = signalItem.class_name.toLowerCase();
              if (cn.includes('green')) setActiveSignal('green');
              else if (cn.includes('yellow')) setActiveSignal('yellow');
              else if (cn.includes('red')) setActiveSignal('red');
            } else {
              setActiveSignal(null);
            }
          }
        });
      } catch (err) {
        console.error('Socket initialization error:', err);
      }
    };

    initSocket();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleCameraReady = () => {
    console.log("Camera is ready, starting frame capture...");
    intervalRef.current = setInterval(captureAndSendFrame, 500);
  };

  const captureAndSendFrame = async () => {
    if (cameraRef.current && socketConnected && socketRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          base64: true,
          skipProcessing: true,
        });
        socketRef.current.emit('frame', { image: photo.base64 });
      } catch (err) {
        console.warn('Frame capture skipped:', err);
      }
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

      {!socketConnected && (
        <View style={styles.reconnectBadge}>
          <Text style={styles.reconnectText}>Reconnecting...</Text>
        </View>
      )}

      <AnnouncementBanner message={bannerMessage} profile={profile} theme={theme} />
      <TrafficLightIndicator signal={activeSignal} profile={profile} theme={theme} themeKey={themeKey} />
      <ToggleStrip toggles={toggles} onToggle={handleToggle} profile={profile} theme={theme} />
      
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
  homeBtn: {
    backgroundColor: 'rgba(13,27,42,0.9)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  }
});
