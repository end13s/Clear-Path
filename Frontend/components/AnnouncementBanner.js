import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

export default function AnnouncementBanner({ message, profile, theme }) {
  const isElderly = profile?.elderly || profile?.lowVision;
  const bannerHeight = isElderly ? 100 : 80;
  const bannerFontSize = isElderly ? 36 : 28;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start();
    }
  }, [message]);

  if (!theme || !message) return null;

  const styles = getStyles(theme);

  return (
    <Animated.View style={[styles.banner, { height: bannerHeight, opacity }]} pointerEvents="none">
      <Text style={[styles.bannerText, { fontSize: bannerFontSize }]}>{message}</Text>
    </Animated.View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: theme.bgHeader,
    borderColor: theme.border,
    borderWidth: 2,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  bannerText: {
    color: theme.textPrimary,
    fontFamily: 'Lexend_700Bold',
    textAlign: 'center',
  }
});
