import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';

const COLORS = {
  red: '#CC2200',
  yellow: '#CC8800',
  green: '#007A40',
};

export default function TrafficLightIndicator({ signal }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (signal) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [signal, opacity]);

  const backgroundColor = signal ? COLORS[signal.toLowerCase()] : COLORS.red;
  const labelText = signal ? signal.toUpperCase() : 'RED';

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor }]}>
      <View style={styles.circle} />
      <Text style={styles.text}>{labelText}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60, // Clear of status bar
    left: 16,
    minWidth: 160,
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
    // Add subtle shadow for visibility over light backgrounds
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
