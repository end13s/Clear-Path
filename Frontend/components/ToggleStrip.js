import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, Animated, StyleSheet } from 'react-native';

const TOGGLE_ITEMS = [
  { id: 'trafficLights', label: 'Traffic\nLights', icon: '🚦' },
  { id: 'signs', label: 'Signs', icon: '🛑' },
  { id: 'hazards', label: 'Hazards', icon: '🚶' },
];

export default function ToggleStrip({ toggles, onToggle }) {
  const [isVisible, setIsVisible] = useState(true);
  const slideAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  // Extremely narrow panel to save screen space
  const panelWidth = 110; 
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, panelWidth],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX }] }]}>
      {/* Chevron Tab */}
      <TouchableOpacity
        style={styles.chevronTab}
        onPress={() => setIsVisible(!isVisible)}
        activeOpacity={0.7}
      >
        <Text style={styles.chevronText}>{isVisible ? '▶' : '◀'}</Text>
      </TouchableOpacity>

      {/* Main Panel */}
      <View style={styles.panel}>
        <Text style={styles.headerText}>Toggle{"\n"}Features:</Text>
        {TOGGLE_ITEMS.map((item) => (
          <View style={styles.row} key={item.id}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.label}>{item.label}</Text>
            <Switch
              trackColor={{ false: '#555555', true: '#1A8FE3' }}
              thumbColor="#FFFFFF"
              onValueChange={(value) => onToggle(item.id, value)}
              value={toggles[item.id]}
              style={styles.switch}
            />
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    top: '25%', // Lifted slightly
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  chevronTab: {
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    paddingVertical: 24, // Taller touch target
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  panel: {
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    minWidth: 110, // Dramatically thinner
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  headerText: {
    color: '#A0B0C0',
    fontSize: 13,
    marginBottom: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'column', // Stacked strictly vertically
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  icon: {
    fontSize: 26,
    marginBottom: 4,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8, // Space between text and switch
    textAlign: 'center',
  },
  switch: {
    transform: [{ scale: 1.1 }], 
    alignSelf: 'center',
  },
});
